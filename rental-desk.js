/* Rental desk workflow for the installable AutoSheets web app. */
(function (root) {
  "use strict";

  const B = root.RentalBooks;
  const { amount, cents, managed, pending, active, matchesVehicle, rentalPosition } = B;
  const timeNow = () => {
    const date = new Date();
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const eventLabels = {
    "rental-charge": "Additional invoice", "rental-payment": "Invoice payment",
    "deposit-in": "Deposit received", "deposit-out": "Deposit refunded",
    "deposit-apply": "Deposit applied", "rental-credit": "Credit note", "rental-refund": "Invoice payment refunded"
  };
  const chargeTypes = ["Late return", "Excess distance", "Fuel", "Toll / Salik", "Traffic fine", "Parking", "Damage", "Cleaning", "Extension", "Other"];
  const states = { reserved: "Reserved", out: "Checked out", overdue: "Overdue", returned: "Returned", cancelled: "Cancelled" };
  const methodOptions = '<option>Cash</option><option>Card</option><option>Bank transfer</option><option>Other</option>';
  const today = () => timeNow().slice(0, 10);
  const isoNow = () => new Date().toISOString();
  const setDay = value => value.slice(0, 10);
  const stateOf = row => managed(row) ? row.state : row.returned ? "returned" : "out";
  const stateLabel = row => states[stateOf(row)];
  const overdue = row => active(row) && (managed(row) ? row.dueAt < timeNow() : row.due && row.due < today());
  const options = list => list.map(text => '<option>' + text + '</option>').join("");
  const dateTime = value => value ? value.replace("T", " ").slice(0, 16) : "—";
  const textField = (name, label, max = 150) => `<label>${label}<input name="${name}" maxlength="${max}"></label>`;
  const numberField = (name, label, value = "", step = "0.01", min = 0) => `<label>${label}<input name="${name}" type="number" min="${min}" max="10000000" step="${step}" value="${value}" required></label>`;
  const form = (action, fields, label) => `<form data-rent-form="${action}"><div class="rent-grid">${fields}</div><button class="btn btn-p btn-sm" type="submit">${label}</button></form>`;
  const details = (title, content) => `<details><summary>${title}</summary>${content}</details>`;

  function create(api) {
    const { byId: el, esc, money, hist, custs, inv, rates, todayISO, localDay, toast, printDoc, companyName, showPage, download, csvCell } = api;
    const fmt = value => money(amount(value));
    const get = id => el(id).value;
    const intOrNull = value => value === "" ? null : Number(value);
    const customerFor = id => custs().find(customer => customer.id === id);
    const vehicleFor = id => inv().find(vehicle => vehicle.id === id);
    const titleFor = row => row.number || row.id;
    let selected = "";
    let editing = "";

    function amountLine(label, value) {
      return '<tr><th scope="row">' + esc(label) + '</th><td class="r">' + esc(fmt(value)) + '</td></tr>';
    }

    function table(headers, rows) {
      return '<div class="table-wrap"><table class="tbl"><thead><tr>' +
        headers.map(header => '<th scope="col">' + esc(header) + '</th>').join("") +
        '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map(cell => '<td>' + esc(cell) + '</td>').join("") + '</tr>').join("") +
        '</tbody></table></div>';
    }

    function vehicleOptions() {
      const current = get("rVehicle");
      el("rVehicle").innerHTML = '<option value="">Select a rental vehicle</option>' + inv().filter(vehicle => vehicle.type === "Rental" || vehicle.type === "Other").map(vehicle =>
        '<option value="' + esc(vehicle.id) + '">' + esc(api.assetLabel(vehicle)) + '</option>').join("");
      el("rVehicle").value = current;
      if (el("rVehicle").selectedIndex < 0) el("rVehicle").selectedIndex = 0;
    }

    function fillRate() {
      const defaults = rates();
      el("rRate").value = ({ daily: defaults.rentalDaily, weekly: defaults.rentalWeekly, monthly: defaults.rentalMonthly })[get("rBill")];
      preview();
    }

    function baseInvoice() {
      const unitRate = cents(get("rRate"));
      const qty = Number(get("rQty"));
      return B.invoice([{ label: "Rental · " + get("rBill"), qty, rate: unitRate, cents: qty * unitRate }], cents(get("rDiscount")), Number(get("rTax")));
    }

    function preview() {
      try {
        const invoice = baseInvoice();
        el("rPreview").textContent = "Subtotal " + fmt(invoice.net) + " · Tax " + fmt(invoice.tax) + " · Total " + fmt(invoice.gross);
      } catch (error) { el("rPreview").textContent = error.message; }
    }

    function openForm(row) {
      const form = el("rentalForm");
      form.reset();
      editing = row ? row.id : "";
      form.hidden = false;
      el("rFormTitle").textContent = row ? "Edit reservation" : "New reservation";
      api.fillSelects();
      vehicleOptions();
      const now = timeNow();
      const tomorrow = new Date(now + ":00");
      tomorrow.setDate(tomorrow.getDate() + 1);
      const end = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      el("rStart").value = row ? row.start : now;
      el("rDue").value = row ? row.dueAt : end;
      el("rInvoiceDue").value = row ? row.invoiceDue : setDay(end);
      if (row) {
        const fields = { rCust: row.customerId, rVehicle: row.vehicleId, rReference: row.reference, rBill: row.billType, rQty: row.qty, rRate: amount(row.invoice.lines[0].rate), rDiscount: amount(row.invoice.discount), rTax: row.invoice.taxRate, rPickup: row.pickup, rDropoff: row.dropoff, rIncluded: row.includedKm, rKmRate: amount(row.kmRate), rNotes: row.notes };
        Object.entries(fields).forEach(([id, value]) => { el(id).value = value ?? ""; });
      } else {
        fillRate();
        el("rTax").value = api.company().taxRate || 0;
      }
      preview();
      el("rCust").focus();
    }

    function closeForm() {
      el("rentalForm").hidden = true;
      editing = "";
    }

    function checkWindow(rows, vehicle, start, due, except) {
      if (due <= start || !Number.isFinite(new Date(start).getTime()) || !Number.isFinite(new Date(due).getTime())) throw new Error("Return must be later than pickup.");
      if (!vehicle || !["Rental", "Other"].includes(vehicle.type)) throw new Error("Select a rental vehicle.");
      const isOut = rows.some(row => active(row) && matchesVehicle(row, vehicle));
      if (vehicle.status !== "Available" && !(vehicle.status === "Rented" && isOut)) throw new Error("The selected vehicle is unavailable.");
      if ([vehicle.registration, vehicle.insurance].some(expiry => expiry && expiry < setDay(due))) throw new Error("Vehicle registration or insurance expires before the return date.");
      if (B.overlap(rows, vehicle, start, due, except, timeNow())) throw new Error("This vehicle has an overlapping reservation or rental.");
    }

    function persist(rows, message) {
      api.writeHistory(rows);
      return () => { api.refresh(); render(); toast(message); };
    }

    function saveReservation() {
      const rows = hist();
      const old = rows.find(row => row.id === editing);
      if (editing && (!old || old.state !== "reserved")) throw new Error("This reservation can no longer be edited.");
      const vehicle = vehicleFor(get("rVehicle"));
      const start = get("rStart");
      const dueAt = get("rDue");
      checkWindow(rows, vehicle, start, dueAt, editing);
      if (get("rInvoiceDue") < setDay(start)) throw new Error("Invoice due date must be on or after pickup.");
      const name = get("rClient").trim();
      let customer = customerFor(get("rCust"));
      if (name && customer) throw new Error("Choose an existing customer or enter a new customer name.");
      const customers = custs();
      let newCustomer = false;
      if (name) {
        const matches = customers.filter(item => item.name.toLowerCase() === name.toLowerCase());
        if (matches.length) throw new Error("This customer already exists. Select their record.");
        customer = { id: api.uid(), name, opening: 0 };
        newCustomer = true;
      }
      if (!customer) throw new Error("Choose or enter a customer.");
      const invoice = baseInvoice();
      const stamp = isoNow();
      const id = old ? old.id : api.uid();
      const next = {
        ...(old || {}), id, type: "rental", rentalVersion: 1, state: "reserved",
        number: old ? old.number : "RA-" + id.replace(/^E/, ""),
        customerId: customer.id, client: customer.name, phone: customer.phone || "", customerTaxId: customer.taxId || "",
        vehicleId: vehicle.id, vehicle: api.assetLabel(vehicle), plate: vehicle.plate,
        start, dueAt, due: setDay(dueAt), invoiceDue: get("rInvoiceDue"),
        billType: get("rBill"), qty: Number(get("rQty")), invoice,
        reference: get("rReference").trim(), pickup: get("rPickup").trim(), dropoff: get("rDropoff").trim(),
        notes: get("rNotes").trim(), includedKm: intOrNull(get("rIncluded")), kmRate: cents(get("rKmRate")),
        time: old ? old.time : stamp, updatedAt: stamp
      };
      if (old) rows[rows.indexOf(old)] = next;
      else rows.push(next);
      if (newCustomer) api.writeCustomers([...customers, customer]);
      api.writeHistory(rows);
      return () => {
        closeForm();
        selected = id;
        api.refresh();
        render(true);
        toast(old ? "Reservation updated" : "Reservation saved. Check out the vehicle when it leaves.");
      };
    }

    function event(row, type, data) {
      return { id: api.uid(), type, rentalId: row.id, number: titleFor(row), customerId: row.customerId,
        client: row.client, vehicleId: row.vehicleId, vehicle: row.vehicle, time: isoNow(), channelVersion: 1, ...data };
    }

    function charge(row, label, value, note, type = "rental-charge", taxRate = row.invoice.taxRate) {
      const invoice = B.invoice([{ label, qty: 1, rate: value, cents: value }], 0, taxRate);
      return event(row, type, { invoice, due: type === "rental-credit" ? "" : (row.invoiceDue > today() ? row.invoiceDue : today()), note });
    }

    function applyAction(action, id, data) {
      const rows = hist();
      const row = rows.find(record => record.id === id);
      if (!row || !managed(row)) throw new Error("Rental record is unavailable.");
      const getField = key => String(data.get(key) || "").trim();
      const note = getField("note");
      const method = getField("method");
      const value = cents(getField("value"));
      const position = rentalPosition(rows, row);
      const due = position.billed - position.paid;
      const vehicle = vehicleFor(row.vehicleId);
      const next = [];
      let message = "Rental updated";

      if (action === "checkout") {
        if (row.state !== "reserved") throw new Error("Only a reservation can be checked out.");
        const when = timeNow();
        if (row.dueAt <= when) throw new Error("Update the return due time before checkout.");
        checkWindow(rows, vehicle, when, row.dueAt, row.id);
        if (rows.some(other => active(other) && matchesVehicle(other, vehicle))) throw new Error("This vehicle has not been returned.");
        const reading = Number(getField("odo"));
        if (reading < vehicle.odometer) throw new Error("Pickup odometer is below the fleet reading.");
        row.state = "out";
        row.time = isoNow();
        row.checkoutAt = when;
        row.odoOut = reading;
        row.fuelOut = getField("fuel");
        row.conditionOut = note;
        const customer = customerFor(row.customerId);
        if (customer?.licenseExpiry && customer.licenseExpiry < today()) throw new Error("Update the customer’s expired driving licence before checkout.");
        row.customerTaxId = customer?.taxId || row.customerTaxId;
        row.phone = customer?.phone || row.phone;
        row.originalDueAt = row.dueAt;
        row.seller = { ...api.company(), name: companyName() };
        if (value) next.push(event(row, "deposit-in", { cents: value, method, note: "Received at checkout" }));
        const payment = cents(getField("payment"));
        if (payment > row.invoice.gross) throw new Error("Payment exceeds the invoice total.");
        if (payment) next.push(event(row, "rental-payment", { cents: payment, method, note: "Received at checkout" }));
        message = "Vehicle checked out and invoice posted";
      } else if (action === "return") {
        if (row.state !== "out") throw new Error("Only a checked-out vehicle can be returned.");
        const reading = Number(getField("odo"));
        if (reading < row.odoOut || (vehicle && reading < vehicle.odometer)) throw new Error("Return odometer is below the pickup or fleet reading.");
        row.state = "returned";
        row.returnedAt = timeNow();
        row.odoIn = reading;
        row.fuelIn = getField("fuel");
        row.conditionIn = note;
        const excess = row.includedKm === null ? 0 : Math.max(0, reading - row.odoOut - row.includedKm);
        if (excess && row.kmRate) {
          const line = { label: "Excess distance", qty: excess, rate: row.kmRate, cents: excess * row.kmRate };
          next.push(event(row, "rental-charge", { invoice: B.invoice([line], 0, row.invoice.taxRate), due: row.invoiceDue > today() ? row.invoiceDue : today(), note: "Return inspection" }));
        }
        if (value) next.push(charge(row, getField("category"), value, note));
        message = "Return recorded and fleet availability updated";
      } else if (action === "extend") {
        if (row.state !== "out" || !vehicle) throw new Error("The vehicle must be checked out to extend it.");
        const end = getField("end");
        if (end <= row.dueAt || end <= timeNow()) throw new Error("Choose a new due time later than the current due time and now.");
        checkWindow(rows, vehicle, row.dueAt, end, row.id);
        row.dueAt = end;
        row.due = setDay(end);
        if (value) next.push(charge(row, "Extension", value, note));
        message = "Rental extended";
      } else if (action === "cancel") {
        if (row.state !== "reserved") throw new Error("Only a reservation can be cancelled.");
        row.state = "cancelled";
        row.cancelReason = note;
        row.cancelledAt = timeNow();
        message = "Reservation cancelled";
      } else {
        if (pending(row) || value <= 0) throw new Error("Enter a positive amount for an issued rental.");
        if (action === "rental-payment" && value > due) throw new Error("Payment exceeds the open invoice balance.");
        if (action === "deposit-out" && value > position.held) throw new Error("Refund exceeds the deposit held.");
        if (action === "deposit-apply" && value > Math.min(position.held, due)) throw new Error("Applied deposit exceeds the held deposit or invoice balance.");
        if (action === "rental-refund" && value > Math.min(position.paid, -due)) throw new Error("Issue a credit note first. The refund cannot exceed the customer credit.");
        if (action === "rental-charge") next.push(charge(row, getField("category"), value, note, action, Number(getField("tax"))));
        else if (action === "rental-credit") {
          if (!note) throw new Error("Enter a credit note reason.");
          const source = [row, ...position.events].find(item => item.id === getField("document") && item.invoice && item.type !== "rental-credit");
          if (!source) throw new Error("Select the invoice to credit.");
          const credited = position.events.filter(item => item.type === "rental-credit" && item.sourceId === source.id);
          const alreadyNet = B.sum(credited, item => item.invoice.net);
          const alreadyTax = B.sum(credited, item => item.invoice.tax);
          if (alreadyNet + value > source.invoice.net) throw new Error("Credit exceeds this invoice’s remaining subtotal.");
          const credit = charge(row, "Credit note", value, note, action, source.invoice.taxRate);
          credit.sourceId = source.id;
          credit.invoice.tax = Math.round((alreadyNet + value) * source.invoice.taxRate / 100) - alreadyTax;
          credit.invoice.gross = credit.invoice.net + credit.invoice.tax;
          next.push(credit);
        } else {
          next.push(event(row, action, { cents: value, method: action === "deposit-apply" ? "" : method, note }));
        }
        message = eventLabels[action] + " recorded";
      }

      row.updatedAt = isoNow();
      return persist([...rows, ...next], message);
    }

    function formActions(row, position) {
      const value = numberField("value", "Amount", "", "0.01", 0.01);
      const optionalValue = numberField("value", "Charge amount (before tax)", 0);
      const category = '<label>Charge type<select name="category">' + options(chargeTypes) + '</select></label>';
      const method = '<label>Payment method<select name="method">' + methodOptions + '</select></label>';
      const note = textField("note", "Reference or notes");
      const fuel = '<label>Fuel level<select name="fuel">' + options(["Full", "¾", "½", "¼", "Empty", "Not recorded"]) + '</select></label>';
      const vehicle = vehicleFor(row.vehicleId);
      const odo = numberField("odo", "Odometer (km)", Math.max(row.odoOut || 0, vehicle?.odometer || 0), "1");
      const condition = textField("note", "Condition and damage notes", 500);
      if (row.state === "cancelled") return "";
      if (row.state === "reserved") return details("Check out and issue invoice", form("checkout", odo + fuel + condition +
        numberField("value", "Deposit collected", 0) + numberField("payment", "Invoice payment collected", 0) + method, "Confirm checkout")) +
        details("Cancel reservation", form("cancel", textField("note", "Cancellation reason"), "Confirm cancellation"));
      const controls = [];
      if (row.state === "out") {
        controls.push(details("Check in and inspect vehicle", form("return", odo + fuel + condition + category + optionalValue, "Confirm return")));
        controls.push(details("Extend rental", form("extend", '<label>New return due<input name="end" type="datetime-local" required></label>' + optionalValue + note, "Confirm extension")));
      }
      const balance = position.billed - position.paid;
      if (balance > 0) controls.push(details("Record invoice payment", form("rental-payment", value + method + note, "Post payment")));
      controls.push(details("Add charge", form("rental-charge", category + numberField("value", "Amount before tax", "", "0.01", 0.01) +
        `<label>Tax rate (%)<input name="tax" type="number" min="0" max="100" step="0.01" value="${row.invoice.taxRate}" required></label>` + note, "Issue additional invoice")));
      const documents = [row, ...position.events.filter(item => item.type === "rental-charge")];
      const eligible = documents.filter(item => item.invoice.net > B.sum(position.events.filter(credit => credit.sourceId === item.id), credit => credit.invoice.net));
      if (eligible.length) {
        const choices = eligible.map(item => '<option value="' + esc(item.id) + '">' + esc(invoiceNumber(item)) + '</option>').join("");
        controls.push(details("Issue credit note", form("rental-credit", '<label>Invoice to credit<select name="document">' + choices + '</select></label>' +
          numberField("value", "Credit before tax", "", "0.01", 0.01) + textField("note", "Reason"), "Issue credit note")));
      }
      if (balance < 0 && position.paid > 0) controls.push(details("Refund invoice payment", form("rental-refund", value + method + note, "Post payment refund")));
      if (row.state === "out") controls.push(details("Receive security deposit", form("deposit-in", value + method + note, "Post deposit receipt")));
      if (position.held > 0) {
        controls.push(details("Refund security deposit", form("deposit-out", value + method + note, "Post deposit refund")));
        if (balance > 0) controls.push(details("Apply security deposit to balance", form("deposit-apply", value + note, "Apply deposit")));
      }
      return controls.join("");
    }

    function invoiceNumber(row) {
      return (row.type === "rental-credit" ? "CN-" : row.invoice ? "INV-" : "TX-") + row.id.replace(/^E/, "");
    }

    function renderDetail(rows, focus) {
      const box = el("rDetail");
      const row = rows.find(item => item.id === selected);
      box.hidden = !row || !managed(row);
      if (box.hidden) { box.innerHTML = ""; return; }
      const position = rentalPosition(rows, row);
      const documents = position.events.slice().reverse();
      const movements = documents.length ? table(["Date", "Transaction", "Amount", "Method / reference"], documents.map(item => [
        localDay(item.time), eventLabels[item.type], fmt(item.invoice ? item.invoice.gross : item.cents), [item.method, item.note].filter(Boolean).join(" · ")
      ])) : "";
      box.innerHTML = `<article class="card rent-card" id="rSelected" tabindex="-1">
        <div class="li-row"><div><h3 class="st">${esc(titleFor(row))} · ${esc(stateLabel(row))}</h3>
        <strong>${esc(row.client)} · ${esc(row.vehicle)}</strong>
        <div class="li-sub">${esc(dateTime(row.start))} → ${esc(dateTime(row.dueAt))}</div></div>
        <button type="button" class="btn btn-s btn-sm" data-rent-close>Close</button></div>
        <div class="rent-actions">
          <button type="button" class="btn btn-s btn-sm" data-rent-print="agreement">Print agreement</button>
          ${pending(row) ? "" : '<button type="button" class="btn btn-s btn-sm" data-rent-print="invoice">Print invoice</button>'}
          ${row.state === "reserved" ? '<button type="button" class="btn btn-s btn-sm" data-rent-edit>Edit reservation</button>' : ""}
        </div>
        <table class="tbl"><tbody>${amountLine(pending(row) ? "Quoted total" : "Total invoiced after credits", pending(row) ? row.invoice.gross : position.billed)}
          ${amountLine("Payments and applied deposits", position.paid)}${amountLine("Invoice balance", position.billed - position.paid)}${amountLine("Security deposit held", position.held)}</tbody></table>
        ${row.notes ? '<p class="hint">' + esc(row.notes) + '</p>' : ""}
        ${row.cancelReason ? '<p class="hint">Cancellation reason · ' + esc(row.cancelReason) + '</p>' : ""}
        ${formActions(row, position)}
        ${movements ? details("Transaction history", movements + '<div class="rent-actions">' + documents.map(item =>
          '<button class="btn btn-s btn-sm" type="button" data-rent-print="' + esc(item.id) + '">Print ' + esc(invoiceNumber(item)) + '</button>').join("") + '</div>') : ""}
        </article>`;
      if (focus) el("rSelected").focus();
    }

    function renderAvailability() {
      const from = get("rCheckFrom"), to = get("rCheckTo");
      const output = el("rScheduleResult");
      if (!from || !to || from >= to) { output.textContent = "Choose a valid pickup and return window."; return; }
      const rows = hist();
      const availability = inv().filter(vehicle => ["Rental", "Other"].includes(vehicle.type)).map(vehicle => {
        let status = "Available";
        try { checkWindow(rows, vehicle, from, to, ""); }
        catch (error) { status = error.message; }
        const conflicts = rows.filter(row => row.type === "rental" && matchesVehicle(row, vehicle) && B.overlap([row], vehicle, from, to, "", timeNow()));
        return [api.assetLabel(vehicle), status, conflicts.map(row => titleFor(row) + " · " + dateTime(row.dueAt || row.due)).join(", ")];
      });
      output.innerHTML = availability.length ? table(["Vehicle", "Availability", "Conflicting agreements / return due"], availability) : '<p class="em">Add a rental vehicle to check availability.</p>';
    }

    function render(focus) {
      const rows = hist();
      const rentals = rows.filter(row => row.type === "rental").slice().reverse();
      const filter = get("rFilter");
      const query = get("rSearch").trim().toLowerCase();
      el("rMetrics").innerHTML = [
        ["Reservations", rentals.filter(row => stateOf(row) === "reserved").length],
        ["Vehicles out", rentals.filter(active).length],
        ["Overdue", rentals.filter(overdue).length],
        ["Deposits held", money(api.depositsHeld())]
      ].map(([label, value]) => '<div class="mc"><div class="mt">' + esc(label) + '</div><div class="mv">' + esc(value) + '</div></div>').join("");
      const visible = rentals.filter(row => {
        const statusMatches = filter === "all" || (filter === "overdue" ? overdue(row) : stateOf(row) === filter);
        return statusMatches && [titleFor(row), row.reference, row.client, row.vehicle, row.plate].join(" ").toLowerCase().includes(query);
      });
      el("rList").innerHTML = visible.map(row => {
        const outstanding = managed(row) ? rentalPosition(rows, row) : null;
        const figure = outstanding ? (pending(row) ? row.invoice.gross : outstanding.billed - outstanding.paid) : cents(row.total);
        return `<div class="li"><div class="li-row"><div><div class="li-title">${esc(row.client || "Customer")} · ${esc(row.vehicle || "Vehicle")}</div>
          <div class="li-sub">${esc(titleFor(row))} · ${esc(dateTime(row.dueAt || row.due))}</div>
          <span class="tag ${overdue(row) ? "bad" : ""}">${esc(overdue(row) ? "Overdue" : stateLabel(row))}</span></div>
          <div class="li-side"><div class="li-amt">${esc(fmt(figure))}</div><button type="button" class="btn btn-sm btn-s" data-open="${esc(row.id)}">Open</button></div></div></div>`;
      }).join("") || '<p class="em">No rentals match.</p>';
      renderDetail(rows, focus);
      if (!el("rSchedulePanel").hidden) renderAvailability();
    }

    function print(row, key) {
      const position = rentalPosition(hist(), row);
      const agreement = key === "agreement";
      const doc = agreement || key === "invoice" ? row : position.events.find(item => item.id === key);
      if (!doc) return;
      const seller = row.seller || api.company();
      const issued = pending(row) ? null : doc.time;
      const info = [
        ["Agreement", titleFor(row)], ["Document", agreement ? titleFor(row) : invoiceNumber(doc)],
        ["Issued", issued ? localDay(issued) : ""], ["Supplier address", seller.address], ["Supplier tax registration", seller.taxId],
        ["Customer", row.client], ["Customer phone", row.phone], ["Customer tax registration", row.customerTaxId],
        ["Vehicle", row.vehicle], ["Booking reference", row.reference], ["Pickup", dateTime(row.start) + (row.pickup ? " · " + row.pickup : "")],
        ["Return due", dateTime(agreement ? row.dueAt : (row.originalDueAt || row.dueAt)) + (row.dropoff ? " · " + row.dropoff : "")],
        ["Invoice due", doc.type === "rental" ? row.invoiceDue : doc.due], ["Credit against", doc.sourceId ? invoiceNumber([row, ...position.events].find(item => item.id === doc.sourceId) || { id: doc.sourceId }) : ""]
      ];
      if (agreement) info.push(["Status", stateLabel(row)], ["Checkout", dateTime(row.checkoutAt)], ["Return", dateTime(row.returnedAt)],
        ["Pickup inspection", [row.odoOut, row.fuelOut, row.conditionOut].filter(item => item != null && item !== "").join(" · ")],
        ["Return inspection", [row.odoIn, row.fuelIn, row.conditionIn].filter(item => item != null && item !== "").join(" · ")],
        ["Included km", String(row.includedKm ?? "Unlimited")], ["Extra km rate", fmt(row.kmRate)], ["Terms and notes", row.notes]);
      if (doc.method) info.push(["Payment method", doc.method]);
      if (doc.note) info.push(["Notes", doc.note]);
      let html = table(["Field", "Details"], info.filter(([, value]) => value));
      if (doc.invoice) {
        const invoice = doc.invoice;
        html += table(["Description", "Units", "Unit rate", "Amount"], invoice.lines.map(line => [line.label, line.qty, fmt(line.rate), fmt(line.cents)]));
        html += '<table class="tbl"><tbody>' + amountLine("Discount", invoice.discount) + amountLine("Subtotal after discount", invoice.net) +
          amountLine("Tax (" + invoice.taxRate + "%)", invoice.tax) + amountLine("Total", invoice.gross) + "</tbody></table>";
      } else html += '<table class="tbl"><tbody>' + amountLine("Amount", doc.cents) + "</tbody></table>";
      if (agreement) html += '<p>Customer signature ____________________ &nbsp; Staff signature ____________________</p>';
      printDoc({ title: agreement ? "Rental agreement" : doc === row ? "Rental invoice" : eventLabels[doc.type], html, co: seller.name || companyName() });
    }

    function report() {
      const from = get("rrFrom"), to = get("rrTo");
      const all = hist();
      if (from && to && from > to) {
        el("rrBody").innerHTML = '<p class="err" role="alert">Choose an end date on or after the start date.</p>';
        return null;
      }
      const posted = all.filter(row => {
        const day = localDay(row.time);
        return !pending(row) && (!from || day >= from) && (!to || day <= to);
      });
      const financials = posted.filter(row => row.type === "rental" || B.rentalEvent(row) || (row.type === "expense" && (row.vehicleId || row.vehicle)));
      const accounts = B.ledger(financials);
      const vehicles = new Map();
      financials.forEach(row => {
        const vehicle = row.vehicleId || row.vehicle;
        if (!vehicle) return;
        if (!vehicles.has(vehicle)) vehicles.set(vehicle, { label: row.vehicle || vehicle, rows: [] });
        vehicles.get(vehicle).rows.push(row);
      });
      const profit = [...vehicles.values()].map(vehicle => {
        const account = B.ledger(vehicle.rows);
        const income = -(account["Rental income"] || 0);
        const costs = account.Expenses || 0;
        return [vehicle.label, amount(income), amount(costs), amount(income - costs)];
      }).sort((a, b) => a[0].localeCompare(b[0]));
      const rentals = all.filter(row => row.type === "rental" && managed(row) && !pending(row));
      const outstanding = rentals.map(row => ({ row, ...rentalPosition(all, row) })).filter(row => row.billed !== row.paid || row.held);
      const invoiceRows = financials.filter(row => row.invoice).map(row => {
        const sign = row.type === "rental-credit" ? -1 : 1;
        return [localDay(row.time), invoiceNumber(row), row.client, row.invoice.taxRate, amount(sign * row.invoice.net), amount(sign * row.invoice.tax), amount(sign * row.invoice.gross)];
      });
      const totals = [
        ["Rental revenue", amount(-(accounts["Rental income"] || 0))],
        ["Output tax", amount(-(accounts["Output tax"] || 0))],
        ["Recorded vehicle expenses", amount(accounts.Expenses || 0)],
        ["Net rental cash movement", amount(B.sum(root.AutoSheetsAccounting.cashAccounts, account => accounts[account] || 0))],
        ["Net deposit liability movement", amount(-(accounts["Deposits held"] || 0))]
      ];
      const openRows = outstanding.map(({ row, billed, paid, held }) => [titleFor(row), row.client, row.vehicle, amount(billed - paid), amount(held)]);
      const moneyColumns = (rows, start) => rows.map(row => row.map((value, index) => index >= start ? money(value) : value));
      const totalsHtml = table(["Period totals", "Amount"], moneyColumns(totals, 1));
      const profitHead = ["Vehicle", "Rental revenue", "Recorded expenses", "Contribution"];
      const invoiceHead = ["Date", "Invoice / credit", "Customer", "Tax %", "Subtotal", "Tax", "Total"];
      const openHead = ["Agreement", "Customer", "Vehicle", "Invoice balance", "Deposit held"];
      const html = '<p class="hint">Posting dates · ' + esc(from || "Beginning") + ' to ' + esc(to || "Today") + '</p>' + totalsHtml +
        '<h3 class="st">Vehicle contribution</h3>' + table(profitHead, moneyColumns(profit, 1)) +
        '<h3 class="st">Invoice and output tax register</h3>' + table(invoiceHead, moneyColumns(invoiceRows, 4)) +
        '<h3 class="st">Current agreement balances and deposits</h3>' + table(openHead, moneyColumns(openRows, 3));
      el("rrBody").innerHTML = '<div class="card">' + html + '</div>';
      return { html, data: [["Rental report", from, to], ["Period totals", "Amount"], ...totals, [], profitHead, ...profit, [], invoiceHead, ...invoiceRows, [], openHead, ...openRows] };
    }

    function init() {
      el("rNew").onclick = () => openForm();
      el("rDismiss").onclick = closeForm;
      el("rFleet").onclick = () => showPage("inventory");
      el("rCustomers").onclick = () => showPage("customers");
      el("rSchedule").onclick = () => {
        const panel = el("rSchedulePanel");
        panel.hidden = !panel.hidden;
        if (!panel.hidden) { renderAvailability(); el("rCheckFrom").focus(); }
      };
      el("rCheckFrom").value = timeNow();
      el("rCheckTo").value = today() + "T23:59";
      ["rCheckFrom", "rCheckTo"].forEach(id => el(id).onchange = renderAvailability);
      el("rBill").onchange = fillRate;
      ["rQty", "rRate", "rDiscount", "rTax"].forEach(id => el(id).oninput = preview);
      el("rSearch").oninput = () => render();
      el("rFilter").onchange = () => render();
      el("rentalForm").onsubmit = event => { event.preventDefault(); api.transact(editing ? "Edit reservation" : "Create reservation", saveReservation); };
      el("rDetail").addEventListener("submit", event => {
        event.preventDefault();
        const data = new FormData(event.target);
        const id = selected;
        const action = event.target.dataset.rentForm;
        api.transact(eventLabels[action] || ({ checkout: "Check out vehicle", return: "Return vehicle", extend: "Extend rental", cancel: "Cancel reservation" })[action], () => applyAction(action, id, data));
      });
      el("rDetail").addEventListener("click", event => {
        const button = event.target.closest("button");
        if (!button) return;
        const row = hist().find(item => item.id === selected);
        if (!row) return;
        if (button.hasAttribute("data-rent-close")) { selected = ""; render(); }
        if (button.hasAttribute("data-rent-edit")) openForm(row);
        if (button.dataset.rentPrint) print(row, button.dataset.rentPrint);
      });
      el("rrFrom").value = todayISO().slice(0, 7) + "-01";
      el("rrTo").value = todayISO();
      ["rrFrom", "rrTo"].forEach(id => el(id).onchange = report);
      el("rrPrint").onclick = () => {
        const output = report();
        if (output) printDoc({ title: "Rental accounting report", html: output.html, co: companyName() });
      };
      el("rrExport").onclick = () => {
        const output = report();
        if (!output) return;
        const csv = output.data.map(row => row.map(value => typeof value === "number" ? value.toFixed(2) : csvCell(value)).join(",")).join("\r\n");
        download("autosheets-rental-report.csv", new Blob([csv], { type: "text/csv;charset=utf-8" }));
      };
    }

    function open(row) {
      selected = row.id;
      showPage("rental");
      render(true);
    }

    return { init, render, report, open, closeForm, vehicleOptions };
  }

  root.AutoSheetsRental = { create, eventLabels, overdue };
})(globalThis);
