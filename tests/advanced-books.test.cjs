const test = require("node:test");
const assert = require("node:assert/strict");
require("../rental-books.js");
require("../accounting.js");
require("../vault.js");
const A = globalThis.AutoSheetsAccounting;
const B = globalThis.RentalBooks;
const V = globalThis.AutoSheetsVault;
const stamp = "2026-03-31T12:00:00.000Z";
const opening = {
  id: "opening", type: "journal", postingDate: "2026-03-31", time: stamp, memo: "Cash introduced",
  lines: A.manualLines([{ account: "Bank", dr: 500 }, { account: "Owner capital", cr: 500 }])
};
const phrase = "fictional testing phrase only";

test("vault encrypts, authenticates, and separates backups from local workspaces", async () => {
  const data = { name: "Confidential rental company", history: [opening] };
  const created = await V.create(phrase, data);
  const second = await V.seal(created.key, created.salt, data);
  assert.notEqual(created.box.iv, second.iv);
  assert.ok(!JSON.stringify(created.box).includes(data.name));
  assert.deepEqual((await V.open(created.box, phrase)).data, data);
  await assert.rejects(V.open(created.box, "incorrect test passphrase"));
  const altered = { ...created.box, data: (created.box.data[0] === "A" ? "B" : "A") + created.box.data.slice(1) };
  await assert.rejects(V.open(altered, phrase));
  const backup = await V.seal(created.key, created.salt, data, "backup");
  await assert.rejects(V.open(backup, phrase));
  assert.deepEqual((await V.open(backup, phrase, "backup")).data, data);
});

test("trial balance recognises opening balances and valid journal reversals", () => {
  const reverse = { ...opening, id: "reverse", reversalOf: opening.id, postingDate: "2026-04-02",
    lines: opening.lines.map(line => ({ account: line.account, dr: line.cr, cr: line.dr })) };
  assert.doesNotThrow(() => A.validateBackup([opening, reverse]));
  assert.throws(() => A.validateBackup([reverse]));
  assert.throws(() => A.manualLines([{ account: "Bank", dr: 100 }, { account: "Owner capital", cr: 99 }]), /match/);
  const book = A.totals([opening, reverse], [{ opening: 10 }], [{ value: 100 }], "2026-03-31");
  assert.equal(book.Bank, 50000);
  assert.equal(book["Fleet assets"], 10000);
  assert.equal(book["Opening equity"], -11000);
  assert.equal(Object.values(book).reduce((a, b) => a + b, 0), 0);
});

test("reconciled postings are protected while outstanding items carry forward", () => {
  const transfer = { id: "transfer", type: "expense", amt: 30, time: stamp, channelVersion: 1, method: "Bank transfer" };
  const rows = [opening, transfer];
  assert.equal(A.reconcile(rows, "Bank", "2026-03-31", 50000, new Set(["transfer"])).difference, 0);
  assert.equal(A.reconcile(rows, "Bank", "2026-04-30", 47000, new Set()).difference, 0);
  assert.throws(() => A.protectHistory(rows, [opening, { ...transfer, amt: 35 }], { reconciled: { Bank: { through: "2026-03-31" } } }), /reconciled/);
  assert.throws(() => A.protectHistory(rows, [opening], { closed: "2026-03-31" }), /closed/);
  assert.doesNotThrow(() => A.protectHistory(rows, [...rows, { ...transfer, id: "new", time: "2026-04-02T12:00:00.000Z" }], { closed: "2026-03-31" }));
  assert.equal(B.ledger([transfer]).Bank, -3000);
  assert.equal(B.ledger([{ ...transfer, channelVersion: undefined }])["Cash / bank"], -3000);
});

test("operational return and extension preserve a closed issued invoice", () => {
  const row = {
    id: "rental", type: "rental", rentalVersion: 1, state: "out", time: stamp, customerId: "c", vehicleId: "v",
    start: "2026-03-31T12:00", dueAt: "2026-04-03T12:00", originalDueAt: "2026-04-03T12:00",
    invoice: B.invoice([{ label: "Rental", qty: 1, rate: 10000, cents: 10000 }], 0, 5)
  };
  const extended = { ...row, dueAt: "2026-04-05T12:00", due: "2026-04-05" };
  assert.doesNotThrow(() => A.protectHistory([row], [extended], { closed: "2026-03-31" }));
  assert.throws(() => A.protectHistory([row], [{ ...row, invoice: { ...row.invoice, net: 9000 } }], { closed: "2026-03-31" }));
});
