import assert from "node:assert";
import { describe, test } from "node:test";
import { COUNTRIES, CURRENCIES, currencyForCountry, isSupportedCurrency } from "./currencies.js";
import {
  canManageShop,
  canRemoveMember,
  invitableRoles,
  loyaltyPointsFor,
  stockLevel,
  validateShopInput,
  type ShopInput,
} from "./shop.js";

const valid: ShopInput = {
  name: "Alpha Mart",
  currency: "GHS",
  country: "GH",
  phone: "024 000 0000",
  email: "shop@alpha.test",
  address: "Accra",
  lowStockThreshold: 5,
  loyaltyEnabled: true,
  loyaltySpendPerPoint: 10,
};

describe("validateShopInput", () => {
  test("accepts a complete, valid shop", () => {
    assert.deepStrictEqual(validateShopInput(valid), []);
  });

  test("requires a real name (2 to 80 characters, ignoring surrounding spaces)", () => {
    assert.ok(validateShopInput({ ...valid, name: "" }).some((e) => /name/i.test(e)));
    assert.ok(validateShopInput({ ...valid, name: "  A  " }).some((e) => /name/i.test(e)));
    assert.ok(validateShopInput({ ...valid, name: "x".repeat(81) }).some((e) => /at most/i.test(e)));
    assert.deepStrictEqual(validateShopInput({ ...valid, name: "  Ok  " }), []);
  });

  test("only accepts currencies from the supported list", () => {
    assert.ok(validateShopInput({ ...valid, currency: "" }).some((e) => /currency/i.test(e)));
    assert.ok(validateShopInput({ ...valid, currency: "ghs" }).some((e) => /currency/i.test(e)), "case matters: codes are upper-case");
    assert.ok(validateShopInput({ ...valid, currency: "KWD" }).some((e) => /currency/i.test(e)), "3-decimal currencies are unsupported");
    assert.deepStrictEqual(validateShopInput({ ...valid, currency: "USD" }), []);
  });

  test("email is optional but must look like an email when given", () => {
    assert.deepStrictEqual(validateShopInput({ ...valid, email: "" }), []);
    assert.deepStrictEqual(validateShopInput({ ...valid, email: null }), []);
    assert.ok(validateShopInput({ ...valid, email: "not-an-email" }).some((e) => /email/i.test(e)));
  });

  test("low-stock level must be a whole number, zero or more", () => {
    assert.deepStrictEqual(validateShopInput({ ...valid, lowStockThreshold: 0 }), []);
    assert.ok(validateShopInput({ ...valid, lowStockThreshold: -1 }).length > 0);
    assert.ok(validateShopInput({ ...valid, lowStockThreshold: 2.5 }).length > 0);
    assert.ok(validateShopInput({ ...valid, lowStockThreshold: Number.NaN }).length > 0);
  });

  test("the loyalty rate only matters while loyalty is switched on", () => {
    assert.ok(validateShopInput({ ...valid, loyaltySpendPerPoint: 0 }).some((e) => /loyalty/i.test(e)));
    assert.ok(validateShopInput({ ...valid, loyaltySpendPerPoint: -5 }).some((e) => /loyalty/i.test(e)));
    assert.deepStrictEqual(validateShopInput({ ...valid, loyaltyEnabled: false, loyaltySpendPerPoint: 0 }), []);
  });

  test("reports every problem at once", () => {
    const errors = validateShopInput({ ...valid, name: "", currency: "??", lowStockThreshold: -1, loyaltySpendPerPoint: 0 });
    assert.strictEqual(errors.length, 4);
  });
});

describe("roles", () => {
  test("owners and admins manage the shop; cashiers and nobody do not", () => {
    assert.strictEqual(canManageShop("owner"), true);
    assert.strictEqual(canManageShop("admin"), true);
    assert.strictEqual(canManageShop("cashier"), false);
    assert.strictEqual(canManageShop(null), false);
    assert.strictEqual(canManageShop(undefined), false);
  });

  test("owners invite admins and cashiers, admins only cashiers, cashiers no one", () => {
    assert.deepStrictEqual(invitableRoles("owner"), ["admin", "cashier"]);
    assert.deepStrictEqual(invitableRoles("admin"), ["cashier"]);
    assert.deepStrictEqual(invitableRoles("cashier"), []);
    assert.deepStrictEqual(invitableRoles(null), []);
  });

  test("nobody can remove the owner; admins can only remove cashiers", () => {
    assert.strictEqual(canRemoveMember("owner", "owner"), false);
    assert.strictEqual(canRemoveMember("admin", "owner"), false);
    assert.strictEqual(canRemoveMember("owner", "admin"), true);
    assert.strictEqual(canRemoveMember("owner", "cashier"), true);
    assert.strictEqual(canRemoveMember("admin", "cashier"), true);
    assert.strictEqual(canRemoveMember("admin", "admin"), false);
    assert.strictEqual(canRemoveMember("cashier", "cashier"), false);
    assert.strictEqual(canRemoveMember(null, "cashier"), false);
  });
});

describe("loyaltyPointsFor", () => {
  const on = { loyaltyEnabled: true, loyaltySpendPerPoint: 10 };
  test("awards whole points, rounding down", () => {
    assert.strictEqual(loyaltyPointsFor(25, on), 2);
    assert.strictEqual(loyaltyPointsFor(9.99, on), 0);
    assert.strictEqual(loyaltyPointsFor(10, on), 1);
    assert.strictEqual(loyaltyPointsFor(25, { ...on, loyaltySpendPerPoint: 5 }), 5);
  });
  test("awards nothing when off, on a free sale, or with a broken rate", () => {
    assert.strictEqual(loyaltyPointsFor(100, { ...on, loyaltyEnabled: false }), 0);
    assert.strictEqual(loyaltyPointsFor(0, on), 0);
    assert.strictEqual(loyaltyPointsFor(-5, on), 0);
    assert.strictEqual(loyaltyPointsFor(100, { ...on, loyaltySpendPerPoint: 0 }), 0);
  });
});

describe("stockLevel", () => {
  test("classifies stock against the shop's own threshold", () => {
    assert.strictEqual(stockLevel(0, 5), "out");
    assert.strictEqual(stockLevel(-2, 5), "out");
    assert.strictEqual(stockLevel(4, 5), "low");
    assert.strictEqual(stockLevel(5, 5), "ok", "at the threshold is fine; only below it is low");
    assert.strictEqual(stockLevel(1, 0), "ok", "a threshold of zero switches low-stock warnings off");
    assert.strictEqual(stockLevel(30, 50), "low");
  });
});

describe("currency catalogue", () => {
  test("codes are unique and well formed", () => {
    const codes = CURRENCIES.map((c) => c.code);
    assert.strictEqual(new Set(codes).size, codes.length);
    for (const code of codes) assert.match(code, /^[A-Z]{3}$/);
    const countries = COUNTRIES.map((c) => c.code);
    assert.strictEqual(new Set(countries).size, countries.length);
    for (const code of countries) assert.match(code, /^[A-Z]{2}$/);
  });

  test("every country points at a listed currency", () => {
    for (const country of COUNTRIES) {
      assert.ok(isSupportedCurrency(country.currency), `${country.name} -> ${country.currency}`);
    }
  });

  test("every currency is understood by Intl and uses 0 or 2 decimals", () => {
    for (const { code } of CURRENCIES) {
      const formatter = new Intl.NumberFormat("en", { style: "currency", currency: code });
      const digits = formatter.resolvedOptions().maximumFractionDigits;
      assert.ok(digits === 0 || digits === 2, `${code} uses ${digits} decimals, which numeric(12,2) cannot store faithfully`);
    }
  });

  test("lists are alphabetical so the pickers are easy to scan", () => {
    const names = COUNTRIES.map((c) => c.name.normalize("NFD").replace(/[̀-ͯ]/g, ""));
    assert.deepStrictEqual(names, [...names].sort((a, b) => a.localeCompare(b, "en")));
    const codes = CURRENCIES.map((c) => c.code);
    assert.deepStrictEqual(codes, [...codes].sort());
  });

  test("looks up a country's usual currency", () => {
    assert.strictEqual(currencyForCountry("GH"), "GHS");
    assert.strictEqual(currencyForCountry("NG"), "NGN");
    assert.strictEqual(currencyForCountry("FR"), "EUR");
    assert.strictEqual(currencyForCountry("ZZ"), undefined);
    assert.strictEqual(currencyForCountry(null), undefined);
  });
});
