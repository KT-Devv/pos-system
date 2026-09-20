import assert from "node:assert";
import { afterEach, describe, test } from "node:test";
import { configureMoney, currencyDecimals, currencySymbol, formatCurrency, getMoneyConfig, initials } from "./utils.js";

describe("money formatting follows the shop's currency", () => {
  afterEach(() => configureMoney({ currency: "USD", locale: undefined }));

  test("formats in the configured currency and locale", () => {
    configureMoney({ currency: "GHS", locale: "en" });
    assert.strictEqual(formatCurrency(1234.5), "GH₵1,234.50");
    configureMoney({ currency: "USD" });
    assert.strictEqual(formatCurrency(1234.5), "$1,234.50");
    configureMoney({ currency: "NGN" });
    assert.strictEqual(formatCurrency(99), "₦99.00");
  });

  test("an explicit currency overrides the configured one", () => {
    configureMoney({ currency: "GHS", locale: "en" });
    assert.strictEqual(formatCurrency(5, "USD"), "$5.00");
  });

  test("zero-decimal currencies show no cents", () => {
    configureMoney({ currency: "JPY", locale: "en" });
    assert.strictEqual(formatCurrency(1234), "¥1,234");
    assert.strictEqual(currencyDecimals("JPY"), 0);
    assert.strictEqual(currencyDecimals("XOF"), 0);
    assert.strictEqual(currencyDecimals("GHS"), 2);
  });

  test("respects the viewer's locale conventions", () => {
    configureMoney({ currency: "EUR", locale: "fr" });
    assert.match(formatCurrency(1234.5), /1\s234,50\s€/);
  });

  test("symbol helper gives the prefix for inputs", () => {
    configureMoney({ locale: "en" });
    assert.strictEqual(currencySymbol("GHS"), "GH₵");
    assert.strictEqual(currencySymbol("USD"), "$");
    assert.strictEqual(currencySymbol("EUR"), "€");
    configureMoney({ currency: "ZAR" });
    assert.strictEqual(currencySymbol(), "R");
  });

  test("negative amounts and zero format sensibly", () => {
    configureMoney({ currency: "USD", locale: "en" });
    assert.strictEqual(formatCurrency(0), "$0.00");
    assert.strictEqual(formatCurrency(-3.5), "-$3.50");
  });

  test("configuring one field keeps the other", () => {
    configureMoney({ currency: "KES", locale: "en" });
    configureMoney({ currency: "TZS" });
    assert.strictEqual(getMoneyConfig().locale, "en");
    assert.strictEqual(getMoneyConfig().currency, "TZS");
  });
});

describe("initials", () => {
  test("uses first and last names", () => {
    assert.strictEqual(initials("Ama Mensah"), "AM");
    assert.strictEqual(initials("Kofi Owusu Boateng"), "KB");
    assert.strictEqual(initials("  spaced   out  "), "SO");
  });
  test("handles single names and blanks", () => {
    assert.strictEqual(initials("Ama"), "A");
    assert.strictEqual(initials(""), "?");
    assert.strictEqual(initials("   "), "?");
  });
});
