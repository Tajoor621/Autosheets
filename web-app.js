(function () {
  var VERSION = "5.0.0";
  var B = window.RentalBooks;
  var rental;
  var BASE_TITLE = "AutoSheets Accounting — Fleet, Rental, Parking & Taxi Books";
  var Vault = window.AutoSheetsVault;
  var A = window.AutoSheetsAccounting;
  var works = ["company", "customers", "inventory", "history", "rates", "currency", "controls", "audit"];
  var oldKeys = ["users", "pin", "session"].concat(works.slice(0, 6));
  var vaultKey = "autosheets_encrypted_workspace_v1";
  var book = {};
  var unlocked = null;
  var baseline = null;
  var temporary = false;
  var busy = false;
  var pendingLock = false;
  var idleTimer;
  var lastActivity;
  var backupFile;
  var accounting;
  var idleLimit = 10 * 60 * 1000;
  var role = "Fleet Owner";
  var curs = ["USD", "EUR", "AED", "GBP", "SAR", "PKR"];
  var sym = { USD: "$", EUR: "€", AED: "AED ", GBP: "£", SAR: "SAR ", PKR: "Rs " };
  var ci = 0;
  var defRates = { rentalDaily: 85, rentalWeekly: 500, rentalMonthly: 1800, parkHourly: 8, parkDaily: 35, parkWeekly: 150, parkMonthly: 400, taxiComm: 60 };
  var lastFocus = null;
  var subPages = [ "parking", "taxi", "expense", "receipt", "payment", "inventory"];

  function byId(id) { return document.getElementById(id); }
  function save(k, v) { book[k] = v; }
  function load(k, f) { return Object.hasOwn(book, k) ? structuredClone(book[k]) : f; }
  function legacy(k, fallback) {
    try { return JSON.parse(localStorage.getItem("as_" + k)) ?? fallback; }
    catch (_) { return fallback; }
  }
  function existingLegacy() {
    return works.slice(0, 6).some(function (key) { return localStorage.getItem("as_" + key) !== null; });
  }
  function cleanLegacy() { oldKeys.forEach(function (key) { localStorage.removeItem("as_" + key); }); }
  function syncCurrency() {
    var ix = curs.indexOf(load("currency", "USD"));
    ci = ix >= 0 ? ix : 0;
    setCurLabel();
  }
  function redraw() {
    syncCurrency();
    byId("hdrCo").textContent = companyName();
    if (appOpen()) {
      fillSelects(); refreshAll(); renderReports();
      showPage(pageFromHash() || "dashboard", { silentHash: true, keepFocus: true });
    }
  }
  async function withLock(action) {
    if (navigator.locks) return navigator.locks.request("autosheets-books", action);
    return action();
  }
  async function transact(action, change) {
    if (busy || !appOpen()) return;
    busy = true;
    var previous = structuredClone(book);
    try {
      await withLock(async function () {
        if (!temporary && localStorage.getItem(vaultKey) !== baseline) throw new Error("The workspace changed in another tab. Lock and unlock to reload.");
        var afterCommit = change();
        var affected = [...works, "role"].filter(function (key) { return JSON.stringify(book[key]) !== JSON.stringify(previous[key]); });
        if (affected.length) {
          if (action !== "Restore backup") {
            var changed = [];
            if (affected.includes("history")) {
              var oldRows = new Map((previous.history || []).map(function (row) { return [row.id, JSON.stringify(row)]; }));
              (book.history || []).forEach(function (row) {
                if (oldRows.get(row.id) !== JSON.stringify(row)) changed.push(row.id);
                oldRows.delete(row.id);
              });
              changed.push(...oldRows.keys());
            }
            book.audit = [...(previous.audit || []), { time: new Date().toISOString(), action,
              entities: [...affected.filter(function (key) { return key !== "audit"; }), ...changed.slice(0, 12)] }];
          }
          if (!temporary) {
            var next = JSON.stringify(await Vault.seal(unlocked.key, unlocked.salt, book));
            if (localStorage.getItem(vaultKey) !== baseline) throw new Error("The workspace changed in another tab. Lock and unlock to reload.");
            localStorage.setItem(vaultKey, next);
            baseline = next;
          }
        }
        if (typeof afterCommit === "function") {
          try { afterCommit(); } catch (_) { toast("Saved. Reopen this page to refresh the display.", "err"); }
        }
      });
    } catch (error) {
      book = previous;
      try { redraw(); } catch (_) {}
      toast(error.message || "The change could not be saved.", "err");
    } finally {
      busy = false;
      if (pendingLock) doLogout();
    }
  }
  function rates() { return load("rates", defRates); }
  function hist() { return load("history", []); }
  function custs() { return load("customers", []); }
  function rawInventory() { return load("inventory", []); }
  function inv() {
    var rows = hist().filter(function (row) { return row.type === "rental"; });
    return rawInventory().map(function (asset) {
      var matches = rows.filter(function (row) { return B.matchesVehicle(row, asset); });
      var busy = matches.some(B.active);
      var odometer = Math.max.apply(null, [Number(asset.odometer) || 0].concat(matches.map(function (row) {
        return Math.max(Number(row.odoOut) || 0, Number(row.odoIn) || 0);
      })));
      return Object.assign({}, asset, { status: busy ? "Rented" : asset.status, odometer: odometer });
    });
  }
  function assignPostingDates(rows) {
    return rows.map(function (row) {
      return row.postingDate || !B.journal(row).length ? row : { ...row, postingDate: A.day(row) };
    });
  }
  function writeHistory(rows) {
    rows = assignPostingDates(rows);
    A.protectHistory(hist(), rows, load("controls", {}));
    save("history", rows);
  }
  function writeCustomers(rows) { save("customers", rows); }
  function company() { return load("company", {}); }
  function cur() { return curs[ci]; }
  function money(n) { return (sym[cur()] || (cur() + " ")) + (Number(n) || 0).toFixed(2); }
  function uid() {
    return "E" + Date.now() + "_" + Array.from(crypto.getRandomValues(new Uint8Array(6)), function (n) { return n.toString(16).padStart(2, "0"); }).join("");
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function localDay(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function companyName() {
    var co = load("company", { name: "AutoSheets" });
    return (co && co.name) || "AutoSheets";
  }
  function assetLabel(a) { return (a.name || "") + " - " + (a.plate || ""); }
  function toast(msg, type) {
    var el = byId("toast");
    el.textContent = msg;
    el.className = "toast show" + (type === "err" ? " err" : "");
    el.setAttribute("aria-live", type === "err" ? "assertive" : "polite");
    clearTimeout(window._tt);
    window._tt = setTimeout(function () { el.className = "toast"; }, 2400);
  }
  function appOpen() {
    return !byId("mainApp").hidden;
  }
  function markRoles(group) {
    var bs = document.querySelectorAll(group + " .rb");
    for (var i = 0; i < bs.length; i++) {
      var on = bs[i].getAttribute("data-role") === role;
      bs[i].classList.toggle("sel", on);
      bs[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
  }
  function selectRole(el, group) {
    role = el.getAttribute("data-role");
    markRoles(group);
  }
  function setCurLabel() {
    byId("curCode").textContent = cur();
    byId("sCur").textContent = cur();
    byId("bookCur").textContent = cur();
    byId("btnCur").setAttribute("aria-label", "Book currency " + cur() + ". Activate to switch currency.");
  }
  function cycleCur() {
    if (hist().some(function (row) { return B.journal(row).length; }) || custs().some(function (row) { return B.cents(row.opening); }) || rawInventory().some(function (row) { return B.cents(row.value); }) || load("controls", {}).closed) {
      toast("Book currency is fixed once balances, postings or a period close exist", "err");
      return;
    }
    ci = (ci + 1) % curs.length;
    save("currency", cur());
    return redraw;
  }
  function focusHeading(pageEl) {
    var heading = pageEl.querySelector("h2");
    if (!heading) return;
    heading.setAttribute("tabindex", "-1");
    heading.focus();
    byId("skipLink").setAttribute("href", "#" + heading.id);
  }
  function showPage(name, opts) {
    opts = opts || {};
    var pages = document.querySelectorAll("#mainApp .page");
    for (var i = 0; i < pages.length; i++) pages[i].classList.remove("active");
    var p = byId("page-" + name);
    if (!p) { name = "dashboard"; p = byId("page-dashboard"); }
    p.classList.add("active");
    var nis = document.querySelectorAll(".ni");
    for (var j = 0; j < nis.length; j++) {
      var dp = nis[j].getAttribute("data-p");
      var on = dp === name || (subPages.indexOf(name) >= 0 && dp === "dashboard");
      nis[j].classList.toggle("active", on);
      if (on) nis[j].setAttribute("aria-current", "page");
      else nis[j].removeAttribute("aria-current");
    }
    if (name === "customers") renderCust();
    if (name === "inventory") renderInv();
    if (name === "daybook") renderDaybook();
    if (name === "reports") renderReports();
    if (name === "settings") updSettings();
    if (name === "dashboard") refreshAll();
    if (name === "rental") { fillSelects(); rental.render(); }
    if (["parking", "taxi", "receipt", "expense"].indexOf(name) >= 0) { fillSelects(); applyRates(); }
    if (!opts.silentHash) {
      var next = "#" + name;
      if (location.hash !== next) {
        if (opts.replaceHash) history.replaceState({ page: name }, "", next);
        else history.pushState({ page: name }, "", next);
      }
    }
    if (!opts.keepFocus) focusHeading(p);
  }
  function pageFromHash() {
    var h = (location.hash || "").replace(/^#/, "").toLowerCase().split("&")[0].split("?")[0];
    var map = { home: "dashboard", ledger: "daybook", clients: "customers", fleet: "inventory", statement: "reports" };
    if (map[h]) h = map[h];
    var allowed = ["dashboard", "customers", "daybook", "reports", "settings", "rental", "parking", "taxi", "expense", "receipt", "payment", "inventory"];
    return allowed.indexOf(h) >= 0 ? h : null;
  }
  function enterApp(email) {
    role = load("role", "Fleet Owner");
    byId("roleBadge").textContent = temporary ? "Temporary workspace" : "Encrypted workspace";
    syncCurrency();
    activity();
    byId("sEmail").textContent = email;
    byId("sRole").textContent = role;
    markRoles("#setRoles");
    byId("page-login").hidden = true;
    byId("mainApp").hidden = false;
    document.body.classList.add("app-on");
    var name = companyName();
    byId("sCo").textContent = name;
    byId("hdrCo").textContent = name;
    byId("coName").value = name === "AutoSheets" ? (load("company", {}).name || "") : name;
    if (!load("company", null)) byId("coName").value = "";
    document.title = name + " — AutoSheets Accounting";
    byId("skipLink").textContent = "Skip to content";
    byId("sVer").textContent = VERSION;
    byId("vaultStatus").textContent = temporary ? "Temporary workspace. Changes are discarded when it closes." : "This workspace is encrypted on this browser.";
    byId("changePassDetails").hidden = temporary;
    byId("btnExport").disabled = temporary;
    byId("importFile").disabled = temporary;
    accounting.resetReconciliation();
    fillSelects();
    applyRates();
    refreshAll();
    showPage(pageFromHash() || "dashboard", { replaceHash: true });
  }
  function showLoginError(msg) {
    var el = byId("loginError");
    el.textContent = msg;
    el.hidden = false;
    byId("loginPassword").setAttribute("aria-invalid", "true");
  }
  function landing() {
    var saved = localStorage.getItem(vaultKey) !== null;
    var migrate = !saved && existingLegacy();
    byId("vaultTitle").textContent = saved ? "Unlock your workspace" : migrate ? "Protect your existing books" : "Create an encrypted workspace";
    byId("loginHint").textContent = saved ? "Enter the passphrase for this browser’s workspace." : migrate ?
      "Create a new passphrase to encrypt the books already saved in this browser." :
      "Your books stay on this device. Use a passphrase of at least 14 characters.";
    byId("btnLogin").textContent = saved ? "Unlock workspace" : migrate ? "Encrypt existing books" : "Create workspace";
    ["vaultOwnerLabel", "loginEmail", "vaultConfirmWrap"].forEach(function (id) { byId(id).hidden = saved; });
    byId("vaultConfirm").required = !saved;
    byId("loginPassword").autocomplete = saved ? "current-password" : "new-password";
    byId("btnDemo").hidden = saved || migrate;
  }
  async function doLogin() {
    if (busy) return;
    byId("loginError").hidden = true;
    byId("loginPassword").removeAttribute("aria-invalid");
    var pass = byId("loginPassword").value;
    var repeat = byId("vaultConfirm").value;
    busy = true;
    byId("btnLogin").disabled = true;
    byId("btnDemo").disabled = true;
    try {
      await withLock(async function () {
        var saved = localStorage.getItem(vaultKey);
        if (saved) {
          var result = await Vault.open(JSON.parse(saved), pass);
          if (localStorage.getItem(vaultKey) !== saved) throw new Error("The workspace changed. Try unlocking again.");
          unlocked = { key: result.key, salt: result.salt };
          book = result.data;
          baseline = saved;
        } else {
          if (pass !== repeat) throw new Error("The passphrases do not match.");
          var data = {};
          works.slice(0, 6).forEach(function (key) {
            var value = legacy(key, null);
            if (value !== null) data[key] = value;
          });
          var previousSession = legacy("session", {});
          data.owner = byId("loginEmail").value.trim() || previousSession.email || "Owner";
          data.role = previousSession.role || "Fleet Owner";
          data.audit = [{ time: new Date().toISOString(), action: existingLegacy() ? "Encrypted existing books" : "Created workspace", entities: [] }];
          A.validateBackup(data.history || []);
          if (data.history) data.history = assignPostingDates(data.history);
          var created = await Vault.create(pass, data);
          var next = JSON.stringify(created.box);
          if (localStorage.getItem(vaultKey) !== null) throw new Error("A workspace was created in another tab. Reload to unlock it.");
          localStorage.setItem(vaultKey, next);
          unlocked = { key: created.key, salt: created.salt };
          book = data;
          baseline = next;
        }
        cleanLegacy();
        byId("loginForm").reset();
        enterApp(book.owner || "Owner");
      });
    } catch (error) { showLoginError(error.message || "Could not open the workspace."); }
    finally {
      busy = false;
      byId("btnLogin").disabled = false;
      byId("btnDemo").disabled = false;
    }
  }
  function activity() {
    if (!appOpen()) return;
    lastActivity = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(doLogout, idleLimit);
  }
  function doLogout() {
    if (!appOpen()) return;
    if (busy) { pendingLock = true; return; }
    clearTimeout(idleTimer);
    unlocked = null;
    book = {};
    backupFile = null;
    // Reload replaces the rendered document and clears form and report contents.
    location.reload();
  }
  async function rotatePassphrase() {
    if (busy || !unlocked || temporary) return;
    var current = byId("rotateCurrent").value;
    var nextPass = byId("rotateNew").value;
    if (nextPass !== byId("rotateAgain").value) { toast("The new passphrases do not match.", "err"); return; }
    busy = true;
    try {
      await withLock(async function () {
        await Vault.open(JSON.parse(baseline), current);
        var data = { ...book, audit: [...(book.audit || []), { time: new Date().toISOString(), action: "Changed passphrase", entities: [] }] };
        var next = await Vault.create(nextPass, data);
        if (localStorage.getItem(vaultKey) !== baseline) throw new Error("The workspace changed in another tab. Unlock again.");
        var serialized = JSON.stringify(next.box);
        localStorage.setItem(vaultKey, serialized);
        baseline = serialized;
        book = data;
        unlocked = { key: next.key, salt: next.salt };
        byId("rotateForm").reset();
        byId("changePassDetails").open = false;
        toast("Passphrase changed. Download a new encrypted backup.");
      });
    } catch (error) { toast(error.message, "err"); }
    finally { busy = false; if (pendingLock) doLogout(); }
  }
  function custNameById(id) {
    var cs = custs();
    for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i].name;
    return "";
  }
  function setOptions(id, html) {
    var el = byId(id);
    if (!el) return;
    var prev = el.value;
    el.innerHTML = html;
    if (prev) el.value = prev;
    if (el.selectedIndex < 0) el.selectedIndex = 0;
  }
  function fillSelects() {
    var cs = custs();
    var is = inv();
    var cOpt = '<option value="">— Select —</option>';
    for (var i = 0; i < cs.length; i++) cOpt += '<option value="' + esc(cs[i].id) + '">' + esc(cs[i].name) + "</option>";
    ["rCust", "pCust", "rcCust", "stmtCust"].forEach(function (id) { setOptions(id, cOpt); });
    var tOpt = "";
    var eOpt = '<option value="">— None —</option>';
    if (!is.length) {
      tOpt = '<option value="">Add taxi assets</option>';
    } else {
      for (var j = 0; j < is.length; j++) {
        var a = is[j];
        var lab = assetLabel(a);
        eOpt += '<option value="' + esc(a.id) + '">' + esc(lab) + "</option>";
        if (a.type === "Taxi") tOpt += '<option value="' + esc(lab) + '">' + esc(lab) + "</option>";
      }
      if (!tOpt) tOpt = '<option value="">Add taxi assets</option>';
    }
    rental.vehicleOptions();
    setOptions("tVehicle", tOpt);
    setOptions("eVehicle", eOpt);
  }
  function ensureOption(select, value) {
    if (!select || !value) return;
    var found = false;
    for (var i = 0; i < select.options.length; i++) if (select.options[i].value === value) found = true;
    if (!found) {
      var o = document.createElement("option");
      o.value = value;
      o.textContent = value;
      select.appendChild(o);
    }
    select.value = value;
  }
  function updateAsset(matchFn, mutate) {
    var list = rawInventory();
    for (var i = 0; i < list.length; i++) {
      if (matchFn(list[i])) {
        mutate(list[i]);
        save("inventory", list);
        return true;
      }
    }
    return false;
  }
  function depositsHeld() {
    return B.amount(-(B.ledger(hist())["Deposits held"] || 0));
  }
  function isOverdue(row) { return row.type === "rental" && AutoSheetsRental.overdue(row); }
  function fleetDocumentAlerts(asset) {
    var limit = new Date(todayISO() + "T12:00");
    limit.setDate(limit.getDate() + 30);
    return [["Registration", asset.registration], ["Insurance", asset.insurance]].filter(function (item) {
      return item[1] && item[1] <= localDay(limit);
    }).map(function (item) { return item[0] + " " + (item[1] < todayISO() ? "expired" : "expires") + " " + item[1]; });
  }
  function serviceDue(a) {
    if (!a) return false;
    if (a.nextService && a.nextService <= todayISO()) return true;
    if (Number(a.serviceAt) > 0 && Number(a.odometer) >= Number(a.serviceAt)) return true;
    return false;
  }
  function calc() {
    var rows = hist().filter(function (row) { return !B.pending(row); });
    var customers = custs();
    var t = sumEntries(rows);
    var balances = B.receivables(rows, customers);
    t.ar = B.amount(balances.due);
    t.advances = B.amount(balances.advances);
    t.cash = B.amount(B.sum(A.cashAccounts, function (account) { return t.accounts[account] || 0; }));
    t.tax = B.amount(-(t.accounts["Output tax"] || 0));
    t.invVal = B.amount(B.sum(inv(), function (asset) { return B.cents(asset.value); }) + (t.accounts["Fleet assets"] || 0));
    t.otherAssets = B.amount((t.accounts["Other assets"] || 0) + (t.accounts["Prepaid expenses"] || 0));
    t.payable = B.amount(-(t.accounts["Accounts payable"] || 0));
    t.equity = B.amount(B.sum(custs(), function (row) { return B.cents(row.opening); }) +
      B.sum(rawInventory(), function (row) { return B.cents(row.value); }) -
      B.sum(A.equityAccounts, function (account) { return t.accounts[account] || 0; }));
    return t;
  }
  function sumEntries(list) {
    var accounts = B.ledger(list);
    var read = function (key, sign) { return (accounts[key] || 0) * sign; };
    var R = read("Rental income", -1), P = read("Parking income", -1), T = read("Taxi income", -1);
    var Rc = read("Other income", -1), E = read("Expenses", 1) + read("Depreciation expense", 1), Pay = read("Payments / costs", 1);
    return { accounts: accounts, R: B.amount(R), P: B.amount(P), T: B.amount(T), Rc: B.amount(Rc),
      E: B.amount(E), Pay: B.amount(Pay), income: B.amount(R + P + T + Rc), expense: B.amount(E + Pay),
      net: B.amount(R + P + T + Rc - E - Pay), n: list.length };
  }
  function entryLabel(r) {
    if (r.type === "journal") return r.memo;
    if (B.managed(r)) return [r.number, r.client, r.vehicle].filter(Boolean).join(" · ");
    if (B.rentalEvent(r)) return [AutoSheetsRental.eventLabels[r.type], r.number, r.client, r.note].filter(Boolean).join(" · ");
    if (r.type === "rental") return [r.client, r.vehicle, ((r.qty || "") + " " + (r.billType || "")).trim()].filter(Boolean).join(" · ");
    if (r.type === "parking") return [r.plate, r.bay, r.tariff].filter(Boolean).join(" · ");
    if (r.type === "taxi") return [r.driverName, r.vehicle].filter(Boolean).join(" · ") || "Fare";
    if (r.type === "expense") return [r.cat, r.vehicle, r.note].filter(Boolean).join(" · ");
    if (r.type === "receipt") return r.note || r.client || "Receipt";
    if (r.type === "payment") return r.payee || r.note || "Payment";
    return "";
  }
  function entryNumber(r) {
    if (r.type === "journal") return B.amount(B.sum(r.lines, function (line) { return line.dr; }));
    if (r.invoice) return B.amount(r.invoice.gross) * (r.type === "rental-credit" ? -1 : 1);
    if (B.rentalEvent(r)) return B.amount(r.cents);
    if (r.type === "rental") return Number(r.total) || 0;
    if (r.type === "parking") return Number(r.amount) || 0;
    if (r.type === "taxi") return Number(r.fare) || 0;
    return Number(r.amt) || 0;
  }
  function entryAmt(r) { return money(entryNumber(r)); }
  function tags(r) {
    var html = "";
    if (r.type === "rental" && (r.returned || r.state === "returned")) html += '<span class="tag">Returned</span>';
    else if (isOverdue(r)) html += '<span class="tag bad">Overdue</span>';
    if ((!B.managed(r) && r.type === "rental") || r.type === "parking") html += r.paid ? '<span class="tag ok">Paid</span>' : '<span class="tag warn">On account</span>';
    if (r.type === "rental" && Number(r.deposit) > 0 && !r.depositReturned) html += '<span class="tag">Deposit</span>';
    if (r.type === "taxi") html += '<span class="tag">Split</span>';
    return html ? '<div>' + html + "</div>" : "";
  }
  function entryDC(row) {
    var lines = B.journal(row);
    return { dr: B.amount(B.sum(lines, function (line) { return line.dr; })), cr: B.amount(B.sum(lines, function (line) { return line.cr; })) };
  }
  function postedHistory() { return hist().filter(function (row) { return !B.pending(row); }); }
  function renderAttention() {
    var box = byId("attention");
    var items = [];
    hist().forEach(function (r) {
      if (isOverdue(r)) items.push('<button type="button" class="linkish" data-open="' + esc(r.id) + '">Overdue rental · ' + esc(r.client || "Client") + " · due " + esc(r.due) + "</button>");
    });
    inv().forEach(function (a) {
      fleetDocumentAlerts(a).forEach(function (alert) {
        items.push('<button type="button" class="linkish" data-asset="' + esc(a.id) + '">' + esc(alert + " · " + a.plate) + '</button>');
      });
      if (serviceDue(a)) items.push('<button type="button" class="linkish" data-asset="' + esc(a.id) + '">Service due · ' + esc(a.name) + " · " + esc(a.plate) + "</button>");
    });
    if (!items.length) { box.hidden = true; byId("attentionList").innerHTML = ""; return; }
    box.hidden = false;
    byId("attentionList").innerHTML = items.join("");
  }
  function renderTrend(rows) {
    var month = todayISO().slice(0, 7);
    var series = Array.from({ length: 6 }, function (_, i) {
      var key = shiftMonth(month, i - 5);
      var label = new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit" }).format(new Date(key + "-01T12:00"));
      return [label, sumEntries(rows.filter(function (row) { return monthOf(row) === key; })).net];
    });
    var max = Math.max(1, ...series.map(function (item) { return Math.abs(item[1]); }));
    byId("dashboardTrend").innerHTML = series.map(function ([label, value]) {
      var fill = Math.round(100 * Math.abs(value) / max);
      return '<div class="trends-row"><span>' + esc(label) + '</span><progress aria-hidden="true" class="trends-track' +
        (value < 0 ? " negative" : "") + '" max="100" value="' + fill + '"></progress><strong>' + esc(money(value)) + '</strong></div>';
    }).join("");
  }
  function refreshAll() {
    var t = calc();
    renderTrend(postedHistory());
    byId("totalRev").textContent = money(t.income);
    byId("bookCur").textContent = cur();
    var bits = [["rental", "Rentals", t.R], ["parking", "Parking", t.P], ["taxi", "Taxis", t.T], ["other", "Other income", t.Rc]];
    byId("revBreak").innerHTML = bits.map(function (b) {
      return '<span><span class="dot dot-' + b[0] + '"></span>' + b[1] + " " + esc(money(b[2])) + "</span>";
    }).join("");
    byId("mRecv").textContent = money(t.ar);
    byId("mRec").textContent = String(t.n);
    byId("mExp").textContent = money(t.expense);
    byId("mNet").textContent = money(t.net);
    byId("mNet").classList.toggle("negative-balance", t.net < 0);
    byId("mCash").textContent = money(t.cash);
    byId("mDep").textContent = money(depositsHeld());
    var assets = inv();
    var busy = 0;
    var overdue = 0;
    hist().forEach(function (r) { if (isOverdue(r)) overdue += 1; });
    assets.forEach(function (a) { if (a.status === "Rented" || a.status === "On Trip" || a.status === "Occupied") busy += 1; });
    byId("mUtil").textContent = assets.length ? Math.round(100 * busy / assets.length) + "%" : "—";
    byId("mUtilNote").textContent = assets.length ? (busy + " of " + assets.length + " in use") : "Add fleet assets";
    byId("mOver").textContent = String(overdue);
    byId("mOver").classList.toggle("negative-balance", overdue > 0);
    var day = todayISO();
    var todays = postedHistory().filter(function (r) { return A.day(r) === day; });
    var ts = sumEntries(todays);
    if (!ts.n) byId("todayBreak").textContent = "No entries yet today.";
    else byId("todayBreak").innerHTML = "<span>Income " + esc(money(ts.income)) + "</span><span>Expenses " + esc(money(ts.expense)) + "</span><span>Net " + esc(money(ts.net)) + "</span><span>" + ts.n + (ts.n === 1 ? " entry" : " entries") + "</span>";
    renderAttention();
    var list = postedHistory().reverse().slice(0, 10);
    var box = byId("recentList");
    if (!list.length) { box.innerHTML = '<p class="em">No entries yet. Post a rental, parking ticket, taxi fare, or expense.</p>'; return; }
    box.innerHTML = list.map(function (r) {
      return '<div class="li" data-id="' + esc(r.id) + '"><div class="li-row"><div><div class="li-title">' + esc(String(r.type || "").toUpperCase()) + '</div><div class="li-sub">' + esc(entryLabel(r)) + "</div>" + tags(r) + '</div><div class="li-side"><div class="li-amt">' + esc(entryAmt(r)) + '</div><button type="button" class="btn btn-sm btn-s edit-btn">View / Edit</button></div></div></div>';
    }).join("");
  }
  function findEntry(id) {
    var h = hist();
    for (var i = 0; i < h.length; i++) if (h[i].id === id) return h[i];
    return null;
  }
  function focusables(root) {
    return Array.prototype.filter.call(root.querySelectorAll("button, input, select, textarea, a[href]"), function (el) {
      if (el.disabled || el.type === "hidden" || el.closest("[hidden]")) return false;
      return true;
    });
  }
  function openModal() {
    lastFocus = document.activeElement;
    var modal = byId("editModal");
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    byId("editAmt").focus();
  }
  function closeModal() {
    var modal = byId("editModal");
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function openEdit(id) {
    var r = findEntry(id);
    if (!r) return;
    if (r.type === "journal") { showPage("reports"); selectTab("books"); return; }
    if (B.managed(r)) { rental.open(r); return; }
    if (B.rentalEvent(r)) { var agreement = findEntry(r.rentalId); if (agreement) rental.open(agreement); return; }
    byId("editId").value = id;
    byId("editRef").value = r.id || "";
    byId("editType").value = r.type || "";
    byId("editDate").value = A.day(r) + (r.time ? " " + (new Date(r.time).toLocaleTimeString() || "") : "");
    byId("editAmt").value = r.total || r.amount || r.fare || r.amt || 0;
    if (r.type === "expense") byId("editNote").value = r.note || "";
    else if (r.type === "payment") byId("editNote").value = r.payee || r.note || "";
    else byId("editNote").value = r.client || r.plate || r.note || "";
    byId("editPaid").value = r.paid ? "1" : "0";
    var extra = byId("editExtra");
    extra.hidden = r.type !== "rental";
    if (r.type === "rental") {
      byId("editDue").value = r.due || "";
      byId("editDep").value = r.deposit || 0;
      byId("editDepBack").value = r.depositReturned ? "1" : "0";
      byId("editReturned").value = r.returned ? "1" : "0";
    }
    openModal();
  }
  function saveEdit() {
    var id = byId("editId").value;
    var row = findEntry(id);
    if (!row || B.managed(row) || B.rentalEvent(row) || row.type === "journal") return;
    var amt = Number(byId("editAmt").value);
    if (!Number.isFinite(amt) || amt < 0) throw new Error("Enter a valid amount.");
    var note = byId("editNote").value;
    var paid = byId("editPaid").value === "1";
    var h = hist();
    for (var i = 0; i < h.length; i++) {
      if (h[i].id !== id) continue;
      var t = h[i].type;
      var wasReturned = !!h[i].returned;
      if (t === "rental") {
        h[i].total = amt; h[i].client = note; h[i].paid = paid;
        h[i].due = byId("editDue").value || "";
        h[i].deposit = Number(byId("editDep").value) || 0;
        h[i].depositReturned = byId("editDepBack").value === "1";
        h[i].returned = byId("editReturned").value === "1";
        if (!h[i].returned && wasReturned && inv().some(function (vehicle) {
          return B.matchesVehicle(h[i], vehicle) && B.overlap(h, vehicle, new Date().toISOString().slice(0, 16), "9999-12-31T23:59", id, new Date().toISOString().slice(0, 16));
        })) { toast("This vehicle has another rental or reservation", "err"); return; }
        if (h[i].vehicle && h[i].returned !== wasReturned) {
          updateAsset(function (a) { return assetLabel(a) === h[i].vehicle; }, function (a) {
            a.status = h[i].returned ? "Available" : "Rented";
          });
        }
      } else if (t === "parking") { h[i].amount = amt; h[i].plate = note; h[i].paid = paid; }
      else if (t === "taxi") {
        var oldFare = Number(h[i].fare) || 0;
        var ratio = oldFare ? (Number(h[i].driver) || 0) / oldFare : 0.6;
        h[i].fare = amt;
        h[i].driver = Math.round(amt * ratio * 100) / 100;
        h[i].owner = Math.round((amt - h[i].driver) * 100) / 100;
      }
      else if (t === "expense") { h[i].amt = amt; h[i].note = note; }
      else if (t === "receipt") { h[i].amt = amt; h[i].note = note; }
      else if (t === "payment") { h[i].amt = amt; h[i].payee = note; h[i].note = note; }
      break;
    }
    writeHistory(h);
    closeModal();
    refreshAll();
    renderDaybook();
    renderReports();
    toast("Entry updated");
  }
  function deleteEdit() {
    if (!confirm("Delete this entry?")) return;
    var id = byId("editId").value;
    var row = findEntry(id);
    if (!row || B.managed(row) || B.rentalEvent(row) || row.type === "journal") return;
    var remaining = hist().filter(function (x) { return x.id !== id; });
    if (row && row.type === "rental" && !B.managed(row) && B.active(row)) {
      updateAsset(function (asset) { return B.matchesVehicle(row, asset); }, function (asset) {
        if (asset.status === "Rented") asset.status = "Available";
      });
    }
    writeHistory(remaining);
    closeModal();
    refreshAll();
    renderDaybook();
    renderReports();
    toast("Entry deleted");
  }
  function renderDaybook() {
    var f = byId("dbFilter").value;
    var q = (byId("dbSearch").value || "").trim().toLowerCase();
    var list = postedHistory().reverse();
    if (f !== "all") list = list.filter(function (x) { return x.type === f || (f === "rental" && B.rentalEvent(x)); });
    if (q) {
      list = list.filter(function (r) {
        var blob = [r.type, entryLabel(r), r.note, r.vehicle, r.payee, r.cat, r.client, r.plate, r.id].join(" ").toLowerCase();
        return blob.indexOf(q) >= 0;
      });
    }
    var box = byId("daybookList");
    if (!list.length) { box.innerHTML = '<p class="em">No entries match.</p>'; return; }
    var h = '<div class="card table-wrap"><table class="tbl wide"><caption class="sr-only">Ledger entries</caption><thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Particulars</th><th class="r" scope="col">Debit</th><th class="r" scope="col">Credit</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>';
    var tDr = 0, tCr = 0;
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var dc = entryDC(r);
      var accounts = B.journal(r).map(function (line) {
        return (line.dr ? "Dr " : "Cr ") + line.account + " " + money(B.amount(line.dr || line.cr));
      }).join(" · ");
      tDr += dc.dr; tCr += dc.cr;
      h += '<tr data-id="' + esc(r.id) + '"><td>' + esc(A.day(r)) + "</td><td>" + esc(String(r.type || "").toUpperCase()) + "</td><td>" + esc(entryLabel(r)) + '<div class="li-sub">' + esc(accounts) + '</div></td><td class="r">' + (dc.dr ? esc(money(dc.dr)) : "—") + '</td><td class="r">' + (dc.cr ? esc(money(dc.cr)) : "—") + '</td><td><button type="button" class="btn btn-sm btn-s edit-btn">Edit</button></td></tr>';
    }
    h += '<tr><th scope="row" colspan="3">Total</th><th class="r">' + esc(money(tDr)) + '</th><th class="r">' + esc(money(tCr)) + "</th><td></td></tr></tbody></table></div>";
    box.innerHTML = h;
  }
  function customerBalance(cid) {
    return B.amount(B.receivables(hist(), custs()).balances.get(cid) || 0);
  }
  function renderCust() {
    var q = (byId("cSearch").value || "").trim().toLowerCase();
    var cs = custs().filter(function (c) {
      if (!q) return true;
      return (c.name + " " + (c.phone || "") + " " + (c.email || "")).toLowerCase().indexOf(q) >= 0;
    });
    var box = byId("custList");
    if (!cs.length) { box.innerHTML = '<p class="em">No customers yet.</p>'; return; }
    box.innerHTML = cs.map(function (c) {
      return '<div class="li"><div class="li-row"><div><div class="li-title">' + esc(c.name) + '</div><div class="li-sub">' + esc([c.phone, c.email, c.licenseExpiry ? "Licence expiry " + c.licenseExpiry : ""].filter(Boolean).join(" · ")) + '</div></div><div class="li-side"><div class="li-amt">' + esc(money(customerBalance(c.id))) + '</div><button type="button" class="btn btn-sm btn-s" data-cid="' + esc(c.id) + '">Statement</button> <button type="button" class="btn btn-sm btn-s" data-editc="' + esc(c.id) + '">Edit</button> <button type="button" class="btn btn-sm btn-d" data-delc="' + esc(c.id) + '" aria-label="Delete ' + esc(c.name) + '">Delete</button></div></div></div>';
    }).join("");
  }
  function resetCustomerForm() {
    byId("custForm").reset();
    byId("cEditId").value = "";
    byId("btnAddCust").textContent = "Add customer";
    byId("btnCancelCust").hidden = true;
  }
  function editCustomer(id) {
    var c = custs().find(function (customer) { return customer.id === id; });
    if (!c) return;
    var values = { cEditId: c.id, cName: c.name, cPhone: c.phone, cEmail: c.email, cOpen: c.opening || 0,
      cTaxId: c.taxId, cLicense: c.license, cLicenseExpiry: c.licenseExpiry };
    Object.keys(values).forEach(function (key) { byId(key).value = values[key] || ""; });
    byId("btnAddCust").textContent = "Save customer";
    byId("btnCancelCust").hidden = false;
    byId("cName").focus();
  }
  function addCust() {
    var name = byId("cName").value.trim();
    if (!name || !byId("custForm").reportValidity()) { toast("Check the customer details", "err"); return; }
    var id = byId("cEditId").value;
    var cs = custs();
    var current = cs.find(function (customer) { return customer.id === id; });
    if (id && !current) { toast("Customer record is unavailable", "err"); return; }
    if (current && current.name !== name && hist().some(function (row) { return !row.customerId && row.client === current.name; })) {
      toast("This name is linked to older entries and must be kept", "err"); return;
    }
    if (load("controls", {}).closed && B.cents(byId("cOpen").value) !== B.cents(current?.opening)) throw new Error("Opening balances are fixed after a period is closed.");
    var customer = { id: id || uid(), name: name, phone: byId("cPhone").value.trim(), email: byId("cEmail").value.trim(),
      opening: B.amount(B.cents(byId("cOpen").value)), taxId: byId("cTaxId").value.trim(), license: byId("cLicense").value.trim(),
      licenseExpiry: byId("cLicenseExpiry").value };
    if (current) cs[cs.indexOf(current)] = customer;
    else cs.push(customer);
    writeCustomers(cs);
    resetCustomerForm();
    renderCust(); fillSelects(); refreshAll();
    toast(current ? "Customer updated" : "Customer added");
  }
  function renderInv() {
    var f = byId("invFilter").value;
    var is = inv().filter(function (a) {
      if (f === "all") return true;
      if (f === "service") return serviceDue(a);
      return a.status === f;
    });
    var box = byId("invList");
    if (!is.length) { box.innerHTML = '<p class="em">No assets yet.</p>'; return; }
    box.innerHTML = is.map(function (a) {
      var svc = serviceDue(a) ? '<span class="tag bad">Service due</span>' : "";
      var meta = [a.plate, a.type, a.status, a.odometer ? (a.odometer + " km") : ""].filter(Boolean).join(" · ");
      svc += fleetDocumentAlerts(a).map(function (alert) { return '<span class="tag warn">' + esc(alert) + '</span>'; }).join("");
      return '<div class="li"><div class="li-row"><div><div class="li-title">' + esc(a.name) + '</div><div class="li-sub">' + esc(meta) + "</div>" + svc + '</div><div class="li-side"><div class="li-amt">' + esc(money(a.value)) + '</div><button type="button" class="btn btn-sm btn-s" data-editi="' + esc(a.id) + '">Edit</button> <button type="button" class="btn btn-sm btn-d" data-deli="' + esc(a.id) + '" aria-label="Delete ' + esc(a.name) + '">Delete</button></div></div></div>';
    }).join("");
  }
  function addInv() {
    var name = (byId("iName").value || "").trim();
    var plate = (byId("iPlate").value || "").trim();
    if (!name || !plate) { toast("Name and plate are required", "err"); return; }
    if (!byId("invForm").reportValidity()) return;
    if (load("controls", {}).closed && B.cents(byId("iValue").value)) throw new Error("Use an open-period journal to post new fleet value.");
    var is = rawInventory();
    if (is.some(function (asset) { return asset.plate.toLowerCase() === plate.toLowerCase(); })) { toast("Plate already exists", "err"); return; }
    is.push({
      id: uid(), name: name, plate: plate, type: byId("iType").value, status: byId("iStatus").value,
      value: Number(byId("iValue").value) || 0, odometer: Number(byId("iOdo").value) || 0,
      nextService: byId("iNext").value || "", serviceAt: Number(byId("iAt").value) || 0,
      registration: byId("iRegistration").value, insurance: byId("iInsurance").value
    });
    save("inventory", is);
    byId("iName").value = ""; byId("iPlate").value = ""; byId("iValue").value = "0"; byId("iOdo").value = "0"; byId("iNext").value = ""; byId("iAt").value = ""; byId("iRegistration").value = ""; byId("iInsurance").value = "";
    renderInv(); fillSelects(); refreshAll();
    toast("Asset added");
  }
  function beginAssetEdit(id) {
    var a = inv().filter(function (x) { return x.id === id; })[0];
    if (!a) return;
    var form = byId("invEditForm");
    form.hidden = false;
    byId("iEditId").value = a.id;
    byId("iEditName").value = a.name || "";
    byId("iEditPlate").value = a.plate || "";
    ensureOption(byId("iEditType"), a.type || "Other");
    ensureOption(byId("iEditStatus"), a.status || "Available");
    byId("iEditValue").value = a.value || 0;
    byId("iEditOdo").value = a.odometer || 0;
    byId("iEditNext").value = a.nextService || "";
    byId("iEditAt").value = a.serviceAt || "";
    byId("iEditRegistration").value = a.registration || "";
    byId("iEditInsurance").value = a.insurance || "";
    byId("iEditName").focus();
  }
  function saveInvEdit() {
    var id = byId("iEditId").value;
    var name = (byId("iEditName").value || "").trim();
    var plate = (byId("iEditPlate").value || "").trim();
    if (!name || !plate) { toast("Name and plate are required", "err"); return; }
    if (!byId("invEditForm").reportValidity()) return;
    var list = rawInventory();
    if (list.some(function (asset) { return asset.id !== id && asset.plate.toLowerCase() === plate.toLowerCase(); })) { toast("Plate already exists", "err"); return; }
    var current = list.find(function (asset) { return asset.id === id; });
    if (!current) return;
    if (load("controls", {}).closed && B.cents(byId("iEditValue").value) !== B.cents(current.value)) throw new Error("Use an open-period journal to adjust fleet value.");
    var linked = hist().filter(function (row) { return row.type === "rental" && B.matchesVehicle(row, current); });
    var active = linked.some(B.active);
    if (linked.some(function (row) { return !B.managed(row) && B.active(row); }) && assetLabel(current) !== assetLabel({ name: name, plate: plate })) {
      toast("Close the legacy rental before changing this vehicle’s name or plate", "err"); return;
    }
    if (linked.some(function (row) { return B.managed(row) && row.state === "reserved"; }) && (byId("iEditStatus").value !== "Available" || !["Rental", "Other"].includes(byId("iEditType").value))) {
      toast("Move or cancel this vehicle’s reservations before making it unavailable", "err"); return;
    }
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        list[i].name = name;
        list[i].plate = plate;
        list[i].type = byId("iEditType").value;
        list[i].status = active ? current.status : byId("iEditStatus").value;
        list[i].value = Number(byId("iEditValue").value) || 0;
        list[i].odometer = Number(byId("iEditOdo").value) || 0;
        list[i].nextService = byId("iEditNext").value || "";
        list[i].serviceAt = Number(byId("iEditAt").value) || 0;
        list[i].registration = byId("iEditRegistration").value;
        list[i].insurance = byId("iEditInsurance").value;
      }
    }
    save("inventory", list);
    byId("invEditForm").hidden = true;
    renderInv(); fillSelects(); refreshAll(); renderReports();
    toast("Asset updated");
  }
  function renderReports() {
    var t = calc();
    byId("plR").textContent = money(t.R);
    byId("plP").textContent = money(t.P);
    byId("plT").textContent = money(t.T);
    byId("plRc").textContent = money(t.Rc);
    byId("plInc").textContent = money(t.income);
    byId("plE").textContent = money(t.E);
    byId("plPay").textContent = money(t.Pay);
    byId("plN").textContent = money(t.net);
    var dep = depositsHeld();
    var assets = t.cash + t.ar + t.invVal + t.otherAssets;
    var liabilitiesEquity = dep + t.tax + t.payable + t.advances + t.equity + t.net;
    byId("bsCash").textContent = money(t.cash);
    byId("bsAr").textContent = money(t.ar);
    byId("bsInv").textContent = money(t.invVal);
    byId("bsTa").textContent = money(assets);
    byId("bsDep").textContent = money(dep);
    byId("bsAdvance").textContent = money(t.advances);
    byId("bsTax").textContent = money(t.tax);
    byId("bsOther").textContent = money(t.otherAssets);
    byId("bsPayable").textContent = money(t.payable);
    byId("bsCap").textContent = money(t.equity);
    byId("bsRe").textContent = money(t.net);
    byId("bsTl").textContent = money(liabilitiesEquity);
    var rows = hist();
    var aged = B.aging(rows, todayISO(), localDay);
    for (var i = 0; i < 4; i++) {
      byId("age" + i).textContent = money(B.amount(aged.buckets[i + 1]));
      byId("age" + i + "n").textContent = String(aged.counts[i + 1]);
    }
    byId("ageCurrent").textContent = money(B.amount(aged.buckets[0]));
    byId("ageCurrentN").textContent = String(aged.counts[0]);
    var opening = B.amount(B.sum(custs(), function (c) { return B.cents(c.opening); }));
    byId("ageOpen").textContent = money(opening);
    byId("ageRc").textContent = money(t.ar - opening - B.amount(B.sum(aged.buckets, function (value) { return value; })));
    byId("ageNet").textContent = money(t.ar);
    rental.report();
    if (!byId("rep-books").hidden) accounting.render();
    fillSelects();
  }
  function stmtParticulars(r) {
    if (B.managed(r) || B.rentalEvent(r)) return entryLabel(r);
    if (r.type === "rental") return "Rental " + [r.vehicle, r.qty, r.billType].filter(Boolean).join(" ");
    if (r.type === "parking") return "Parking " + [r.plate, r.bay, r.tariff].filter(Boolean).join(" ");
    if (r.type === "receipt") return "Receipt " + (r.note || "");
    return (r.type || "") + " " + (r.note || "");
  }
  function genStmt() {
    var cid = byId("stmtCust").value;
    if (!cid) { toast("Select a customer", "err"); return; }
    var c = null;
    var cs = custs();
    for (var i = 0; i < cs.length; i++) if (cs[i].id === cid) c = cs[i];
    if (!c) return;
    var co = companyName();
    byId("stmtTitle").textContent = "Statement — " + c.name;
    var uniqueName = cs.filter(function (customer) { return customer.name === c.name; }).length === 1;
    var rows = postedHistory().filter(function (r) { return r.customerId === cid || (!r.customerId && uniqueName && r.client === c.name); });
    rows.sort(function (a, b) { return (a.time || "").localeCompare(b.time || ""); });
    var html = '<p class="hint">' + esc(co) + " · Customer statement (" + esc(cur()) + ")</p>";
    html += '<div class="table-wrap"><table class="tbl"><caption class="sr-only">Customer statement</caption><thead><tr><th scope="col">Date</th><th scope="col">Particulars</th><th class="r" scope="col">Debit</th><th class="r" scope="col">Credit</th><th class="r" scope="col">Balance</th></tr></thead><tbody>';
    var bal = B.cents(c.opening);
    if (bal) html += '<tr><td></td><td>Opening balance</td><td class="r">' + esc(money(B.amount(bal))) + '</td><td class="r"></td><td class="r">' + esc(money(B.amount(bal))) + "</td></tr>";
    for (var j = 0; j < rows.length; j++) {
      var r = rows[j], dr = "", cr = "";
      var change = B.receivable(r);
      if (change > 0) dr = money(B.amount(change));
      else if (change < 0) cr = money(B.amount(-change));
      else if ((r.type === "rental" || r.type === "parking") && r.paid) { dr = entryAmt(r); cr = entryAmt(r); }
      else continue;
      bal += change;
      html += "<tr><td>" + esc(A.day(r)) + "</td><td>" + esc(stmtParticulars(r)) + '</td><td class="r">' + esc(dr) + '</td><td class="r">' + esc(cr) + '</td><td class="r">' + esc(money(B.amount(bal))) + "</td></tr>";
    }
    html += "</tbody></table></div>";
    byId("stmtBody").innerHTML = html;
    byId("stmtBal").textContent = money(B.amount(bal));
    byId("stmtOut").hidden = false;
    window._lastPrint = { title: "Statement — " + c.name, html: html, bal: money(B.amount(bal)), co: co };
  }
  function printDoc(doc) {
    if (!doc) return;
    var area = byId("printArea");
    area.hidden = false;
    area.style.display = "block";
    area.innerHTML = '<div class="print-box"><h2>' + esc(doc.co) + '</h2><p class="meta">' + esc(doc.title) + " · " + esc(cur()) + " · " + esc(new Date().toLocaleString()) + "</p>" + doc.html + (doc.bal ? '<p class="print-balance">Balance: ' + esc(doc.bal) + "</p>" : "") + '<p class="meta">Generated by AutoSheets Accounting</p></div>';
    window.print();
    setTimeout(function () { area.style.display = "none"; area.innerHTML = ""; area.hidden = true; }, 500);
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast("Copied to clipboard"); }).catch(function () { toast("Could not copy", "err"); });
      return;
    }
    toast("Copy is not available in this browser", "err");
  }
  function shareDoc(doc) {
    if (!doc) return;
    var text = doc.co + "\n" + doc.title + "\nCurrency: " + cur() + "\nBalance: " + (doc.bal || "") + "\n\nGenerated by AutoSheets";
    if (navigator.share) navigator.share({ title: doc.title, text: text }).catch(function () {});
    else copyText(text);
  }
  function printReceipt(r) {
    var lines = "";
    if (r.type === "rental") lines = "Client: " + (r.client || "") + "\nVehicle: " + (r.vehicle || "") + "\nQty: " + (r.qty || "") + " " + (r.billType || "") + (r.due ? "\nDue: " + r.due : "") + (r.deposit ? "\nDeposit: " + money(r.deposit) : "") + "\nTotal: " + money(r.total) + (r.paid ? " (Paid)" : " (On account)");
    else if (r.type === "parking") lines = "Plate: " + (r.plate || "") + (r.bay ? "\nBay: " + r.bay : "") + "\nTariff: " + (r.tariff || "") + "\nAmount: " + money(r.amount) + (r.paid ? " (Paid)" : " (On account)");
    else if (r.type === "taxi") lines = (r.driverName ? "Driver: " + r.driverName + "\n" : "") + "Fare: " + money(r.fare) + "\nDriver share: " + money(r.driver) + "\nOwner share: " + money(r.owner);
    else if (r.type === "receipt") lines = "Receipt: " + money(r.amt) + "\n" + (r.note || "");
    else if (r.type === "payment") lines = "Payment: " + money(r.amt) + "\nPayee: " + (r.payee || "");
    else if (r.type === "expense") lines = "Expense: " + (r.cat || "") + " " + money(r.amt) + (r.note ? "\n" + r.note : "");
    var html = '<table class="tbl"><tbody><tr><td>Type</td><td class="r">' + esc(String(r.type || "").toUpperCase()) + '</td></tr><tr><td>Reference</td><td class="r">' + esc(r.id || "") + '</td></tr><tr><td>Date</td><td class="r">' + esc(A.day(r)) + '</td></tr><tr><td colspan="2"><pre class="print-notes">' + esc(lines) + "</pre></td></tr></tbody></table>";
    var dc = entryDC(r);
    html += '<table class="tbl"><thead><tr><th scope="col">Debit</th><th class="r" scope="col">Credit</th></tr></thead><tbody><tr><td>' + (dc.dr ? esc(money(dc.dr)) : "—") + '</td><td class="r">' + (dc.cr ? esc(money(dc.cr)) : "—") + "</td></tr></tbody></table>";
    printDoc({ title: "Receipt / voucher", html: html, bal: "", co: companyName() });
  }
  function shareReceipt(r) {
    var text = companyName() + "\n" + String(r.type || "").toUpperCase() + "\n" + entryLabel(r) + "\n" + entryAmt(r) + "\n" + A.day(r);
    if (navigator.share) navigator.share({ title: "AutoSheets " + r.type, text: text }).catch(function () {});
    else copyText(text);
  }
  function shiftMonth(ym, delta) {
    var p = ym.split("-");
    var d = new Date(Number(p[0]), Number(p[1]) - 1 + delta, 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }
  function monthOf(r) { return A.day(r).slice(0, 7); }
  function genMonth() {
    var m = byId("monthPick").value;
    if (!m) { toast("Pick a month", "err"); return; }
    var list = postedHistory().filter(function (r) { return monthOf(r) === m; });
    var prev = sumEntries(postedHistory().filter(function (r) { return monthOf(r) === shiftMonth(m, -1); }));
    var curSum = sumEntries(list);
    byId("monthTitle").textContent = "Monthly — " + m;
    byId("moInc").textContent = money(curSum.income);
    byId("moExp").textContent = money(curSum.expense);
    byId("moNet").textContent = money(curSum.net);
    byId("moPrev").textContent = money(prev.net);
    byId("moCnt").textContent = String(curSum.n);
    byId("monthList").innerHTML = list.map(function (r) {
      return '<div class="li"><div class="li-row"><div>' + esc(String(r.type || "").toUpperCase()) + " · " + esc(entryLabel(r)) + "</div><div>" + esc(entryAmt(r)) + "</div></div></div>";
    }).join("") || '<p class="em">No entries this month.</p>';
    byId("monthOut").hidden = false;
  }
  function applyRates() {
    var r = rates();
    var pt = byId("pTariff");
    if (pt) {
      var pv = pt.value;
      byId("pRate").value = pv === "hourly" ? r.parkHourly : pv === "daily" ? r.parkDaily : pv === "weekly" ? r.parkWeekly : (r.parkMonthly || 400);
      byId("pHours").disabled = pv !== "hourly";
    }
    var tc = byId("tCommission");
    if (tc) tc.value = r.taxiComm;
    previewTaxi();
  }

  function previewTaxi() {
    var fare = Number(byId("tFare").value) || 0;
    var comm = Number(byId("tCommission").value) || 0;
    var driver = Math.round(fare * comm) / 100;
    byId("tPreview").textContent = "Full fare posts to taxi income. Driver " + money(driver) + " · Owner " + money(fare - driver) + ".";
  }

  function saveParking() {
    var cid = byId("pCust").value;
    var plate = (byId("pPlate").value || "Unknown").trim();
    var tariff = byId("pTariff").value;
    var hours = Number(byId("pHours").value) || 1;
    var rate = Number(byId("pRate").value) || 0;
    var amount = tariff === "hourly" ? hours * rate : rate;
    var paid = byId("pPaid").value === "1";
    var h = hist();
    h.push({
      id: uid(), type: "parking", customerId: cid || null, client: custNameById(cid), plate: plate,
      bay: byId("pBay").value || "", tariff: tariff, hours: hours, rate: rate, amount: amount, paid: paid,
      time: new Date().toISOString()
    });
    writeHistory(h);
    toast("Parking saved — " + money(amount));
    byId("pPlate").value = "";
    byId("pBay").value = "";
    showPage("dashboard");
  }
  function saveTaxi() {
    var fare = Number(byId("tFare").value) || 0;
    var comm = Number(byId("tCommission").value) || 60;
    var driver = Math.round(fare * comm) / 100;
    var h = hist();
    h.push({
      id: uid(), type: "taxi", vehicle: byId("tVehicle").value || "", driverName: (byId("tDriver").value || "").trim(),
      fare: fare, driver: driver, owner: fare - driver, paid: true, time: new Date().toISOString()
    });
    writeHistory(h);
    toast("Taxi saved — " + money(fare));
    byId("tFare").value = "";
    byId("tDriver").value = "";
    showPage("dashboard");
  }
  function saveExpense() {
    var vid = byId("eVehicle").value || "";
    var odo = Number(byId("eOdo").value) || 0;
    var vlabel = "";
    inv().forEach(function (a) { if (a.id === vid) vlabel = assetLabel(a); });
    if (!Number.isFinite(Number(byId("eAmt").value)) || Number(byId("eAmt").value) <= 0) throw new Error("Enter a positive expense amount.");
    var h = hist();
    h.push({
      id: uid(), type: "expense", method: byId("eMethod").value, channelVersion: 1, cat: byId("eCat").value, amt: Number(byId("eAmt").value) || 0,
      note: byId("eNote").value || "", vehicleId: vid || null, vehicle: vlabel, odo: odo, time: new Date().toISOString()
    });
    writeHistory(h);
    if (vid && odo) {
      updateAsset(function (a) { return a.id === vid; }, function (a) {
        if (odo > (Number(a.odometer) || 0)) a.odometer = odo;
      });
    }
    toast("Expense saved");
    byId("eAmt").value = "";
    byId("eNote").value = "";
    byId("eOdo").value = "";
    showPage("dashboard");
  }
  function saveReceipt() {
    var cid = byId("rcCust").value;
    var amt = Number(byId("rcAmt").value) || 0;
    if (amt <= 0) { toast("Enter a positive amount", "err"); return; }
    var h = hist();
    h.push({ id: uid(), type: "receipt", method: byId("rcMethod").value, channelVersion: 1, customerId: cid || null, client: custNameById(cid), amt: amt, note: byId("rcNote").value || "", time: new Date().toISOString() });
    writeHistory(h);
    toast("Receipt saved — " + money(amt));
    byId("rcAmt").value = "";
    byId("rcNote").value = "";
    showPage("dashboard");
  }
  function savePayment() {
    var amt = Number(byId("payAmt").value) || 0;
    if (amt <= 0) { toast("Enter a positive amount", "err"); return; }
    var h = hist();
    h.push({ id: uid(), type: "payment", method: byId("payMethod").value, channelVersion: 1, payee: byId("payName").value || "Vendor", amt: amt, note: byId("payNote").value || "", time: new Date().toISOString() });
    writeHistory(h);
    toast("Payment saved — " + money(amt));
    byId("payAmt").value = "";
    byId("payName").value = "";
    byId("payNote").value = "";
    showPage("dashboard");
  }
  function updSettings() {
    var t = calc();
    byId("sRec").textContent = String(t.n);
    byId("sCur").textContent = cur();
    var r = rates();
    byId("rDaily").value = r.rentalDaily;
    byId("rWeekly").value = r.rentalWeekly;
    byId("rMonthly").value = r.rentalMonthly;
    byId("pHourly").value = r.parkHourly;
    byId("pDaily").value = r.parkDaily;
    byId("pWeekly").value = r.parkWeekly;
    byId("pMonthly").value = r.parkMonthly || 400;
    byId("tComm").value = r.taxiComm;
    byId("sCo").textContent = companyName();
    var saved = company();
    byId("coName").value = saved.name || "";
    byId("coAddress").value = saved.address || "";
    byId("coTaxId").value = saved.taxId || "";
    byId("coTaxRate").value = saved.taxRate || 0;
  }
  function saveRates() {
    save("rates", {
      rentalDaily: Number(byId("rDaily").value) || 0,
      rentalWeekly: Number(byId("rWeekly").value) || 0,
      rentalMonthly: Number(byId("rMonthly").value) || 0,
      parkHourly: Number(byId("pHourly").value) || 0,
      parkDaily: Number(byId("pDaily").value) || 0,
      parkWeekly: Number(byId("pWeekly").value) || 0,
      parkMonthly: Number(byId("pMonthly").value) || 0,
      taxiComm: Number(byId("tComm").value) || 60
    });
    applyRates();
    toast("Rates saved");
  }
  function saveCo() {
    var n = (byId("coName").value || "AutoSheets").trim() || "AutoSheets";
    if (!byId("coTaxRate").reportValidity()) return;
    save("company", { name: n, address: byId("coAddress").value.trim(), taxId: byId("coTaxId").value.trim(), taxRate: Number(byId("coTaxRate").value) || 0 });
    byId("sCo").textContent = n;
    byId("hdrCo").textContent = n;
    document.title = n + " — AutoSheets Accounting";
    toast("Company saved");
  }
  function download(filename, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  async function exportData() {
    if (!unlocked || busy) return;
    busy = true;
    try {
      var snapshot = { customers: [], inventory: [], history: [] };
      works.forEach(function (key) { if (Object.hasOwn(book, key)) snapshot[key] = book[key]; });
      var encrypted = await Vault.seal(unlocked.key, unlocked.salt, { ...snapshot, app: "AutoSheets", version: VERSION }, "backup");
      download("autosheets-" + todayISO() + ".asvault", new Blob([JSON.stringify(encrypted)], { type: "application/json" }));
      toast("Encrypted backup downloaded");
    } catch (_) { toast("Could not create the backup.", "err"); }
    finally { busy = false; if (pendingLock) doLogout(); }
  }
  function csvCell(v) {
    var s = String(v == null ? "" : v);
    if (/^[\s]*[=+\-@]|^[\t\r\n]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function exportCsv() {
    var header = ["Date", "Type", "Particulars", "Amount", "Paid", "Deposit", "Due", "Customer", "Vehicle", "Plate", "Note", "Reference"];
    var lines = [header.map(csvCell).join(",")];
    postedHistory().forEach(function (r) {
      lines.push([
        A.day(r), r.type, entryLabel(r), entryNumber(r).toFixed(2), r.paid ? "yes" : "no",
        r.deposit || "", r.invoiceDue || r.due || "", r.client || "", r.vehicle || "", r.plate || "", r.note || r.payee || r.cat || "", r.id
      ].map(csvCell).join(","));
    });
    download("autosheets-ledger.csv", new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    toast("CSV downloaded");
  }
  async function selectBackup(file) {
    try {
      if (file.size > 12 * 1024 * 1024) throw new Error("The backup exceeds 12 MB.");
      backupFile = JSON.parse(await file.text());
      if (!backupFile || typeof backupFile !== "object" || Array.isArray(backupFile)) throw new Error("Invalid backup.");
      byId("restoreForm").hidden = false;
      byId("restoreHint").textContent = backupFile.format ? "Encrypted backup selected." : "Legacy JSON backup selected.";
    } catch (error) { cancelRestore(); toast(error.message || "Invalid backup.", "err"); }
  }
  function cancelRestore() {
    backupFile = null;
    byId("restoreForm").reset();
    byId("restoreForm").hidden = true;
  }
  async function importData() {
    if (!backupFile || busy || temporary) return;
    var data;
    try {
      data = backupFile.format ? (await Vault.open(backupFile, byId("backupPass").value, "backup")).data : backupFile;
      if (!data || typeof data !== "object" || !["customers", "inventory", "history", "company", "rates"].some(function (key) { return Object.hasOwn(data, key); })) throw new Error("This file has no AutoSheets records.");
      ["customers", "inventory", "history", "audit"].forEach(function (key) {
        if (key in data && (!Array.isArray(data[key]) || data[key].some(function (item) { return !item || typeof item !== "object" || Array.isArray(item); }))) throw new Error("Invalid " + key + " in backup.");
      });
      if (Array.isArray(data.history)) {
        A.validateBackup(data.history);
        data.history = assignPostingDates(data.history);
      }
      if (data.audit?.some(function (item) { return !Array.isArray(item.entities) || typeof item.action !== "string" || !Number.isFinite(Date.parse(item.time)); })) throw new Error("Invalid workspace activity.");
      ["company", "rates", "controls"].forEach(function (key) {
        if (key in data && (!data[key] || typeof data[key] !== "object" || Array.isArray(data[key]))) throw new Error("Invalid " + key + " in backup.");
      });
      if (data.controls) A.validateControls(data.controls, data.history || []);
      if (!appOpen()) return;
      if (!confirm("Replace this workspace’s books with the selected backup?")) return;
      await transact("Restore backup", function () {
        var controls = load("controls", {});
        if (controls.closed || Object.keys(controls.reconciled || {}).length) {
          if (!data.controls || !Array.isArray(data.history) || (controls.closed && (!data.controls.closed || data.controls.closed < controls.closed))) {
            throw new Error("The backup would undo a period close or reconciliation.");
          }
          A.protectHistory(hist(), data.history, controls);
          Object.entries(controls.reconciled || {}).forEach(function ([account, record]) {
            if (!(data.controls.reconciliations || []).some(function (item) { return item.account === account && JSON.stringify(item) === JSON.stringify(record); })) {
              throw new Error("The backup would undo a reconciliation.");
            }
          });
          if (controls.closed) {
            [["customers", "opening"], ["inventory", "value"]].forEach(function ([key, field]) {
              if (!Array.isArray(data[key]) || JSON.stringify(load(key, []).filter(function (row) { return B.cents(row[field]); }).map(function (row) { return [row.id, B.cents(row[field])]; }).sort()) !==
                  JSON.stringify(data[key].filter(function (row) { return B.cents(row[field]); }).map(function (row) { return [row.id, B.cents(row[field])]; }).sort())) throw new Error("The backup would change closed opening balances.");
            });
            if (data.currency && data.currency !== cur()) throw new Error("The backup would relabel closed postings.");
          }
        }
        var previousAudit = load("audit", []);
        if (data.controls && !Array.isArray(data.history)) throw new Error("Accounting controls require a complete backup.");
        if (Object.hasOwn(data, "currency") && !curs.includes(data.currency)) throw new Error("Unknown book currency.");
        works.forEach(function (key) { if (Object.hasOwn(data, key)) save(key, data[key]); });
        save("audit", [...previousAudit, ...(data.audit || []), { time: new Date().toISOString(), action: "Restored backup", entities: works.filter(function (key) { return Object.hasOwn(data, key); }) }]);
        return function () { cancelRestore(); redraw(); toast("Backup restored"); };
      });
    } catch (error) { toast(error.message || "Could not read that backup.", "err"); }
    finally { byId("backupPass").value = ""; }
  }
  function clearData() {
    if (hist().some(function (row) { return row.type === "journal" || (B.managed(row) && !B.pending(row)); })) throw new Error("Issued rental invoices and posted journals must be corrected using their reversal controls.");
    if (!confirm("Delete all accounting entries and rental records? Customers, fleet, and rates stay.")) return;
    var rows = hist();
    save("inventory", rawInventory().map(function (asset) {
      if (asset.status === "Rented" && rows.some(function (row) { return B.active(row) && B.matchesVehicle(row, asset); })) asset.status = "Available";
      return asset;
    }));
    writeHistory([]);
    refreshAll(); updSettings(); renderDaybook(); renderReports();
    toast("All entries cleared");
  }
  function selectTab(name) {
    var tabs = document.querySelectorAll(".tab");
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute("data-rep") === name;
      tabs[i].classList.toggle("on", on);
      tabs[i].setAttribute("aria-selected", on ? "true" : "false");
    }
    var panels = document.querySelectorAll(".rep-panel");
    for (var y = 0; y < panels.length; y++) panels[y].hidden = panels[y].id !== "rep-" + name;
    if (name === "books") accounting.render();
  }
  function printToday() {
    var day = todayISO();
    var list = postedHistory().filter(function (r) { return A.day(r) === day; });
    var ts = sumEntries(list);
    var rows = list.map(function (r) {
      return "<tr><td>" + esc(A.day(r)) + "</td><td>" + esc(r.type) + "</td><td>" + esc(entryLabel(r)) + '</td><td class="r">' + esc(entryAmt(r)) + "</td></tr>";
    }).join("");
    var html = '<table class="tbl"><thead><tr><th>Date</th><th>Type</th><th>Particulars</th><th class="r">Amount</th></tr></thead><tbody>' + (rows || '<tr><td colspan="4">No entries</td></tr>') + "</tbody></table>";
    html += "<p>Income " + esc(money(ts.income)) + " · Expenses " + esc(money(ts.expense)) + " · Net " + esc(money(ts.net)) + "</p>";
    printDoc({ title: "Day sheet — " + day, html: html, bal: "", co: companyName() });
  }
  function onMainClick(e) {
    var edit = e.target.closest(".edit-btn");
    if (edit) {
      var row = edit.closest("[data-id]");
      if (row) openEdit(row.getAttribute("data-id"));
      return;
    }
    var open = e.target.closest("[data-open]");
    if (open) { openEdit(open.getAttribute("data-open")); return; }
    var asset = e.target.closest("[data-asset]");
    if (asset) { showPage("inventory", { keepFocus: true }); beginAssetEdit(asset.getAttribute("data-asset")); return; }
    var stmt = e.target.closest("[data-cid]");
    if (stmt) {
      showPage("reports");
      selectTab("stmt");
      byId("stmtCust").value = stmt.getAttribute("data-cid");
      genStmt();
      return;
    }
    var editC = e.target.closest("[data-editc]");
    if (editC) { editCustomer(editC.getAttribute("data-editc")); return; }
    var delC = e.target.closest("[data-delc]");
    if (delC) {
      var cid = delC.getAttribute("data-delc");
      if (hist().some(function (row) { return B.managed(row) && row.customerId === cid; })) { toast("This customer has linked rental records", "err"); return; }
      if (!confirm("Delete this customer? Past entries stay in the ledger.")) return;
      var customer = custs().find(function (row) { return row.id === cid; });
      if (customer && load("controls", {}).closed && B.cents(customer.opening)) throw new Error("This customer has a closed opening balance.");
      save("customers", custs().filter(function (x) { return x.id !== cid; }));
      renderCust(); fillSelects(); refreshAll();
      toast("Customer deleted");
      return;
    }
    var delI = e.target.closest("[data-deli]");
    if (delI) {
      var iid = delI.getAttribute("data-deli");
      var vehicle = rawInventory().find(function (asset) { return asset.id === iid; });
      if (vehicle && hist().some(function (row) { return row.type === "rental" && B.matchesVehicle(row, vehicle) && (B.active(row) || row.state === "reserved"); })) { toast("Close this vehicle’s open rentals and reservations first", "err"); return; }
      if (vehicle && load("controls", {}).closed && B.cents(vehicle.value)) throw new Error("This asset has a closed opening value.");
      if (!confirm("Delete this asset?")) return;
      if (byId("iEditId").value === iid) byId("invEditForm").hidden = true;
      save("inventory", rawInventory().filter(function (x) { return x.id !== iid; }));
      renderInv(); fillSelects(); refreshAll();
      toast("Asset deleted");
      return;
    }
    var ed = e.target.closest("[data-editi]");
    if (ed) beginAssetEdit(ed.getAttribute("data-editi"));
  }
  function bindForm(id, fn, action) {
    byId(id).addEventListener("submit", function (event) {
      event.preventDefault();
      if (action) transact(action, fn);
      else fn();
    });
  }
  function theme() {
    var dark = localStorage.getItem("autosheets_theme") === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    byId("themeToggle").textContent = dark ? "Light mode" : "Dark mode";
    byId("themeToggle").setAttribute("aria-pressed", String(dark));
  }
  function init() {
    rental = AutoSheetsRental.create({ byId: byId, esc: esc, money: money, hist: hist, custs: custs, inv: inv, rates: rates,
      todayISO: todayISO, localDay: localDay, toast: toast, printDoc: printDoc, companyName: companyName, showPage: showPage,
      download: download, csvCell: csvCell, assetLabel: assetLabel, company: company, fillSelects: fillSelects,
      writeHistory: writeHistory, writeCustomers: writeCustomers, refresh: refreshAll, uid: uid, depositsHeld: depositsHeld, transact: transact });
    rental.init();
    accounting = AutoSheetsAccountingUI.create({ byId: byId, esc: esc, money: money, hist: hist, custs: custs, rawInventory: rawInventory,
      load: load, save: save, writeHistory: writeHistory, entryLabel: entryLabel, uid: uid, todayISO: todayISO, printDoc: printDoc,
      companyName: companyName, download: download, csvCell: csvCell, toast: toast, transact: transact });
    accounting.init();
    landing();
    theme();
    byId("themeToggle").onclick = function () {
      localStorage.setItem("autosheets_theme", document.documentElement.dataset.theme === "dark" ? "light" : "dark");
      theme();
    };
    byId("lockTop").onclick = doLogout;
    byId("btnDemo").onclick = function () {
      if (busy || localStorage.getItem(vaultKey) || existingLegacy()) return;
      temporary = true;
      book = {};
      enterApp("Temporary workspace");
    };
    ["pointerdown", "keydown", "input", "scroll"].forEach(function (type) {
      document.addEventListener(type, function () {
        if (appOpen() && Date.now() - lastActivity >= idleLimit) doLogout();
        else activity();
      }, { passive: true, capture: true });
    });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && appOpen() && Date.now() - lastActivity >= idleLimit) doLogout();
    });
    window.addEventListener("storage", function (event) {
      if (event.key === vaultKey && !temporary && appOpen() && event.newValue !== baseline) doLogout();
      else if (event.key === vaultKey && !appOpen()) landing();
    });
    bindForm("rotateForm", rotatePassphrase);
    bindForm("restoreForm", importData);
    byId("cancelRestore").onclick = cancelRestore;
    bindForm("loginForm", doLogin);
    bindForm("custForm", addCust, "Save customer");
    byId("btnCancelCust").onclick = resetCustomerForm;
    bindForm("invForm", addInv, "Add fleet asset");
    bindForm("invEditForm", saveInvEdit, "Edit fleet asset");
    bindForm("coForm", saveCo, "Save company");
    bindForm("ratesForm", saveRates, "Save default rates");

    bindForm("parkingForm", saveParking, "Post parking");
    bindForm("taxiForm", saveTaxi, "Post taxi");
    bindForm("expenseForm", saveExpense, "Post expense");
    bindForm("receiptForm", saveReceipt, "Post receipt");
    bindForm("paymentForm", savePayment, "Post vendor payment");
    bindForm("stmtForm", genStmt);
    bindForm("monthForm", genMonth);
    byId("btnShowPass").onclick = function () {
      var input = byId("loginPassword");
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      this.textContent = show ? "Hide" : "Show";
      this.setAttribute("aria-pressed", show ? "true" : "false");
    };
    byId("btnCur").onclick = function () { transact("Change book currency", cycleCur); };
    byId("btnLogout").onclick = doLogout;
    byId("btnExport").onclick = exportData;
    byId("btnExportCsv").onclick = exportCsv;
    byId("btnClear").onclick = function () { transact("Clear entries", clearData); };
    byId("btnPrintToday").onclick = printToday;
    byId("btnPrintPL").onclick = function () { renderReports(); printDoc({ title: "Profit and loss", html: byId("plTables").innerHTML, bal: "", co: companyName() }); };
    byId("btnPrintBS").onclick = function () { renderReports(); printDoc({ title: "Balance sheet", html: byId("bsTables").innerHTML, bal: "", co: companyName() }); };
    byId("btnPrintStmt").onclick = function () { printDoc(window._lastPrint); };
    byId("btnShareStmt").onclick = function () { shareDoc(window._lastPrint); };
    byId("btnEditSave").onclick = function () { transact("Edit entry", saveEdit); };
    byId("btnEditDel").onclick = function () { transact("Delete entry", deleteEdit); };
    byId("btnEditClose").onclick = closeModal;
    byId("btnEditPrint").onclick = function () { var r = findEntry(byId("editId").value); if (r) printReceipt(r); };
    byId("btnEditShare").onclick = function () { var r = findEntry(byId("editId").value); if (r) shareReceipt(r); };
    byId("btnCancelInvEdit").onclick = function () { byId("invEditForm").hidden = true; };
    byId("importFile").addEventListener("change", function () {
      var file = this.files && this.files[0];
      this.value = "";
      if (file) selectBackup(file);
    });
    byId("dbFilter").onchange = renderDaybook;
    byId("dbSearch").oninput = renderDaybook;
    byId("cSearch").oninput = renderCust;
    byId("invFilter").onchange = renderInv;
    byId("pTariff").onchange = applyRates;
    ["tFare", "tCommission"].forEach(function (id) { byId(id).addEventListener("input", previewTaxi); });
    byId("goRental").onclick = function () { showPage("rental"); };
    byId("goParking").onclick = function () { showPage("parking"); };
    byId("goTaxi").onclick = function () { showPage("taxi"); };
    byId("goExpense").onclick = function () { showPage("expense"); };
    byId("goReceipt").onclick = function () { showPage("receipt"); };
    byId("goPayment").onclick = function () { showPage("payment"); };
    byId("goCustomer").onclick = function () { showPage("customers"); };
    byId("goInventory").onclick = function () { showPage("inventory"); };
    byId("main").addEventListener("click", function (event) {
      if (event.target.closest("[data-delc], [data-deli]")) transact("Delete record", function () { onMainClick(event); });
      else onMainClick(event);
    });
    byId("editModal").addEventListener("click", function (e) { if (e.target === this) closeModal(); });
    document.addEventListener("keydown", function (e) {
      var modal = byId("editModal");
      var open = modal.classList.contains("show");
      if (e.key === "Escape" && open) { e.preventDefault(); closeModal(); return; }
      if (e.key !== "Tab" || !open) return;
      var nodes = focusables(modal);
      if (!nodes.length) return;
      var first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.querySelectorAll("#setRoles .rb").forEach(function (el) {
      el.onclick = function () {
        transact("Change work mode", function () {
          save("role", el.getAttribute("data-role"));
          return function () { selectRole(el, "#setRoles"); byId("sRole").textContent = role; };
        });
      };
    });
    var nis = document.querySelectorAll(".ni");
    for (var k = 0; k < nis.length; k++) (function (el) { el.onclick = function () { showPage(el.getAttribute("data-p")); }; })(nis[k]);
    var tabs = document.querySelectorAll(".tab");
    for (var t = 0; t < tabs.length; t++) (function (el) {
      el.onclick = function () { selectTab(el.getAttribute("data-rep")); };
      el.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        var all = Array.prototype.slice.call(document.querySelectorAll(".tab"));
        var idx = all.indexOf(el);
        var next = all[(idx + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length];
        next.focus();
        selectTab(next.getAttribute("data-rep"));
      });
    })(tabs[t]);
    window.addEventListener("hashchange", function () {
      if (!appOpen()) return;
      showPage(pageFromHash() || "dashboard", { silentHash: true });
    });
    syncCurrency();
    if (!byId("monthPick").value) byId("monthPick").value = todayISO().slice(0, 7);
    if ("serviceWorker" in navigator) {
      var hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (hadController && !appOpen() && !busy) window.location.reload();
      });
      navigator.serviceWorker.register("./sw.js").catch(function () {});
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
