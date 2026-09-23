import assert from "node:assert";
import { describe, test } from "node:test";
import {
  barcodeCandidates,
  barcodeFromScan,
  barcodesMatch,
  canEncodeCode128,
  code128Bars,
  code128Modules,
  CODE128_MAX_LENGTH,
  ean13CheckDigit,
  findByBarcode,
  generateInternalBarcode,
  isValidEan13,
  normalizeBarcode,
} from "./barcode.js";

describe("code128", () => {
  // Expected values come from JsBarcode (an independent Code 128 implementation), not from this module.
  test("encodes a single character", () => {
    assert.strictEqual(code128Modules("A"), "1101001000010100011000100010110001100011101011");
  });

  test("encodes a store code with a hyphen", () => {
    assert.strictEqual(
      code128Modules("KT-0001"),
      "1101001000010110001110110111000101001101110010011101100100111011001001110110010011100110110110001101100011101011",
    );
  });

  test("width is 11 modules per symbol plus the 2-module stop bar", () => {
    for (const text of ["7", "12345", "2000000000017"]) {
      assert.strictEqual(code128Modules(text).length, 11 * (text.length + 3) + 2);
    }
  });

  test("starts with the start-B symbol and ends with the stop pattern", () => {
    const modules = code128Modules("ABC");
    assert.ok(modules.startsWith("11010010000"));
    assert.ok(modules.endsWith("1100011101011"));
  });

  test("merges adjacent bar modules into rectangles that reproduce the symbol", () => {
    const { bars, modules } = code128Bars("KT-0001");
    const rebuilt = Array.from({ length: modules }, () => "0");
    for (const bar of bars) for (let i = 0; i < bar.width; i += 1) rebuilt[bar.x + i] = "1";
    assert.strictEqual(rebuilt.join(""), code128Modules("KT-0001"));
    assert.ok(bars.every((bar, index) => index === 0 || bar.x > bars[index - 1].x + bars[index - 1].width));
  });

  test("rejects text it cannot encode", () => {
    assert.strictEqual(canEncodeCode128(""), false);
    assert.strictEqual(canEncodeCode128("caf" + String.fromCharCode(233)), false);
    assert.strictEqual(canEncodeCode128("tab" + String.fromCharCode(9)), false);
    assert.strictEqual(canEncodeCode128("x".repeat(CODE128_MAX_LENGTH + 1)), false);
    assert.strictEqual(canEncodeCode128("x".repeat(CODE128_MAX_LENGTH)), true);
    assert.throws(() => code128Modules(""), /Cannot encode/);
  });
});

describe("scanned codes", () => {
  test("normalizeBarcode strips the Enter and Tab a scanner appends", () => {
    assert.strictEqual(normalizeBarcode("5901234123457\r\n"), "5901234123457");
    assert.strictEqual(normalizeBarcode("\t 123 "), "123");
  });

  test("a UPC-A code matches the EAN-13 form with a leading zero, in either direction", () => {
    assert.ok(barcodesMatch("012345678905", "0012345678905"));
    assert.ok(barcodesMatch("0012345678905", "012345678905"));
  });

  test("a GTIN-14 matches the same number as UPC-A or EAN-13", () => {
    assert.ok(barcodesMatch("05901234123457", "5901234123457"));
    assert.ok(barcodesMatch("00012345678905", "012345678905"));
  });

  test("a GTIN-14 with a packaging digit is a different product", () => {
    assert.ok(!barcodesMatch("15901234123454", "5901234123454"));
  });

  test("different numbers never match", () => {
    assert.ok(!barcodesMatch("012345678905", "012345678906"));
    assert.ok(!barcodesMatch("", ""));
    assert.ok(!barcodesMatch("ABC", "ABD"));
  });

  test("leading zeros only count as the same code for 12- and 13-digit numbers", () => {
    assert.ok(!barcodesMatch("0123", "123"));
    assert.ok(!barcodesMatch("00000123", "123"));
  });

  test("findByBarcode prefers an exact match over the UPC/EAN equivalent", () => {
    const items = [
      { id: "ean", barcode: "0012345678905" },
      { id: "upc", barcode: "012345678905" },
    ];
    assert.strictEqual(findByBarcode(items, "012345678905\n")?.id, "upc");
    assert.strictEqual(findByBarcode(items, "0012345678905")?.id, "ean");
    assert.strictEqual(findByBarcode([{ id: "ean", barcode: "0012345678905" }], "012345678905")?.id, "ean");
    assert.strictEqual(findByBarcode(items, "999"), undefined);
    assert.strictEqual(findByBarcode([{ id: "none", barcode: null }], "999"), undefined);
    assert.strictEqual(findByBarcode(items, "  "), undefined);
  });
});

describe("QR codes", () => {
  const ean = "5901234123457";

  test("a GS1 Digital Link yields the barcode inside it", () => {
    assert.strictEqual(barcodeFromScan("https://id.gs1.org/01/05901234123457"), ean);
    assert.strictEqual(barcodeFromScan("https://id.gs1.org/01/05901234123457/10/LOT42?17=270101"), ean);
    assert.strictEqual(barcodeFromScan("https://brand.example/01/05901234123457?utm=x"), ean);
  });

  test("a GS1 element string yields the barcode inside it", () => {
    assert.strictEqual(barcodeFromScan("(01)05901234123457(17)270101"), ean);
    assert.strictEqual(barcodeFromScan("0105901234123457" + "17270101"), ean);
  });

  test("a plain code is kept as it is", () => {
    assert.strictEqual(barcodeFromScan("KT-0001\r\n"), "KT-0001");
    assert.strictEqual(barcodeFromScan(ean), ean);
  });

  test("keeps all 14 digits when the GTIN does not start with zero", () => {
    assert.strictEqual(barcodeFromScan("https://id.gs1.org/01/15901234123454"), "15901234123454");
  });

  test("candidates start with the scan itself, then what is inside it", () => {
    assert.deepStrictEqual(barcodeCandidates("https://id.gs1.org/01/05901234123457"), [
      "https://id.gs1.org/01/05901234123457",
      "5901234123457",
      "05901234123457",
    ]);
  });

  test("looks in the usual query parameters and the last path segment of a link", () => {
    assert.ok(barcodeCandidates("https://shop.example/p?barcode=ABC123&x=1").includes("ABC123"));
    assert.ok(barcodeCandidates("https://shop.example/items/KT-0001").includes("KT-0001"));
    assert.ok(barcodeCandidates("https://shop.example/items/caf%C3%A9").includes("caf" + String.fromCharCode(233)));
  });

  test("nothing to read gives no candidates, and an unreadable link is not fatal", () => {
    assert.deepStrictEqual(barcodeCandidates("  "), []);
    assert.deepStrictEqual(barcodeCandidates("http://"), ["http://"]);
  });

  test("findByBarcode finds a product from a QR link, an element string or the bare number", () => {
    const items = [{ id: "milk", barcode: ean }, { id: "rice", barcode: "KT-0001" }];
    assert.strictEqual(findByBarcode(items, "https://id.gs1.org/01/05901234123457")?.id, "milk");
    assert.strictEqual(findByBarcode(items, "(01)05901234123457")?.id, "milk");
    assert.strictEqual(findByBarcode(items, "https://shop.example/items/KT-0001")?.id, "rice");
    assert.strictEqual(findByBarcode(items, "https://id.gs1.org/01/09999999999994"), undefined);
  });

  test("a stored code that is itself a link still matches exactly", () => {
    const link = "https://shop.example/items/rice";
    assert.strictEqual(findByBarcode([{ id: "rice", barcode: link }, { id: "other", barcode: "rice" }], link)?.id, "rice");
  });
});

describe("EAN-13", () => {
  test("computes the check digit", () => {
    assert.strictEqual(ean13CheckDigit("590123412345"), 7);
    assert.strictEqual(ean13CheckDigit("200000000001"), 5); // 2 + 1x3 = 5, so 10 - 5
    assert.strictEqual(ean13CheckDigit("000000000000"), 0);
  });

  test("validates a full code", () => {
    assert.ok(isValidEan13("5901234123457"));
    assert.ok(!isValidEan13("5901234123458"));
    assert.ok(!isValidEan13("590123412345"));
    assert.ok(!isValidEan13("59012341234a7"));
  });

  test("rejects a body that is not twelve digits", () => {
    assert.throws(() => ean13CheckDigit("12345"), /12 digits/);
  });
});

describe("generateInternalBarcode", () => {
  test("makes a valid EAN-13 in the in-store 2xx range", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateInternalBarcode([]);
      assert.ok(isValidEan13(code), code);
      assert.ok(code.startsWith("2"), code);
    }
  });

  test("skips codes that are already taken", () => {
    // The first attempt draws eleven zeros, the second starts with a 1.
    const sequence = [...Array(11).fill(0), 0.1, ...Array(10).fill(0)];
    let index = 0;
    const random = () => sequence[index++ % sequence.length];
    const first = "2" + "0".repeat(11);
    const taken = [first + ean13CheckDigit(first), null];
    const code = generateInternalBarcode(taken, random);
    assert.ok(!taken.includes(code));
    assert.ok(isValidEan13(code));
  });

  test("gives up rather than loop forever when nothing is free", () => {
    const body = "2" + "5".repeat(11);
    const stuck = body + ean13CheckDigit(body);
    assert.throws(() => generateInternalBarcode([stuck], () => 0.5), /unused barcode/);
  });
});
