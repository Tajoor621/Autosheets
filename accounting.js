/* Posting, closing and reconciliation rules used by the accounting workspace. */
(function (root) {
  "use strict";
  const B = root.RentalBooks;
  const cashAccounts = ["Cash / bank", "Bank", "Cash on hand", "Card clearing"];
  const accounts = [...cashAccounts, "Accounts receivable", "Fleet assets", "Prepaid expenses", "Other assets",
    "Deposits held", "Output tax", "Accounts payable", "Owner capital", "Opening equity", "Rental income",
    "Parking income", "Taxi income", "Other income", "Expenses", "Payments / costs", "Depreciation expense"];
  const revenueAccounts = ["Rental income", "Parking income", "Taxi income", "Other income"];
  const costAccounts = ["Expenses", "Payments / costs", "Depreciation expense"];
  const assetAccounts = ["Fleet assets", "Prepaid expenses", "Other assets"];
  const equityAccounts = ["Owner capital", "Opening equity"];
  const localDate = time => {
    const date = new Date(time);
    if (!time || !Number.isFinite(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  const day = row => row.postingDate || localDate(row.time);
  const amount = (value) => B.cents(value);

  function totals(rows, customers, inventory, through = "9999-12-31") {
    const result = B.ledger(rows.filter(row => day(row) && day(row) <= through));
    const customerOpening = B.sum(customers, row => amount(row.opening));
    const fleetOpening = B.sum(inventory, row => amount(row.value));
    result["Accounts receivable"] = (result["Accounts receivable"] || 0) + customerOpening;
    result["Fleet assets"] = (result["Fleet assets"] || 0) + fleetOpening;
    result["Opening equity"] = (result["Opening equity"] || 0) - customerOpening - fleetOpening;
    return result;
  }

  function manualLines(fields) {
    const lines = fields.filter(line => line.account || line.dr || line.cr).map(line => ({
      account: line.account,
      dr: amount(line.dr),
      cr: amount(line.cr)
    }));
    if (lines.length < 2 || lines.some(line => !accounts.includes(line.account) ||
        ["Accounts receivable", "Deposits held"].includes(line.account) ||
        !Number.isSafeInteger(line.dr) || !Number.isSafeInteger(line.cr) ||
        (line.dr > 0 ? line.cr !== 0 : line.dr !== 0 || line.cr <= 0))) throw new Error("Enter at least two accounts, with a debit or credit on each line.");
    const debit = B.sum(lines, line => line.dr);
    if (!Number.isSafeInteger(debit) || debit !== B.sum(lines, line => line.cr)) throw new Error("Debits and credits must match.");
    return lines;
  }

  function signature(row) {
    const lines = B.journal(row);
    return lines.length ? JSON.stringify([day(row), lines, row.customerId || "", row.client || "", row.rentalId || "", row.vehicleId || "", row.vehicle || "", (B.managed(row) ? row.originalDueAt || row.dueAt : row.due) || "", row.invoiceDue || "", row.invoice || null, row.note || "", row.method || "", row.reversalOf || ""]) : "";
  }

  function protectHistory(previous, next, settings) {
    const nextMap = new Map(next.map(row => [row.id, row]));
    const oldMap = new Map(previous.map(row => [row.id, row]));
    if (nextMap.size !== next.length) throw new Error("Duplicate posting reference.");
    const closed = settings?.closed || "";
    const reconciled = settings?.reconciled || {};
    function protectedEntry(row) {
      if (!row) return false;
      const date = day(row);
      return B.journal(row).some(line => (date && closed && date <= closed) ||
        (cashAccounts.includes(line.account) && date && reconciled[line.account] && date <= reconciled[line.account].through));
    }
    for (const id of new Set([...oldMap.keys(), ...nextMap.keys()])) {
      const old = oldMap.get(id);
      const fresh = nextMap.get(id);
      if ((protectedEntry(old) || protectedEntry(fresh)) && (old ? signature(old) : "") !== (fresh ? signature(fresh) : "")) {
        throw new Error("This posting affects a closed period or a reconciled cash account. Post a correction in an open period.");
      }
    }
  }

  function cashMovements(rows, from, through) {
    const values = new Map(cashAccounts.map(account => [account, { account, opening: 0, incoming: 0, outgoing: 0 }]));
    for (const row of rows) {
      const date = day(row);
      if (!date || date > through) continue;
      for (const line of B.journal(row)) {
        const account = values.get(line.account);
        if (!account) continue;
        if (from && date < from) account.opening += line.dr - line.cr;
        else {
          account.incoming += line.dr;
          account.outgoing += line.cr;
        }
      }
    }
    return [...values.values()].map(({ account, opening, incoming, outgoing }) => [account, opening, incoming, outgoing, opening + incoming - outgoing]);
  }

  function reconcile(rows, account, through, statement, outstanding) {
    if (!cashAccounts.includes(account) || !through || !Number.isSafeInteger(statement)) throw new Error("Enter a valid statement date and balance.");
    const eligible = rows.filter(row => day(row) && day(row) <= through).map(row => ({
      row, cents: B.sum(B.journal(row).filter(line => line.account === account), line => line.dr - line.cr)
    })).filter(item => item.cents);
    const book = B.sum(eligible, item => item.cents);
    const pending = B.sum(eligible.filter(item => outstanding.has(item.row.id)), item => item.cents);
    return { eligible, book, pending, difference: book - pending - statement };
  }

  const validDate = date => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;

  function validateBackup(rows) {
    B.validateRentalBackup(rows);
    const seen = new Set();
    rows.forEach(row => {
      if (typeof row.id !== "string" || !row.id || seen.has(row.id) || !Number.isFinite(Date.parse(row.time))) throw new Error("Invalid or duplicate posting reference.");
      seen.add(row.id);
      if (row.postingDate !== undefined && !validDate(row.postingDate)) throw new Error("Invalid posting date.");
      if (row.type !== "journal") return;
      if (!validDate(row.postingDate) || typeof row.memo !== "string" || !Array.isArray(row.lines) ||
          row.lines.some(line => !line || !Number.isSafeInteger(line.dr) || !Number.isSafeInteger(line.cr))) throw new Error("Invalid journal in backup.");
      manualLines(row.lines.map(line => ({ account: line.account, dr: B.amount(line.dr), cr: B.amount(line.cr) })));
      if (row.reversalOf) {
        const original = rows.find(item => item.id === row.reversalOf && item.type === "journal" && !item.reversalOf);
        if (!original || original.postingDate > row.postingDate || rows.filter(item => item.reversalOf === original.id).length !== 1 ||
            JSON.stringify(original.lines.map(line => ({ account: line.account, dr: line.cr, cr: line.dr }))) !== JSON.stringify(row.lines)) {
          throw new Error("Invalid journal reversal in backup.");
        }
      }
    });
  }

  function validateControls(controls, history) {
    if (!controls || typeof controls !== "object" || Array.isArray(controls) ||
        (controls.closed !== undefined && !validDate(controls.closed))) throw new Error("Invalid period close in backup.");
    const current = {};
    const reconciliations = controls.reconciliations || [];
    if (!Array.isArray(reconciliations)) throw new Error("Invalid reconciliations in backup.");
    for (const record of reconciliations) {
      if (!record || !cashAccounts.includes(record.account) || !validDate(record.through) ||
          !Array.isArray(record.outstanding) || !Number.isSafeInteger(record.statement) ||
          (current[record.account] && record.through <= current[record.account].through)) throw new Error("Invalid reconciliation in backup.");
      const results = reconcile(history, record.account, record.through, record.statement, new Set(record.outstanding));
      if (results.difference || results.book !== record.book || results.pending !== record.netOutstanding ||
          record.outstanding.some(id => !results.eligible.some(item => item.row.id === id))) throw new Error("A reconciliation does not match its postings.");
      current[record.account] = record;
    }
    if (!Object.entries(controls.reconciled || {}).every(([account, value]) => JSON.stringify(value) === JSON.stringify(current[account])) ||
        Object.keys(current).length !== Object.keys(controls.reconciled || {}).length) throw new Error("Invalid reconciled balances in backup.");
  }

  root.AutoSheetsAccounting = { accounts, cashAccounts, revenueAccounts, costAccounts, assetAccounts, equityAccounts,
    day, localDate, totals, manualLines, protectHistory, cashMovements, reconcile, validateBackup, validateControls };
})(globalThis);
