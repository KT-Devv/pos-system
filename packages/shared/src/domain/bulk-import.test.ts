import assert from "node:assert";
import { describe, test } from "node:test";
import {
  cellText,
  csvLine,
  IMPORT_MAX_ROWS,
  parseCsv,
  parseNumber,
  planProductImport,
  planStockImport,
  PRODUCT_COLUMNS,
  readTable,
  STOCK_COLUMNS,
  templateCsv,
  type ExistingCatalog,
  type ImportRecord,
} from "./bulk-import.js";

const BLANK = {
  name: "", category: "", costPrice: "", sellingPrice: "", wholesalePrice: "", stock: "", barcode: "", packName: "", packSize: "", packPrice: "", packBarcode: "",
  product: "", quantity: "", type: "", supplier: "", notes: "",
};
const record = (rowNumber: number, values: Partial<Record<keyof typeof BLANK, string>>): ImportRecord => ({ rowNumber, values: { ...BLANK, ...values } });

const empty: ExistingCatalog = { productNames: [], barcodes: [], categories: [] };

describe("cellText", () => {
  test("keeps every digit of a barcode stored as a number", () => {
    assert.strictEqual(cellText(5901234123457), "5901234123457");
  });
  test("cleans float noise and stray whitespace", () => {
    assert.strictEqual(cellText(0.1 + 0.2), "0.3");
    assert.strictEqual(cellText("  Milk  1L\n"), "Milk 1L");
    assert.strictEqual(cellText(null), "");
  });
});

describe("parseNumber", () => {
  test("accepts plain, thousands and decimal-comma forms", () => {
    assert.deepStrictEqual(parseNumber("8"), { value: 8 });
    assert.deepStrictEqual(parseNumber("8.50"), { value: 8.5 });
    assert.deepStrictEqual(parseNumber("1,250.50"), { value: 1250.5 });
    assert.deepStrictEqual(parseNumber("1.250,50"), { value: 1250.5 });
    assert.deepStrictEqual(parseNumber("12,5"), { value: 12.5 });
    assert.deepStrictEqual(parseNumber("GH₵ 70"), { value: 70 });
  });
  test("rejects text and ambiguous junk", () => {
    assert.ok("error" in parseNumber("abc"));
    assert.ok("error" in parseNumber("1,2,3"));
    assert.ok("error" in parseNumber(""));
  });
});

describe("parseCsv", () => {
  test("reads quotes, doubled quotes, embedded commas and newlines, CRLF and a BOM", () => {
    const rows = parseCsv('﻿Name,Notes\r\n"Milk, 1L","He said ""hi""\nthere"\r\nBread,\r\n');
    assert.deepStrictEqual(rows, [["Name", "Notes"], ["Milk, 1L", 'He said "hi"\nthere'], ["Bread", ""]]);
  });
  test("detects semicolon and tab separators", () => {
    assert.deepStrictEqual(parseCsv("a;b;c\n1;2;3"), [["a", "b", "c"], ["1", "2", "3"]]);
    assert.deepStrictEqual(parseCsv("a\tb\n1\t2"), [["a", "b"], ["1", "2"]]);
  });
  test("round-trips through csvLine", () => {
    const line = csvLine(["a,b", 'say "x"', "plain"]);
    assert.deepStrictEqual(parseCsv(line), [["a,b", 'say "x"', "plain"]]);
  });
});

describe("readTable", () => {
  test("maps headers by name or alias, ignoring case and spacing", () => {
    const reading = readTable(
      [["PRODUCT NAME", "Cost", "price", "Qty", "Colour"], ["Milk", 8, 12.5, 20, "white"], [], ["Bread", "5", "8", "", ""]],
      PRODUCT_COLUMNS,
    );
    assert.deepStrictEqual(reading.fileProblems, []);
    assert.deepStrictEqual(reading.ignoredColumns, ["Colour"]);
    assert.strictEqual(reading.records.length, 2);
    assert.strictEqual(reading.records[0].values.name, "Milk");
    assert.strictEqual(reading.records[0].values.sellingPrice, "12.5");
    assert.strictEqual(reading.records[0].values.stock, "20");
    assert.strictEqual(reading.records[1].rowNumber, 4);
  });
  test("reports missing required columns and an empty file", () => {
    assert.match(readTable([["Name", "Cost price"], ["x", "1"]], PRODUCT_COLUMNS).fileProblems[0], /Selling price/);
    assert.match(readTable([], PRODUCT_COLUMNS).fileProblems[0], /empty/);
    assert.match(readTable([["Name", "Cost price", "Selling price"]], PRODUCT_COLUMNS).fileProblems[0], /no rows/);
  });
  test("skips the template's example rows", () => {
    const reading = readTable(parseCsv(templateCsv("products")), PRODUCT_COLUMNS);
    assert.strictEqual(reading.records.length, 0);
    assert.strictEqual(reading.examplesIgnored, 3);
    const stock = readTable(parseCsv(templateCsv("stock")), STOCK_COLUMNS, ["product", "barcode"]);
    assert.strictEqual(stock.examplesIgnored, 3);
  });
  test("stock files need a product or barcode column", () => {
    const reading = readTable([["Quantity"], ["5"]], STOCK_COLUMNS, ["product", "barcode"]);
    assert.match(reading.fileProblems[0], /"Product" or "Barcode"/);
  });
  test("refuses more rows than the limit", () => {
    const table = [["Name", "Cost price", "Selling price"], ...Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => [`P${i}`, "1", "2"])];
    assert.match(readTable(table, PRODUCT_COLUMNS).fileProblems[0], /at most/);
  });
});

describe("planProductImport", () => {
  test("accepts a clean row and defaults stock to zero", () => {
    const plan = planProductImport([record(2, { name: " Milk  1L ", category: "Groceries", costPrice: "8", sellingPrice: "12.50" })], empty);
    assert.deepStrictEqual(plan.issues, []);
    assert.strictEqual(plan.rows[0].name, "Milk 1L");
    assert.strictEqual(plan.rows[0].stock, 0);
    assert.deepStrictEqual(plan.newCategories, ["Groceries"]);
  });

  test("reuses an existing category's spelling and only lists new ones once", () => {
    const plan = planProductImport(
      [
        record(2, { name: "A", category: "groceries", costPrice: "1", sellingPrice: "2" }),
        record(3, { name: "B", category: "Perfumes", costPrice: "1", sellingPrice: "2" }),
        record(4, { name: "C", category: "perfumes", costPrice: "1", sellingPrice: "2" }),
      ],
      { ...empty, categories: ["Groceries"] },
    );
    assert.strictEqual(plan.rows[0].category, "Groceries");
    assert.deepStrictEqual(plan.newCategories, ["Perfumes"]);
  });

  test("explains each problem with its row number", () => {
    const plan = planProductImport(
      [
        record(2, { name: "", costPrice: "1", sellingPrice: "2" }),
        record(3, { name: "No price", costPrice: "1" }),
        record(4, { name: "Free", costPrice: "1", sellingPrice: "0" }),
        record(5, { name: "Bad cost", costPrice: "abc", sellingPrice: "2" }),
        record(6, { name: "Fraction", costPrice: "1", sellingPrice: "2", stock: "1.5" }),
        record(7, { name: "Precise", costPrice: "1", sellingPrice: "2.555" }),
      ],
      empty,
    );
    assert.strictEqual(plan.rows.length, 0);
    assert.deepStrictEqual(plan.issues.map((i) => i.rowNumber), [2, 3, 4, 5, 6, 7]);
    assert.match(plan.issues[1].message, /Selling price is empty/);
    assert.match(plan.issues[2].message, /above zero/);
    assert.match(plan.issues[4].message, /whole number/);
    assert.match(plan.issues[5].message, /2 decimal places/);
  });

  test("leaves products that are already in the shop alone, ignoring case and spacing", () => {
    const plan = planProductImport(
      [record(2, { name: "milk   1l", costPrice: "8", sellingPrice: "12" }), record(3, { name: "Bread", costPrice: "5", sellingPrice: "8" })],
      { ...empty, productNames: ["Milk 1L"] },
    );
    assert.deepStrictEqual(plan.alreadyThere, [{ rowNumber: 2, name: "milk 1l" }]);
    assert.deepStrictEqual(plan.rows.map((r) => r.name), ["Bread"]);
  });

  test("catches a name listed twice and barcodes used twice, including UPC/EAN forms", () => {
    const plan = planProductImport(
      [
        record(2, { name: "A", costPrice: "1", sellingPrice: "2", barcode: "012345678905" }),
        record(3, { name: "a", costPrice: "1", sellingPrice: "2" }),
        record(4, { name: "B", costPrice: "1", sellingPrice: "2", barcode: "0012345678905" }),
        record(5, { name: "C", costPrice: "1", sellingPrice: "2", barcode: "KT-1" }),
      ],
      { ...empty, barcodes: ["KT-1"] },
    );
    assert.deepStrictEqual(plan.rows.map((r) => r.name), ["A"]);
    assert.match(plan.issues.find((i) => i.rowNumber === 3)!.message, /listed twice/);
    assert.match(plan.issues.find((i) => i.rowNumber === 4)!.message, /also used on row 2/);
    assert.match(plan.issues.find((i) => i.rowNumber === 5)!.message, /already used .* in your shop/);
  });

  test("reads an optional wholesale price and rejects a bad one", () => {
    const plan = planProductImport(
      [
        record(2, { name: "A", costPrice: "1", sellingPrice: "4", wholesalePrice: "6" }),
        record(3, { name: "B", costPrice: "1", sellingPrice: "4" }),
        record(4, { name: "C", costPrice: "1", sellingPrice: "4", wholesalePrice: "0" }),
        record(5, { name: "D", costPrice: "1", sellingPrice: "4", wholesalePrice: "lots" }),
      ],
      empty,
    );
    assert.deepStrictEqual(plan.rows.map((r) => [r.name, r.wholesalePrice]), [["A", 6], ["B", null]]);
    assert.match(plan.issues.find((i) => i.rowNumber === 4)!.message, /Wholesale price must be above zero/);
    assert.match(plan.issues.find((i) => i.rowNumber === 5)!.message, /Wholesale price "lots" is not a number/);
  });

  test("reads a pack size from the product's row and extra ones from follow-up rows", () => {
    const plan = planProductImport(
      [
        record(2, { name: "Milk", costPrice: "8", sellingPrice: "12.5", stock: "20", packName: "Carton", packSize: "24", packPrice: "260" }),
        record(3, { name: "Milk", packName: "Pack", packSize: "6", packPrice: "70", packBarcode: "MILK-6" }),
      ],
      empty,
    );
    assert.deepStrictEqual(plan.issues, []);
    assert.strictEqual(plan.rows.length, 1);
    assert.deepStrictEqual(plan.rows[0].packs.map((p) => [p.name, p.quantity, p.sellingPrice, p.barcode]), [["Carton", 24, 260, null], ["Pack", 6, 70, "MILK-6"]]);
    assert.strictEqual(plan.packCount, 2);
  });

  test("validates pack sizes the way the database does", () => {
    const plan = planProductImport(
      [
        record(2, { name: "A", costPrice: "1", sellingPrice: "2", packName: "Pack", packSize: "1", packPrice: "5" }),
        record(3, { name: "B", costPrice: "1", sellingPrice: "2", packName: "Pack", packSize: "6" }),
        record(4, { name: "C", costPrice: "1", sellingPrice: "2", packName: "Pack", packSize: "6", packPrice: "9" }),
        record(5, { name: "C", packName: "Pack", packSize: "12", packPrice: "15" }),
        record(6, { name: "C", packName: "Box", packSize: "6", packPrice: "15" }),
      ],
      empty,
    );
    assert.match(plan.issues.find((i) => i.rowNumber === 2)!.message, /2 or more/);
    assert.match(plan.issues.find((i) => i.rowNumber === 3)!.message, /Pack price/);
    assert.match(plan.issues.find((i) => i.rowNumber === 5)!.message, /called Pack/);
    assert.match(plan.issues.find((i) => i.rowNumber === 6)!.message, /hold 6 items/);
  });

  test("a pack-only row before its product is an error, and follow-ups of a bad row stay quiet", () => {
    const plan = planProductImport(
      [
        record(2, { name: "Orphan", packName: "Pack", packSize: "6", packPrice: "9" }),
        record(3, { name: "Bad", costPrice: "x", sellingPrice: "2" }),
        record(4, { name: "Bad", packName: "Pack", packSize: "6", packPrice: "9" }),
      ],
      empty,
    );
    assert.deepStrictEqual(plan.issues.map((i) => i.rowNumber), [2, 2, 3]);
    assert.match(plan.issues[0].message, /Cost price is empty/);
  });
});

describe("planStockImport", () => {
  const products = [
    { id: "p1", name: "Milk 1L", barcode: "5901234123457", stock: 20 },
    { id: "p2", name: "Soap", barcode: null, stock: 2 },
    { id: "p3", name: "Twin", barcode: null, stock: 0 },
    { id: "p4", name: "twin", barcode: null, stock: 0 },
  ];
  const suppliers = [{ id: "s1", name: "Fresh Farms" }];

  test("finds products by name or barcode and defaults to stock in", () => {
    const plan = planStockImport(
      [record(2, { product: "milk 1l", quantity: "48", supplier: "fresh farms", notes: "Weekly" }), record(3, { barcode: "05901234123457", quantity: "3", type: "Out" })],
      products,
      suppliers,
    );
    assert.deepStrictEqual(plan.issues, []);
    assert.deepStrictEqual(plan.rows.map((r) => [r.productId, r.type, r.quantity, r.supplierId, r.stockBefore, r.stockAfter]), [
      ["p1", "in", 48, "s1", 20, 68],
      ["p1", "out", 3, null, 68, 65],
    ]);
  });

  test("tracks running stock so a later row cannot take out more than is there", () => {
    const plan = planStockImport(
      [record(2, { product: "Soap", quantity: "5", type: "Out" }), record(3, { product: "Soap", quantity: "10", type: "Recount" }), record(4, { product: "Soap", quantity: "10", type: "Out" })],
      products,
      suppliers,
    );
    assert.strictEqual(plan.issues.length, 1);
    assert.strictEqual(plan.issues[0].rowNumber, 2);
    assert.match(plan.issues[0].message, /only 2 in stock/);
    assert.deepStrictEqual(plan.rows.map((r) => [r.type, r.stockAfter]), [["adjustment", 10], ["out", 0]]);
  });

  test("allows a recount to zero but not stock in or out of zero", () => {
    const plan = planStockImport(
      [record(2, { product: "Soap", quantity: "0", type: "Recount" }), record(3, { product: "Soap", quantity: "0", type: "In" })],
      products,
      suppliers,
    );
    assert.strictEqual(plan.rows.length, 1);
    assert.match(plan.issues[0].message, /1 or more/);
  });

  test("explains unknown, ambiguous and mismatched products, types and suppliers", () => {
    const plan = planStockImport(
      [
        record(2, { product: "Nope", quantity: "1" }),
        record(3, { product: "Twin", quantity: "1" }),
        record(4, { barcode: "5901234123457", product: "Soap", quantity: "1" }),
        record(5, { product: "Soap", quantity: "1", type: "sideways" }),
        record(6, { product: "Soap", quantity: "1", supplier: "Ghost" }),
        record(7, { quantity: "1" }),
        record(8, { barcode: "000", quantity: "1" }),
      ],
      products,
      suppliers,
    );
    assert.strictEqual(plan.rows.length, 0);
    assert.deepStrictEqual(plan.issues.map((i) => i.rowNumber), [2, 3, 4, 5, 6, 7, 8]);
    assert.match(plan.issues[0].message, /No product is called/);
    assert.match(plan.issues[1].message, /2 products are called/);
    assert.match(plan.issues[2].message, /belongs to Milk 1L/);
    assert.match(plan.issues[3].message, /In, Out or Recount/);
    assert.match(plan.issues[4].message, /No supplier/);
  });
});
