import assert from "node:assert";
import { describe, test } from "node:test";
import { buildReceipt, receiptReference } from "./receipt.js";

const shop = { name: "  Ama's Corner Shop ", address: "12 High St, Accra", phone: " 024 000 0000 ", email: "" };
const ID = "3f2a9c1e-77b4-4d0a-9d55-0a1b2c3d4e5f";

const base = {
  id: ID,
  issuedAt: "2026-09-20T10:30:00.000Z",
  shop,
  lines: [
    { name: "Milk 1L", quantity: 2, unitPrice: 12.5 },
    { name: "Bread", quantity: 1, unitPrice: 8.75 },
  ],
  paymentMethod: "cash" as const,
};

describe("receiptReference", () => {
  test("is the first eight characters of the id, upper-cased", () => {
    assert.strictEqual(receiptReference(ID), "3F2A9C1E");
  });
});

describe("buildReceipt", () => {
  test("totals the lines", () => {
    const receipt = buildReceipt(base);
    assert.deepStrictEqual(receipt.lines.map((line) => line.lineTotal), [25, 8.75]);
    assert.strictEqual(receipt.subtotal, 33.75);
    assert.strictEqual(receipt.discount, 0);
    assert.strictEqual(receipt.total, 33.75);
    assert.strictEqual(receipt.itemCount, 3);
    assert.strictEqual(receipt.reference, "3F2A9C1E");
  });

  test("applies a discount, never below zero", () => {
    assert.strictEqual(buildReceipt({ ...base, discount: 3.75 }).total, 30);
    const over = buildReceipt({ ...base, discount: 500 });
    assert.strictEqual(over.discount, 33.75);
    assert.strictEqual(over.total, 0);
  });

  test("rounds line totals to the cent instead of accumulating float error", () => {
    const receipt = buildReceipt({ ...base, lines: [{ name: "Sweet", quantity: 3, unitPrice: 0.1 }] });
    assert.strictEqual(receipt.lines[0].lineTotal, 0.3);
    assert.strictEqual(receipt.total, 0.3);
  });

  test("works out change for a cash sale", () => {
    const receipt = buildReceipt({ ...base, cashReceived: 50 });
    assert.strictEqual(receipt.cashReceived, 50);
    assert.strictEqual(receipt.change, 16.25);
  });

  test("exact cash leaves zero change", () => {
    const receipt = buildReceipt({ ...base, cashReceived: 33.75 });
    assert.strictEqual(receipt.change, 0);
  });

  test("leaves tender and change out when the cash falls short or is missing", () => {
    for (const cashReceived of [10, null, undefined, Number.NaN]) {
      const receipt = buildReceipt({ ...base, cashReceived });
      assert.strictEqual(receipt.cashReceived, null);
      assert.strictEqual(receipt.change, null);
    }
  });

  test("never shows cash tender for card or mobile money", () => {
    for (const paymentMethod of ["card", "momo"] as const) {
      const receipt = buildReceipt({ ...base, paymentMethod, cashReceived: 100 });
      assert.strictEqual(receipt.cashReceived, null);
      assert.strictEqual(receipt.change, null);
    }
  });

  test("trims the shop details and drops blank ones", () => {
    const receipt = buildReceipt(base);
    assert.strictEqual(receipt.shop.name, "Ama's Corner Shop");
    assert.strictEqual(receipt.shop.phone, "024 000 0000");
    assert.strictEqual(receipt.shop.email, null);
    assert.strictEqual(receipt.shop.address, "12 High St, Accra");
  });

  test("keeps cashier and customer when given, null otherwise", () => {
    const named = buildReceipt({ ...base, cashier: " Kofi ", customer: "Esi" });
    assert.strictEqual(named.cashier, "Kofi");
    assert.strictEqual(named.customer, "Esi");
    const anonymous = buildReceipt({ ...base, cashier: "  ", customer: undefined });
    assert.strictEqual(anonymous.cashier, null);
    assert.strictEqual(anonymous.customer, null);
  });

  test("accepts a Date and flags a sale that has not synced", () => {
    const receipt = buildReceipt({ ...base, issuedAt: new Date("2026-09-20T10:30:00.000Z"), pending: true });
    assert.strictEqual(receipt.issuedAt, "2026-09-20T10:30:00.000Z");
    assert.strictEqual(receipt.pending, true);
    assert.strictEqual(buildReceipt(base).pending, false);
  });

  test("names a line with a blank product name", () => {
    const receipt = buildReceipt({ ...base, lines: [{ name: "  ", quantity: 1, unitPrice: 5 }] });
    assert.strictEqual(receipt.lines[0].name, "Item");
  });
});
