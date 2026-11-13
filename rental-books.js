/* Accounting and availability rules shared by the rental desk and existing books. */
(function (root) {
  "use strict";

  const cents = value => Math.round((Number(value) || 0) * 100);
  const amount = value => value / 100;
  const sum = (rows, get) => rows.reduce((total, row) => total + get(row), 0);
  const managed = row => row.type === "rental" && row.rentalVersion === 1;
  const pending = row => managed(row) && (row.state === "reserved" || row.state === "cancelled");
  const rentalEvent = row => ["rental-charge", "rental-payment", "deposit-in", "deposit-out", "deposit-apply", "rental-credit", "rental-refund"].includes(row.type);
  const matchesVehicle = (row, vehicle) => row.vehicleId ? row.vehicleId === vehicle.id : row.vehicle === vehicle.name + " - " + vehicle.plate;
  const customerKey = row => row.customerId || (row.client ? "name:" + row.client : "");

  function invoice(lines, discount, taxRate) {
    const subtotal = sum(lines, line => line.cents);
    const net = subtotal - discount;
    if (net < 0) throw new Error("Discount exceeds the line-item total.");
    const tax = Math.round(net * taxRate / 100);
    return { lines, discount, taxRate, net, tax, gross: net + tax };
  }

  function active(row) {
    return row.type === "rental" && (managed(row) ? row.state === "out" : !row.returned);
  }

  function overlap(rows, vehicle, start, end, except, now) {
    return rows.some(row => {
      if (row.id === except || row.type !== "rental" || !matchesVehicle(row, vehicle)) return false;
      if (active(row)) {
        const startAt = managed(row) ? row.checkoutAt || row.start : (row.time || "").slice(0, 16);
        const endAt = managed(row) ? row.dueAt : (row.due ? row.due + "T23:59" : "");
        return (!startAt || startAt < end) && (!endAt || endAt <= now || endAt > start);
      }
      return managed(row) && row.state === "reserved" && row.start < end && row.dueAt > start;
    });
  }

  function rentalPosition(rows, rental) {
    const events = rows.filter(row => row.rentalId === rental.id);
    return {
      billed: (pending(rental) ? 0 : rental.invoice.gross) + sum(events, row => row.type === "rental-charge" ? row.invoice.gross : row.type === "rental-credit" ? -row.invoice.gross : 0),
      paid: sum(events, row => row.type === "rental-payment" || row.type === "deposit-apply" ? row.cents : row.type === "rental-refund" ? -row.cents : 0),
      held: sum(events, row => row.type === "deposit-in" ? row.cents : ["deposit-out", "deposit-apply"].includes(row.type) ? -row.cents : 0),
      events
    };
  }

  function journal(row) {
    const lines = [];
    const post = (debit, credit, value) => {
      if (!value) return;
      if (value < 0) { [debit, credit] = [credit, debit]; value = -value; }
      lines.push({ account: debit, dr: value, cr: 0 }, { account: credit, dr: 0, cr: value });
    };
    if (pending(row)) return lines;
    if (managed(row) || row.type === "rental-charge" || row.type === "rental-credit") {
      const sign = row.type === "rental-credit" ? -1 : 1;
      post("Accounts receivable", "Rental income", sign * row.invoice.net);
      post("Accounts receivable", "Output tax", sign * row.invoice.tax);
    } else if (row.type === "rental") {
      post(row.paid ? "Cash / bank" : "Accounts receivable", "Rental income", cents(row.total));
      if (!row.depositReturned) post("Cash / bank", "Deposits held", cents(row.deposit));
    } else if (row.type === "parking") {
      post(row.paid ? "Cash / bank" : "Accounts receivable", "Parking income", cents(row.amount));
    } else if (row.type === "taxi") {
      post("Cash / bank", "Taxi income", cents(row.fare));
    } else if (row.type === "receipt") {
      post("Cash / bank", customerKey(row) ? "Accounts receivable" : "Other income", cents(row.amt));
    } else if (row.type === "expense" || row.type === "payment") {
      post(row.type === "expense" ? "Expenses" : "Payments / costs", "Cash / bank", cents(row.amt));
    } else {
      const accounts = {
        "rental-payment": ["Cash / bank", "Accounts receivable"],
        "deposit-in": ["Cash / bank", "Deposits held"],
        "deposit-out": ["Deposits held", "Cash / bank"],
        "deposit-apply": ["Deposits held", "Accounts receivable"],
        "rental-refund": ["Accounts receivable", "Cash / bank"]
      }[row.type];
      if (accounts) post(accounts[0], accounts[1], row.cents);
    }
    return lines;
  }

  function ledger(rows) {
    const totals = {};
    rows.forEach(row => journal(row).forEach(line => {
      totals[line.account] = (totals[line.account] || 0) + line.dr - line.cr;
    }));
    return totals;
  }

  function receivable(row) {
    return sum(journal(row), line => line.account === "Accounts receivable" ? line.dr - line.cr : 0);
  }

  function receivables(rows, customers) {
    const balances = new Map(customers.map(customer => [customer.id, cents(customer.opening)]));
    const legacyNames = new Map();
    customers.forEach(customer => {
      legacyNames.set(customer.name, legacyNames.has(customer.name) ? null : customer.id);
    });
    rows.forEach(row => {
      const change = receivable(row);
      if (!change) return;
      const key = row.customerId || legacyNames.get(row.client) || customerKey(row) || row.id;
      balances.set(key, (balances.get(key) || 0) + change);
    });
    return {
      balances,
      due: sum([...balances.values()], value => Math.max(0, value)),
      advances: sum([...balances.values()], value => Math.max(0, -value))
    };
  }

  function aging(rows, today, localDay) {
    const buckets = [0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0];
    function add(value, due) {
      if (value <= 0) return;
      const days = (Date.parse(today) - Date.parse(due)) / 86400000;
      const bucket = days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
      buckets[bucket] += value;
      counts[bucket] += 1;
    }
    const events = new Map();
    rows.filter(rentalEvent).forEach(row => {
      if (!events.has(row.rentalId)) events.set(row.rentalId, []);
      events.get(row.rentalId).push(row);
    });
    rows.forEach(row => {
      if (pending(row)) return;
      if (!managed(row)) {
        if (row.type === "rental" || row.type === "parking") add(receivable(row), localDay(row.time) || today);
        return;
      }
      const linked = events.get(row.id) || [];
      const credits = new Map();
      let paid = 0;
      linked.forEach(item => {
        if (item.type === "rental-credit") credits.set(item.sourceId, (credits.get(item.sourceId) || 0) + item.invoice.gross);
        else if (["rental-payment", "deposit-apply"].includes(item.type)) paid += item.cents;
        else if (item.type === "rental-refund") paid -= item.cents;
      });
      const documents = [row, ...linked.filter(item => item.type === "rental-charge")]
        .map(item => ({ item, due: item.invoiceDue || item.due || localDay(item.time) || today }))
        .sort((a, b) => a.due.localeCompare(b.due) || a.item.time.localeCompare(b.item.time));
      documents.forEach(({ item, due }) => {
        const open = item.invoice.gross - (credits.get(item.id) || 0);
        const allocated = Math.min(open, Math.max(0, paid));
        paid -= allocated;
        add(open - allocated, due);
      });
    });
    return { buckets, counts };
  }

  function validateRentalBackup(rows) {
    const byId = new Map(rows.map(row => [row.id, row]));
    const seen = new Set();
    rows.forEach(row => {
      if (!managed(row) && !rentalEvent(row)) return;
      if (typeof row.id !== "string" || !row.id || seen.has(row.id) || typeof row.time !== "string") throw new Error("Invalid rental reference");
      seen.add(row.id);
      if (managed(row) && (!["reserved", "out", "returned", "cancelled"].includes(row.state) || !row.customerId || !row.vehicleId || typeof row.start !== "string" || typeof row.dueAt !== "string")) throw new Error("Invalid agreement");
      if (managed(row) || row.type === "rental-charge" || row.type === "rental-credit") {
        const doc = row.invoice;
        if (!doc || !Array.isArray(doc.lines) || !doc.lines.length || doc.lines.some(line => !line || typeof line.label !== "string" || ![line.qty, line.rate, line.cents].every(Number.isSafeInteger)) ||
            ![doc.discount, doc.net, doc.tax, doc.gross].every(value => Number.isSafeInteger(value) && value >= 0) ||
            !Number.isFinite(doc.taxRate) || doc.taxRate < 0 || doc.taxRate > 100 ||
            doc.net + doc.tax !== doc.gross) throw new Error("Invalid rental invoice");
      } else if (!Number.isSafeInteger(row.cents) || row.cents <= 0) throw new Error("Invalid rental transaction");
      if (rentalEvent(row)) {
        const rental = byId.get(row.rentalId);
        if (!rental || !managed(rental) || pending(rental) || rental.customerId !== row.customerId) throw new Error("Missing agreement");
      }
      if (row.type === "rental-credit") {
        const source = byId.get(row.sourceId);
        if (!source || !(source.id === row.rentalId || (source.rentalId === row.rentalId && source.type === "rental-charge"))) throw new Error("Missing original invoice");
      }
    });
  }

  root.RentalBooks = { cents, amount, sum, managed, pending, rentalEvent, matchesVehicle, active, overlap, invoice, rentalPosition, journal, ledger, receivable, receivables, aging, validateRentalBackup };
})(globalThis);
