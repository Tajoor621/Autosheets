const assert = require("node:assert/strict");
const test = require("node:test");
require("../rental-books.js");
const B = globalThis.RentalBooks;

const makeInvoice = (value, taxRate = 5) => B.invoice([{ label: "Rental", qty: 1, rate: value, cents: value }], 0, taxRate);
const car = { id: "car", name: "Camry", plate: "TEST" };
const makeRental = (overrides = {}) => ({
  id: "rental", type: "rental", rentalVersion: 1, state: "out", customerId: "client", vehicleId: car.id,
  start: "2026-11-02T09:00", dueAt: "2026-11-05T10:00", time: "2026-11-02T09:00:00.000Z",
  invoiceDue: "2026-11-10", invoice: makeInvoice(10000), ...overrides
});
const event = (type, fields = {}) => ({ id: type, type, rentalId: "rental", customerId: "client", time: "2026-11-04T08:00:00.000Z", ...fields });

test("reservations do not post; adjacent reservations are allowed", () => {
  const reserved = makeRental({ state: "reserved" });
  const rows = [reserved];
  assert.deepEqual(B.journal(reserved), []);
  assert.equal(B.overlap(rows, car, "2026-11-05T10:00", "2026-11-06T10:00", "", "2026-11-01T10:00"), false);
  assert.equal(B.overlap(rows, car, "2026-11-05T09:59", "2026-11-06T10:00", "", "2026-11-01T10:00"), true);
  assert.equal(B.overlap([makeRental()], car, "2026-11-08T10:00", "2026-11-10T10:00", "", "2026-11-07T10:00"), true);
});

test("invoice tax, payment, deposit application, refund and credit reconcile", () => {
  const rental = makeRental();
  const rows = [rental,
    event("rental-payment", { cents: 3000 }),
    event("deposit-in", { cents: 10000 }),
    event("deposit-apply", { cents: 7500 }),
    event("deposit-out", { cents: 2500 }),
    event("rental-credit", { invoice: makeInvoice(2000), sourceId: rental.id }),
    event("rental-refund", { cents: 2100 })
  ];
  assert.doesNotThrow(() => B.validateRentalBackup(rows));
  assert.throws(() => B.validateRentalBackup(rows.slice(1)));
  assert.deepEqual(B.ledger(rows), {
    "Accounts receivable": 0, "Rental income": -8000, "Output tax": -400, "Cash / bank": 8400, "Deposits held": 0
  });
  const position = B.rentalPosition(rows, rental);
  assert.deepEqual([position.billed, position.paid, position.held], [8400, 8400, 0]);
  assert.deepEqual(B.aging(rows, "2026-11-18", date => date.slice(0, 10)).buckets, [0, 0, 0, 0, 0]);
});

test("partial payment ages from due date; legacy account receipts are collections", () => {
  const rental = makeRental();
  const rows = [rental, event("rental-payment", { cents: 3000 })];
  assert.deepEqual(B.aging(rows, "2026-11-18", date => date.slice(0, 10)).buckets, [0, 7500, 0, 0, 0]);
  const receipt = { type: "receipt", amt: 10, customerId: "other" };
  const balances = B.receivables([...rows, receipt], [{ id: "client", opening: 0 }, { id: "other", opening: 0 }]);
  assert.equal(balances.due, 7500);
  assert.equal(balances.advances, 1000);
  assert.equal(B.ledger([receipt])["Other income"], undefined);
  assert.equal(B.ledger([{ type: "receipt", amt: 10 }])["Other income"], -1000);
});
