import assert from "node:assert";
import { describe, test } from "node:test";
import {
  describeStock,
  itemsNeeded,
  pricePerItem,
  packLabel,
  stockBreakdown,
  unitsAvailable,
  validatePackSize,
} from "./units.js";

describe("packLabel", () => {
  test("says how many are in the pack", () => {
    assert.strictEqual(packLabel("Pack", 12), "Pack of 12");
    assert.strictEqual(packLabel("  Box ", 24), "Box of 24");
  });
  test("leaves a name that already carries a number alone", () => {
    assert.strictEqual(packLabel("5 kg bag", 5), "5 kg bag");
    assert.strictEqual(packLabel("Dozen 12", 12), "Dozen 12");
  });
});

describe("validatePackSize", () => {
  const good = { name: "Pack", quantity: 12, sellingPrice: 40 };
  test("accepts a sensible pack", () => assert.deepStrictEqual(validatePackSize(good), []));
  test("needs a name, at most 40 characters", () => {
    assert.ok(validatePackSize({ ...good, name: "  " }).some((e) => /name/i.test(e)));
    assert.ok(validatePackSize({ ...good, name: "x".repeat(41) }).some((e) => /40/.test(e)));
  });
  test("needs a whole number of items, two or more", () => {
    for (const quantity of [1, 0, -3, 2.5, Number.NaN]) {
      assert.ok(validatePackSize({ ...good, quantity }).some((e) => /whole number/.test(e)), String(quantity));
    }
    assert.deepStrictEqual(validatePackSize({ ...good, quantity: 2 }), []);
  });
  test("needs a price above zero", () => {
    for (const sellingPrice of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.ok(validatePackSize({ ...good, sellingPrice }).some((e) => /price/.test(e)), String(sellingPrice));
    }
  });
  test("refuses the same name or the same size twice on one product", () => {
    assert.ok(validatePackSize(good, [{ name: "pack", quantity: 6 }]).some((e) => /called/.test(e)));
    assert.ok(validatePackSize(good, [{ name: "Dozen", quantity: 12 }]).some((e) => /hold 12/.test(e)));
    assert.deepStrictEqual(validatePackSize(good, [{ name: "Box", quantity: 24 }]), []);
  });
});

describe("stock arithmetic", () => {
  test("itemsNeeded counts packs by their size", () => {
    assert.strictEqual(itemsNeeded([{ quantity: 2, unitQuantity: 12 }, { quantity: 7 }, { quantity: 1, unitQuantity: null }]), 32);
    assert.strictEqual(itemsNeeded([]), 0);
  });
  test("unitsAvailable subtracts what the cart already claims", () => {
    assert.strictEqual(unitsAvailable(30, 0, 12), 2);
    assert.strictEqual(unitsAvailable(30, 7, 12), 1);
    assert.strictEqual(unitsAvailable(30, 30, 1), 0);
    assert.strictEqual(unitsAvailable(30, 40, 1), 0);
    assert.strictEqual(unitsAvailable(11, 0, 12), 0);
    assert.strictEqual(unitsAvailable(5, 0, 1), 5);
  });
});

describe("stock breakdown", () => {
  const packs = [{ name: "Pack", quantity: 12 }, { name: "Box", quantity: 48 }];
  test("uses the biggest packs first and keeps the rest as singles", () => {
    const b = stockBreakdown(110, packs);
    assert.deepStrictEqual(b.packs.map((p) => [p.name, p.count]), [["Box", 2], ["Pack", 1]]);
    assert.strictEqual(b.singles, 2);
  });
  test("describes it in words", () => {
    assert.strictEqual(describeStock(110, packs), "2 × Box of 48 + 1 × Pack of 12 + 2 singles");
    assert.strictEqual(describeStock(24, packs), "2 × Pack of 12");
    assert.strictEqual(describeStock(13, packs), "1 × Pack of 12 + 1 single");
  });
  test("says nothing when the stock is smaller than every pack, or there are no packs", () => {
    assert.strictEqual(describeStock(11, packs), null);
    assert.strictEqual(describeStock(50, []), null);
    assert.strictEqual(describeStock(0, packs), null);
  });
  test("ignores negative or fractional stock rather than breaking", () => {
    assert.strictEqual(describeStock(-5, packs), null);
    assert.strictEqual(stockBreakdown(12.9, packs).packs[0].count, 1);
  });
});

test("pricePerItem divides the pack price by its size", () => {
  assert.strictEqual(pricePerItem({ sellingPrice: 40, quantity: 12 }).toFixed(4), "3.3333");
});
