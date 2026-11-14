/* Accounting controls and exports for the browser workspace. */
(function (root) {
  "use strict";
  const A = root.AutoSheetsAccounting;
  const B = root.RentalBooks;

  function create(api) {
    const { byId: el, esc, money, hist, custs, rawInventory, load, save, writeHistory, entryLabel, uid, todayISO, printDoc, companyName, download, csvCell, toast, transact } = api;
    const fmt = cents => money(B.amount(cents));
    const decimal = cents => B.amount(cents).toFixed(2);
    const settings = () => load("controls", {});
    const options = accounts => accounts.map(account => '<option value="' + esc(account) + '">' + esc(account) + '</option>').join("");
    const table = (headers, rows) => '<div class="table-wrap"><table class="tbl"><thead><tr>' +
      headers.map(header => '<th scope="col">' + esc(header) + '</th>').join("") + '</tr></thead><tbody>' +
      rows.map(row => '<tr>' + row.map(cell => '<td>' + esc(cell) + '</td>').join("") + '</tr>').join("") +
      '</tbody></table></div>';
    const journalAccounts = A.accounts.filter(account => !["Accounts receivable", "Deposits held"].includes(account));
    const tbHead = ["Account", "Debit", "Credit"];
    const glHead = ["Date", "Reference", "Memo", "Debit", "Credit", "Debit balance"];
    const cfHead = ["Account", "Opening", "Money in", "Money out", "Closing"];
    let pending = new Set();

    function balance() {
      const through = el("tbThrough").value || todayISO();
      const values = A.totals(hist(), custs(), rawInventory(), through);
      const rows = A.accounts.map(account => [account, Math.max(0, values[account] || 0), Math.max(0, -(values[account] || 0))]);
      rows.push(["Total", B.sum(rows, row => row[1]), B.sum(rows, row => row[2])]);
      return { through, rows };
    }

    function ledger() {
      const through = el("tbThrough").value || todayISO();
      const account = el("tbAccount").value;
      const opening = A.totals([], custs(), rawInventory())[account] || 0;
      let running = opening;
      const rows = opening ? [["", "", "Opening balance", Math.max(0, opening), Math.max(0, -opening), opening]] : [];
      hist().filter(row => A.day(row) && A.day(row) <= through).sort((a, b) => A.day(a).localeCompare(A.day(b)) || a.time.localeCompare(b.time)).forEach(row => {
        const lines = B.journal(row).filter(line => line.account === account);
        if (!lines.length) return;
        const dr = B.sum(lines, line => line.dr), cr = B.sum(lines, line => line.cr);
        running += dr - cr;
        rows.push([A.day(row), row.id, row.memo || entryLabel(row), dr, cr, running]);
      });
      return { through, account, rows };
    }

    function showTrial() {
      const book = balance(), account = ledger();
      el("tbOutput").innerHTML = table(tbHead, book.rows.map(([name, dr, cr]) => [name, fmt(dr), fmt(cr)]));
      el("glOutput").innerHTML = account.rows.length ? table(glHead,
        account.rows.map(([day, ref, note, dr, cr, total]) => [day, ref, note, fmt(dr), fmt(cr), fmt(total)])) : '<p class="em">No postings to this account.</p>';
    }

    function showCashMovement() {
      const from = el("cfFrom").value;
      const through = el("cfTo").value || todayISO();
      if (from && from > through) {
        el("cfOutput").textContent = "Choose an end date on or after the start date.";
        return null;
      }
      const rows = A.cashMovements(hist(), from, through);
      const total = rows[0].map((_, index) => index === 0 ? "Total" : B.sum(rows, row => row[index]));
      // Gross inflows/outflows include transfers between tracked accounts.
      rows.push(total);
      el("cfOutput").innerHTML = table(cfHead, rows.map(([account, ...values]) => [account, ...values.map(fmt)])) +
        '<p class="hint">Money in and money out include transfers between tracked accounts.</p>';
      return { from, through, rows };
    }

    function csv(name, heading, headers, rows, moneyFrom) {
      const content = [heading.map(csvCell), headers.map(csvCell), ...rows.map(row => row.map((cell, index) => index < moneyFrom ? csvCell(cell) : decimal(cell)))]
        .map(row => row.join(",")).join("\r\n");
      download(name, new Blob([content], { type: "text/csv;charset=utf-8" }));
    }

    function journalLine() {
      if (el("journalLines").childElementCount >= 12) return;
      const row = document.createElement("div");
      row.className = "journal-line";
      row.innerHTML = '<label>Account<select name="account"><option value="">Select account</option>' + options(journalAccounts) +
        '</select></label><label>Debit<input name="dr" type="number" step="0.01" min="0" max="10000000000"></label>' +
        '<label>Credit<input name="cr" type="number" step="0.01" min="0" max="10000000000"></label>' +
        '<button class="btn btn-s btn-sm" type="button" data-remove-line aria-label="Remove journal line">Remove</button>';
      el("journalLines").append(row);
    }

    function resetJournal() {
      el("journalLines").replaceChildren();
      el("journalForm").reset();
      el("journalDate").value = todayISO();
      journalLine();
      journalLine();
    }

    function postJournal() {
      const postingDate = el("journalDate").value;
      const memo = el("journalMemo").value.trim();
      if (!memo || !postingDate || postingDate > todayISO()) throw new Error("Enter a memo and a posting date on or before today.");
      const lines = A.manualLines([...el("journalLines").children].map(row => ({
        account: row.querySelector("[name=account]").value, dr: row.querySelector("[name=dr]").value, cr: row.querySelector("[name=cr]").value
      })));
      writeHistory([...hist(), { id: uid(), type: "journal", time: new Date().toISOString(), postingDate, memo, lines }]);
      return () => { resetJournal(); render(); toast("Journal posted"); };
    }

    function reverse(id) {
      const rows = hist();
      const old = rows.find(row => row.id === id && row.type === "journal");
      if (!old || old.reversalOf || rows.some(row => row.reversalOf === id)) throw new Error("This journal can no longer be reversed.");
      if (A.day(old) > todayISO()) throw new Error("Choose a date on or after the original posting.");
      writeHistory([...rows, { id: uid(), type: "journal", time: new Date().toISOString(), postingDate: todayISO(), memo: "Reversal · " + old.memo,
        reversalOf: id, lines: old.lines.map(line => ({ account: line.account, dr: line.cr, cr: line.dr })) }]);
      return () => { render(); toast("Reversal posted"); };
    }

    function showJournal() {
      const rows = hist();
      const reversed = new Set(rows.map(row => row.reversalOf).filter(Boolean));
      el("journalPosted").innerHTML = rows.filter(row => row.type === "journal").slice(-15).reverse().map(row =>
        '<div class="li"><strong>' + esc(row.memo) + '</strong><div class="li-sub">' + esc(A.day(row) + " · " + row.id) + '</div>' +
        (row.reversalOf || reversed.has(row.id) ? '<span class="tag">Reversal recorded</span>' :
          '<button type="button" class="btn btn-s btn-sm" data-reverse="' + esc(row.id) + '">Reverse today</button>') + '</div>').join("");
    }

    function reconciliation() {
      const account = el("recAccount").value;
      const through = el("recThrough").value;
      const prior = settings().reconciled?.[account];
      const statement = el("recBalance").value === "" ? null : B.cents(el("recBalance").value);
      const allowed = new Set(prior?.outstanding || []);
      if (!through || !account) return null;
      const result = A.reconcile(hist(), account, through, statement || 0, pending);
      return { ...result, through, account, prior, statement, allowed };
    }

    function showReconciliation(rebuild = true) {
      const r = reconciliation();
      if (!r) { el("recEntries").replaceChildren(); el("recTotals").textContent = ""; return; }
      if (rebuild) {
        const candidates = r.eligible.filter(({ row }) => !r.prior || A.day(row) > r.prior.through || r.allowed.has(row.id));
        el("recEntries").innerHTML = candidates.length ? candidates.slice().reverse().map(({ row, cents }) =>
          '<label class="rec-row"><input type="checkbox" value="' + esc(row.id) + '"' + (pending.has(row.id) ? " checked" : "") +
          '><span>' + esc(A.day(row) + " · " + (row.memo || entryLabel(row) || row.id)) + '</span><strong>' + esc(fmt(cents)) + '</strong></label>').join("") :
          '<p class="em">No unreconciled activity through this date.</p>';
      }
      el("recTotals").textContent = "Book " + fmt(r.book) + " · Outstanding " + fmt(r.pending) +
        (r.statement === null ? "" : " · Difference " + fmt(r.difference));
    }

    function finishReconciliation() {
      const r = reconciliation();
      if (!r || r.statement === null || r.through > todayISO() || (r.prior && r.through <= r.prior.through)) throw new Error("Choose a statement date after the previous reconciliation and on or before today.");
      if (r.difference) throw new Error("The reconciliation difference must be zero.");
      const outstanding = r.eligible.filter(({ row }) => pending.has(row.id)).map(({ row }) => row.id);
      const current = settings();
      const summary = { account: r.account, through: r.through, statement: r.statement, book: r.book, netOutstanding: r.pending, outstanding };
      save("controls", { ...current, reconciled: { ...current.reconciled, [r.account]: summary }, reconciliations: [...(current.reconciliations || []), summary] });
      return () => { resetReconciliation(); render(); toast("Reconciliation completed"); };
    }

    function resetReconciliation() {
      pending = new Set(settings().reconciled?.[el("recAccount").value]?.outstanding || []);
      showReconciliation();
    }

    function closePeriod() {
      const date = el("closeThrough").value;
      const current = settings();
      if (!date || date > todayISO() || date <= (current.closed || "")) throw new Error("Choose a date after the current close and on or before today.");
      if (!confirm("Close postings through " + date + "? Corrections will need a later posting date.")) return;
      save("controls", { ...current, closed: date });
      return () => { render(); toast("Period closed through " + date); };
    }

    function render() {
      showTrial();
      showCashMovement();
      showJournal();
      showReconciliation();
      const current = settings();
      const rec = (current.reconciliations || []).slice().reverse();
      el("recHistory").innerHTML = rec.length ? table(["Account", "Through", "Statement", "Book", "Outstanding"], rec.map(item =>
        [item.account, item.through, fmt(item.statement), fmt(item.book), fmt(item.netOutstanding)])) : "";
      el("closedStatus").textContent = current.closed ? "Postings closed through " + current.closed : "All periods open.";
      const audit = load("audit", []).slice(-100).reverse();
      el("auditOutput").innerHTML = audit.length ? table(["Time", "Change", "Records"], audit.map(item =>
        [new Date(item.time).toLocaleString(), item.action, item.entities.join(", ")])) : '<p class="em">No changes recorded yet.</p>';
    }

    function init() {
      el("tbAccount").innerHTML = options(A.accounts);
      el("recAccount").innerHTML = options(A.cashAccounts);
      ["tbThrough", "recThrough", "closeThrough", "cfTo"].forEach(id => { el(id).value = todayISO(); });
      el("cfFrom").value = todayISO().slice(0, 7) + "-01";
      ["cfFrom", "cfTo"].forEach(id => { el(id).onchange = showCashMovement; });
      el("cfCsv").onclick = () => {
        const r = showCashMovement();
        if (r) csv("autosheets-cash-movements.csv", ["Period", r.from, r.through], cfHead, r.rows, 1);
      };
      resetJournal();
      el("journalAdd").onclick = journalLine;
      el("journalLines").onclick = event => {
        const button = event.target.closest("[data-remove-line]");
        if (button && el("journalLines").childElementCount > 2) button.parentElement.remove();
      };
      el("journalPosted").onclick = event => {
        const button = event.target.closest("[data-reverse]");
        if (button && confirm("Post a reversing journal dated today?")) transact("Reverse journal", () => reverse(button.dataset.reverse));
      };
      el("journalForm").onsubmit = event => { event.preventDefault(); transact("Post journal", postJournal); };
      el("closePeriodForm").onsubmit = event => { event.preventDefault(); transact("Close period", closePeriod); };
      el("reconcileForm").onsubmit = event => { event.preventDefault(); transact("Reconcile account", finishReconciliation); };
      el("tbThrough").onchange = showTrial;
      el("tbAccount").onchange = showTrial;
      el("recThrough").onchange = resetReconciliation;
      el("recAccount").onchange = resetReconciliation;
      el("recBalance").oninput = () => showReconciliation(false);
      el("recEntries").onchange = event => {
        if (event.target.checked) pending.add(event.target.value);
        else pending.delete(event.target.value);
        showReconciliation(false);
      };
      el("tbCsv").onclick = () => { const r = balance(); csv("autosheets-trial-balance.csv", ["Through", r.through], tbHead, r.rows, 1); };
      el("glCsv").onclick = () => { const r = ledger(); csv("autosheets-general-ledger.csv", [r.account, r.through], glHead, r.rows, 3); };
      el("tbPrint").onclick = () => {
        const r = balance();
        printDoc({ title: "Trial balance through " + r.through, html: el("tbOutput").innerHTML, co: companyName() });
      };
    }

    return { init, render, resetReconciliation };
  }

  root.AutoSheetsAccountingUI = { create };
})(globalThis);
