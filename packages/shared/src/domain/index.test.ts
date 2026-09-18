import assert from "node:assert";
import { test, describe } from "node:test";
import {
  calculateSaleTotal,
  roundCurrency,
  validateProductInput,
  validateSaleInput,
} from "./index.js";

describe("domain business logic", () => {
  describe("roundCurrency", () => {
    test("rounds values to 2 decimal places", () => {
      assert.strictEqual(roundCurrency(10.555), 10.56);
      assert.strictEqual(roundCurrency(10.5), 10.5);
      assert.strictEqual(roundCurrency(0.1 + 0.2), 0.3);
    });
  });

  describe("calculateSaleTotal", () => {
    test("calculates subtotal and total accurately without discount", () => {
      const lines = [
        { productId: "p1", quantity: 2, unitPrice: 15.5, unitCost: 10 },
        { productId: "p2", quantity: 1, unitPrice: 9.0, unitCost: 5 },
      ];
      const result = calculateSaleTotal(lines, 0);
      assert.strictEqual(result.subtotal, 40.0);
      assert.strictEqual(result.discount, 0);
      assert.strictEqual(result.total, 40.0);
    });

    test("applies discount correctly", () => {
      const lines = [
        { productId: "p1", quantity: 2, unitPrice: 10.0, unitCost: 5 },
      ];
      const result = calculateSaleTotal(lines, 5);
      assert.strictEqual(result.subtotal, 20.0);
      assert.strictEqual(result.discount, 5.0);
      assert.strictEqual(result.total, 15.0);
    });

    test("caps discount at subtotal to prevent negative total or excess discount", () => {
      const lines = [
        { productId: "p1", quantity: 1, unitPrice: 10.0, unitCost: 5 },
      ];
      const result = calculateSaleTotal(lines, 25);
      assert.strictEqual(result.subtotal, 10.0);
      assert.strictEqual(result.discount, 10.0);
      assert.strictEqual(result.total, 0);
    });

    test("handles negative discount input safely", () => {
      const lines = [
        { productId: "p1", quantity: 1, unitPrice: 10.0, unitCost: 5 },
      ];
      const result = calculateSaleTotal(lines, -5);
      assert.strictEqual(result.subtotal, 10.0);
      assert.strictEqual(result.discount, 0);
      assert.strictEqual(result.total, 10.0);
    });
  });

  describe("validateProductInput", () => {
    test("returns no errors for valid input", () => {
      const errors = validateProductInput({
        name: "Test Product",
        costPrice: 5.0,
        sellingPrice: 10.0,
        stock: 20,
      });
      assert.strictEqual(errors.length, 0);
    });

    test("validates required name, price bounds, and stock", () => {
      const errors = validateProductInput({
        name: "",
        costPrice: -1,
        sellingPrice: 0,
        stock: -5,
      });
      assert.ok(errors.length >= 3);
      assert.ok(errors.some((e) => e.includes("Product name is required")));
      assert.ok(errors.some((e) => e.includes("Cost price must be zero or greater")));
      assert.ok(errors.some((e) => e.includes("Selling price must be greater than zero")));
    });
  });

  describe("validateSaleInput", () => {
    test("returns no errors for valid sale input", () => {
      const errors = validateSaleInput({
        cashierId: "c1",
        paymentMethod: "cash",
        lines: [{ productId: "p1", quantity: 2, unitPrice: 10, unitCost: 5 }],
      });
      assert.strictEqual(errors.length, 0);
    });

    test("flags missing cashier or empty lines", () => {
      const errors = validateSaleInput({
        cashierId: "",
        paymentMethod: "cash",
        lines: [],
      });
      assert.ok(errors.length >= 2);
    });
  });
});
