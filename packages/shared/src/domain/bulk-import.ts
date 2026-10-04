/**
 * Bulk entry of products and stock from a spreadsheet (.xlsx) or CSV file.
 *
 * Everything here is pure: the screen reads the file into a table of cells, this module maps its
 * columns, checks every row the way the database will, and says exactly which row has which problem
 * before anything is sent. The database re-checks everything (bulk_import_products and
 * bulk_record_stock), so this is for clear messages, not for trust.
 */
import { findByBarcode, normalizeBarcode } from "./barcode.js";
import { PACK_NAME_MAX, validatePackSize } from "./units.js";

export const IMPORT_MAX_ROWS = 2000;
export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const IMPORT_NAME_MAX = 120;
export const IMPORT_CATEGORY_MAX = 80;
export const IMPORT_BARCODE_MAX = 64;
export const IMPORT_NOTES_MAX = 500;
/** A row with a cell that starts with this is an example from the template and is skipped. */
export const EXAMPLE_PREFIX = "e.g.";

const MAX_MONEY = 9_999_999_999.99;
const MAX_COUNT = 1_000_000_000;

export type ImportKind = "products" | "stock";
export type Cell = string | number | boolean | Date | null | undefined;
export type RawTable = readonly (readonly Cell[])[];

export interface ImportColumn {
  key: string;
  header: string;
  required: boolean;
  /** Other spellings of the header that are accepted, already lower-cased with only letters and digits. */
  aliases: readonly string[];
  help: string;
}

export interface ImportIssue {
  rowNumber: number;
  message: string;
}

export interface ImportRecord {
  /** The row's number in the file, counting the header as row 1, as a spreadsheet shows it. */
  rowNumber: number;
  values: Record<string, string>;
}

export interface TableReading {
  records: ImportRecord[];
  /** Problems with the file as a whole (a missing column, too many rows). Nothing can be imported while any exist. */
  fileProblems: string[];
  /** Headers in the file that this import does not use. */
  ignoredColumns: string[];
  examplesIgnored: number;
}

// ---- Columns -----------------------------------------------------------------------------------

export const PRODUCT_COLUMNS: readonly ImportColumn[] = [
  { key: "name", header: "Name", required: true, aliases: ["product", "productname", "item", "itemname"], help: "The product's name, for example Milk 1L. Required." },
  { key: "category", header: "Category", required: false, aliases: ["categoryname", "group"], help: "Created for you if it does not exist yet. Leave blank for no category." },
  { key: "costPrice", header: "Cost price", required: true, aliases: ["cost", "buyingprice", "purchaseprice"], help: "What one item costs you. Required. A number such as 8 or 8.50, without a currency symbol." },
  { key: "sellingPrice", header: "Selling price", required: true, aliases: ["price", "sellprice", "regularprice"], help: "What one item sells for. Required, above zero." },
  { key: "retailPrice", header: "Retail price", required: false, aliases: ["retail", "retailsellingprice"], help: "Optional second price for retail sales. Leave blank if the product only has one price." },
  { key: "stock", header: "Stock", required: false, aliases: ["quantity", "qty", "stockonhand", "openingstock"], help: "How many single items you have now, as a whole number. Blank means 0." },
  { key: "barcode", header: "Barcode", required: false, aliases: ["barcodeqr", "code", "ean", "upc", "sku"], help: "Optional. Numbers that start with 0 may lose it in Excel: format the column as Text first." },
  { key: "packName", header: "Pack name", required: false, aliases: ["packsizename"], help: "Optional pack size, such as Pack, Box or Strip." },
  { key: "packSize", header: "Pack size", required: false, aliases: ["packquantity", "itemsinpack", "packqty"], help: "How many single items are in the pack: a whole number, 2 or more." },
  { key: "packPrice", header: "Pack price", required: false, aliases: ["packsellingprice"], help: "What the whole pack sells for. Above zero." },
  { key: "packBarcode", header: "Pack barcode", required: false, aliases: ["packcode"], help: "Optional barcode printed on the pack." },
];

export const STOCK_COLUMNS: readonly ImportColumn[] = [
  { key: "product", header: "Product", required: false, aliases: ["name", "productname", "item", "itemname"], help: "The product's name exactly as it is in your shop. Give this or the barcode." },
  { key: "barcode", header: "Barcode", required: false, aliases: ["code", "ean", "upc", "sku"], help: "The product's barcode. Give this or the product name." },
  { key: "quantity", header: "Quantity", required: true, aliases: ["qty", "count", "units"], help: "A whole number of single items. For a recount, the number you counted." },
  { key: "type", header: "Type", required: false, aliases: ["movement", "action", "kind"], help: "In (stock received, the default), Out (damage, samples, transfers) or Recount (sets the stock to the counted number)." },
  { key: "supplier", header: "Supplier", required: false, aliases: ["suppliername", "vendor"], help: "For stock In only. Must already be in your suppliers list." },
  { key: "notes", header: "Notes", required: false, aliases: ["note", "comment", "comments", "reference"], help: "Optional, up to 500 characters." },
];

export const PRODUCT_EXAMPLES: readonly (readonly string[])[] = [
  ["e.g. Milk 1L", "Groceries", "8", "12.50", "14", "20", "5901234123457", "Carton", "24", "260", ""],
  ["e.g. Milk 1L", "", "", "", "", "", "", "Pack", "6", "70", ""],
  ["e.g. Soap", "Household", "3", "6", "", "", "", "", "", "", ""],
];

export const STOCK_EXAMPLES: readonly (readonly string[])[] = [
  ["e.g. Milk 1L", "", "48", "In", "Fresh Farms", "Weekly delivery"],
  ["", "5901234123457", "3", "Out", "", "e.g. Damaged in transit"],
  ["e.g. Soap", "", "12", "Recount", "", "Stocktake"],
];

export function columnsFor(kind: ImportKind): readonly ImportColumn[] {
  return kind === "products" ? PRODUCT_COLUMNS : STOCK_COLUMNS;
}

export function examplesFor(kind: ImportKind): readonly (readonly string[])[] {
  return kind === "products" ? PRODUCT_EXAMPLES : STOCK_EXAMPLES;
}

// ---- Reading cells -----------------------------------------------------------------------------

/** A cell as trimmed text. Whole numbers keep every digit (a barcode must not turn into 5.9e12). */
export function cellText(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  let text: string;
  if (typeof cell === "number") {
    if (!Number.isFinite(cell)) return "";
    text = Number.isInteger(cell) && Math.abs(cell) < 1e15 ? String(cell) : String(Number(cell.toPrecision(12)));
  } else if (typeof cell === "boolean") text = cell ? "TRUE" : "FALSE";
  else if (cell instanceof Date) text = Number.isNaN(cell.getTime()) ? "" : cell.toISOString().slice(0, 10);
  else text = cell;
  return text.replace(/[\u0000-\u001f\u007f ​﻿]/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeHeader(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Reads CSV text. Handles quotes, doubled quotes, a byte-order mark, CRLF, and , ; or tab separators. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r\n|\n|\r/).find((line) => line.trim() !== "") ?? "";
  const count = (char: string) => firstLine.split(char).length - 1;
  const delimiter = [",", ";", "\t"].reduce((best, char) => (count(char) > count(best) ? char : best), ",");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === delimiter) { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += char;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/** Quotes a value for a CSV file. */
export function csvLine(values: readonly string[]): string {
  return values.map((value) => (/[",\r\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)).join(",");
}

/** The template as a CSV file Excel opens with the right characters (UTF-8 with a byte-order mark). */
export function templateCsv(kind: ImportKind): string {
  const lines = [csvLine(columnsFor(kind).map((c) => c.header)), ...examplesFor(kind).map((example) => csvLine([...example]))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Maps the file's columns, drops blank rows and example rows, and returns each remaining row's cells by column key. */
export function readTable(table: RawTable, columns: readonly ImportColumn[], oneOf: readonly string[] = []): TableReading {
  const reading: TableReading = { records: [], fileProblems: [], ignoredColumns: [], examplesIgnored: 0 };
  const headerIndex = table.findIndex((row) => row.some((cell) => cellText(cell) !== ""));
  if (headerIndex < 0) {
    reading.fileProblems.push("The file is empty. Download the template, fill it in and upload it again.");
    return reading;
  }

  const columnAt = new Map<number, ImportColumn>();
  const header = table[headerIndex];
  header.forEach((cell, index) => {
    const label = cellText(cell);
    if (!label) return;
    const wanted = normalizeHeader(label);
    const column = columns.find((c) => normalizeHeader(c.header) === wanted || c.aliases.includes(wanted));
    if (!column) { reading.ignoredColumns.push(label); return; }
    if ([...columnAt.values()].includes(column)) {
      reading.fileProblems.push(`The "${column.header}" column appears more than once.`);
      return;
    }
    columnAt.set(index, column);
  });
  for (const column of columns) {
    if (column.required && ![...columnAt.values()].includes(column)) {
      reading.fileProblems.push(`The file has no "${column.header}" column. Use the template's headings exactly.`);
    }
  }
  if (oneOf.length > 0 && ![...columnAt.values()].some((c) => oneOf.includes(c.key))) {
    const names = columns.filter((c) => oneOf.includes(c.key)).map((c) => `"${c.header}"`).join(" or ");
    reading.fileProblems.push(`The file needs a ${names} column to say which product each row is for.`);
  }
  if (reading.fileProblems.length > 0) return reading;

  for (let r = headerIndex + 1; r < table.length; r += 1) {
    const values: Record<string, string> = {};
    for (const column of columns) values[column.key] = "";
    table[r].forEach((cell, index) => {
      const column = columnAt.get(index);
      if (column) values[column.key] = cellText(cell);
    });
    if (Object.values(values).every((value) => value === "")) continue;
    if (Object.values(values).some((value) => value.toLowerCase().startsWith(EXAMPLE_PREFIX))) { reading.examplesIgnored += 1; continue; }
    reading.records.push({ rowNumber: r + 1, values });
  }
  if (reading.records.length > IMPORT_MAX_ROWS) {
    reading.fileProblems.push(`The file has ${reading.records.length.toLocaleString()} rows. Import at most ${IMPORT_MAX_ROWS.toLocaleString()} at a time.`);
  }
  if (reading.records.length === 0 && reading.fileProblems.length === 0) {
    reading.fileProblems.push("There are no rows to import. Fill in the template below its heading row.");
  }
  return reading;
}

// ---- Numbers -----------------------------------------------------------------------------------

type Parsed = { value: number } | { error: string };

/** A plain number: 8, 8.50, 1,250.50 or 12,5. Currency symbols and spaces are ignored. */
export function parseNumber(text: string): Parsed {
  const cleaned = text.replace(/[^\d.,-]/g, "");
  if (!cleaned || cleaned === "-") return { error: "is not a number" };
  let normalized = cleaned;
  const commas = (cleaned.match(/,/g) ?? []).length;
  const dots = (cleaned.match(/\./g) ?? []).length;
  if (commas > 0 && dots > 0) {
    const decimalComma = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".");
    normalized = decimalComma ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
  } else if (commas > 0) {
    if (/^-?\d{1,3}(,\d{3})+$/.test(cleaned)) normalized = cleaned.replace(/,/g, "");
    else if (/^-?\d+,\d{1,2}$/.test(cleaned)) normalized = cleaned.replace(",", ".");
    else return { error: "is not a number" };
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return { error: "is not a number" };
  const value = Number(normalized);
  return Number.isFinite(value) ? { value } : { error: "is not a number" };
}

function money(label: string, text: string, { allowZero }: { allowZero: boolean }): { value: number } | { error: string } {
  const parsed = parseNumber(text);
  if ("error" in parsed) return { error: `${label} "${text}" ${parsed.error}` };
  const { value } = parsed;
  if (value < 0 || (!allowZero && value === 0)) return { error: `${label} must be ${allowZero ? "zero or more" : "above zero"}` };
  if (value > MAX_MONEY) return { error: `${label} is too large` };
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) return { error: `${label} can have at most 2 decimal places` };
  return { value: Math.round(value * 100) / 100 };
}

function whole(label: string, text: string, min: number): { value: number } | { error: string } {
  const parsed = parseNumber(text);
  if ("error" in parsed) return { error: `${label} "${text}" ${parsed.error}` };
  if (!Number.isInteger(parsed.value)) return { error: `${label} must be a whole number` };
  if (parsed.value < min) return { error: `${label} must be ${min === 0 ? "zero or more" : `${min} or more`}` };
  if (parsed.value > MAX_COUNT) return { error: `${label} is too large` };
  return { value: parsed.value };
}

/** Two codes that a scanner would treat as the same share a key (UPC-A, EAN-13 and GTIN-14 forms of one number). */
function barcodeKey(code: string): string {
  const normalized = normalizeBarcode(code);
  return /^\d{12,14}$/.test(normalized) ? normalized.padStart(14, "0") : normalized;
}

// ---- Products ----------------------------------------------------------------------------------

export interface ExistingCatalog {
  productNames: readonly string[];
  /** Every barcode already used by a product or a pack size in the shop. */
  barcodes: readonly string[];
  categories: readonly string[];
}

export interface ProductImportPack {
  name: string;
  quantity: number;
  sellingPrice: number;
  barcode: string | null;
}

export interface ProductImportRow {
  rowNumber: number;
  name: string;
  category: string | null;
  costPrice: number;
  sellingPrice: number;
  retailPrice: number | null;
  stock: number;
  barcode: string | null;
  packs: ProductImportPack[];
}

export interface ProductImportPlan {
  rows: ProductImportRow[];
  /** Rows whose product is already in the shop. They are left alone. */
  alreadyThere: { rowNumber: number; name: string }[];
  issues: ImportIssue[];
  newCategories: string[];
  packCount: number;
}

const normalizeName = (name: string) => name.replace(/\s+/g, " ").trim().toLowerCase();

export function planProductImport(records: readonly ImportRecord[], existing: ExistingCatalog): ProductImportPlan {
  const plan: ProductImportPlan = { rows: [], alreadyThere: [], issues: [], newCategories: [], packCount: 0 };
  const existingNames = new Set(existing.productNames.map(normalizeName));
  const categoryByKey = new Map(existing.categories.map((name) => [normalizeName(name), name]));
  const newCategoryKeys = new Set<string>();
  const usedBarcodes = new Map<string, string>();
  for (const code of existing.barcodes) usedBarcodes.set(barcodeKey(code), "your shop");
  const rowByName = new Map<string, ProductImportRow>();
  const settledNames = new Set<string>(); // already in the shop, or a row that has its own problem: follow-up pack rows stay quiet
  const addIssue = (rowNumber: number, message: string) => plan.issues.push({ rowNumber, message });

  const claimBarcode = (rowNumber: number, code: string, label: string): boolean => {
    if (code.length > IMPORT_BARCODE_MAX) { addIssue(rowNumber, `${label} is longer than ${IMPORT_BARCODE_MAX} characters`); return false; }
    const key = barcodeKey(code);
    const owner = usedBarcodes.get(key);
    if (owner) {
      addIssue(rowNumber, owner === "your shop"
        ? `${label} ${code} is already used by a product or pack size in your shop`
        : `${label} ${code} is also used on row ${owner}`);
      return false;
    }
    usedBarcodes.set(key, String(rowNumber));
    return true;
  };

  const addPack = (rowNumber: number, v: Record<string, string>, row: ProductImportRow) => {
    const label = v.packName || "Pack size";
    const missing = [
      v.packName === "" ? "Pack name" : null,
      v.packSize === "" ? "Pack size" : null,
      v.packPrice === "" ? "Pack price" : null,
    ].filter((x): x is string => x !== null);
    if (missing.length > 0) { addIssue(rowNumber, `A pack size needs ${missing.join(", ")} filled in (or leave all the pack columns empty)`); return; }
    if (v.packName.length > PACK_NAME_MAX) { addIssue(rowNumber, `Pack name is longer than ${PACK_NAME_MAX} characters`); return; }
    const size = whole("Pack size", v.packSize, 2);
    if ("error" in size) { addIssue(rowNumber, size.error); return; }
    const price = money(`${label} price`, v.packPrice, { allowZero: false });
    if ("error" in price) { addIssue(rowNumber, price.error); return; }
    const problems = validatePackSize({ name: v.packName, quantity: size.value, sellingPrice: price.value }, row.packs);
    if (problems.length > 0) { for (const problem of problems) addIssue(rowNumber, problem); return; }
    const barcode = v.packBarcode ? normalizeBarcode(v.packBarcode) : null;
    if (barcode && !claimBarcode(rowNumber, barcode, "Pack barcode")) return;
    row.packs.push({ name: v.packName, quantity: size.value, sellingPrice: price.value, barcode });
  };

  for (const { rowNumber, values: v } of records) {
    const startIssues = plan.issues.length;
    const name = v.name.replace(/\s+/g, " ").trim();
    if (!name) { addIssue(rowNumber, "Name is empty"); continue; }
    if (name.length > IMPORT_NAME_MAX) { addIssue(rowNumber, `Name is longer than ${IMPORT_NAME_MAX} characters`); continue; }
    const key = normalizeName(name);
    const hasPack = [v.packName, v.packSize, v.packPrice, v.packBarcode].some((x) => x !== "");

    const earlier = rowByName.get(key);
    if (earlier) {
      const packOnly = hasPack && [v.costPrice, v.sellingPrice, v.retailPrice, v.stock, v.barcode, v.category].every((x) => x === "");
      if (!packOnly) {
        addIssue(rowNumber, `"${name}" is listed twice (rows ${earlier.rowNumber} and ${rowNumber}). To add another pack size, repeat the name on a new row with only the pack columns filled in.`);
        continue;
      }
      addPack(rowNumber, v, earlier);
      continue;
    }
    if (settledNames.has(key)) continue;
    if (existingNames.has(key)) {
      plan.alreadyThere.push({ rowNumber, name });
      settledNames.add(key);
      continue;
    }

    const cost = v.costPrice === "" ? { error: "Cost price is empty" } : money("Cost price", v.costPrice, { allowZero: true });
    if ("error" in cost) addIssue(rowNumber, cost.error);
    const price = v.sellingPrice === ""
      ? { error: hasPack ? "Selling price is empty. A row that only adds a pack size must come after its product's own row." : "Selling price is empty" }
      : money("Selling price", v.sellingPrice, { allowZero: false });
    if ("error" in price) addIssue(rowNumber, price.error);
    const retail = v.retailPrice === "" ? { value: null as number | null } : money("Retail price", v.retailPrice, { allowZero: false });
    if ("error" in retail) addIssue(rowNumber, retail.error);
    const stock = v.stock === "" ? { value: 0 } : whole("Stock", v.stock, 0);
    if ("error" in stock) addIssue(rowNumber, stock.error);

    let category: string | null = null;
    if (v.category) {
      const categoryName = v.category.replace(/\s+/g, " ").trim();
      if (categoryName.length > IMPORT_CATEGORY_MAX) addIssue(rowNumber, `Category is longer than ${IMPORT_CATEGORY_MAX} characters`);
      else {
        const known = categoryByKey.get(normalizeName(categoryName));
        category = known ?? categoryName;
      }
    }
    const barcode = v.barcode ? normalizeBarcode(v.barcode) : null;
    if (barcode) claimBarcode(rowNumber, barcode, "Barcode");

    const row: ProductImportRow = {
      rowNumber,
      name,
      category,
      costPrice: "value" in cost ? cost.value : 0,
      sellingPrice: "value" in price ? price.value : 0,
      retailPrice: "value" in retail ? retail.value : null,
      stock: "value" in stock ? stock.value : 0,
      barcode,
      packs: [],
    };
    if (hasPack) addPack(rowNumber, v, row);

    if (plan.issues.length > startIssues) { settledNames.add(key); continue; }
    if (category && !categoryByKey.has(normalizeName(category)) && !newCategoryKeys.has(normalizeName(category))) {
      newCategoryKeys.add(normalizeName(category));
      plan.newCategories.push(category);
    }
    rowByName.set(key, row);
    plan.rows.push(row);
  }

  // Pack rows can be added to a product after it was accepted, so count from the final rows.
  plan.packCount = plan.rows.reduce((sum, row) => sum + row.packs.length, 0);
  return plan;
}

// ---- Stock -------------------------------------------------------------------------------------

export type StockImportType = "in" | "out" | "adjustment";

export interface StockImportProduct {
  id: string;
  name: string;
  barcode: string | null;
  stock: number;
}

export interface StockImportRow {
  rowNumber: number;
  productId: string;
  productName: string;
  type: StockImportType;
  quantity: number;
  supplierId: string | null;
  supplierName: string | null;
  notes: string | null;
  stockBefore: number;
  stockAfter: number;
}

export interface StockImportPlan {
  rows: StockImportRow[];
  issues: ImportIssue[];
}

const TYPE_WORDS: Record<string, StockImportType> = {
  in: "in", stockin: "in", restock: "in", received: "in", receive: "in", add: "in",
  out: "out", stockout: "out", remove: "out", removed: "out",
  recount: "adjustment", adjustment: "adjustment", adjust: "adjustment", count: "adjustment", stocktake: "adjustment", set: "adjustment",
};

export function planStockImport(
  records: readonly ImportRecord[],
  products: readonly StockImportProduct[],
  suppliers: readonly { id: string; name: string }[],
): StockImportPlan {
  const plan: StockImportPlan = { rows: [], issues: [] };
  const byName = new Map<string, StockImportProduct[]>();
  for (const product of products) {
    const key = normalizeName(product.name);
    byName.set(key, [...(byName.get(key) ?? []), product]);
  }
  const supplierByName = new Map(suppliers.map((s) => [normalizeName(s.name), s]));
  const running = new Map(products.map((p) => [p.id, p.stock]));
  const addIssue = (rowNumber: number, message: string) => plan.issues.push({ rowNumber, message });

  for (const { rowNumber, values: v } of records) {
    let product: StockImportProduct | undefined;
    if (v.barcode) {
      const code = normalizeBarcode(v.barcode);
      product = findByBarcode(products, code);
      if (!product) { addIssue(rowNumber, `No product has the barcode ${code}`); continue; }
      if (v.product && !byName.get(normalizeName(v.product))?.includes(product)) {
        addIssue(rowNumber, `Barcode ${code} belongs to ${product.name}, not ${v.product}`);
        continue;
      }
    } else if (v.product) {
      const matches = byName.get(normalizeName(v.product)) ?? [];
      if (matches.length === 0) { addIssue(rowNumber, `No product is called "${v.product}"`); continue; }
      if (matches.length > 1) { addIssue(rowNumber, `${matches.length} products are called "${v.product}". Use the barcode column to say which one.`); continue; }
      product = matches[0];
    } else {
      addIssue(rowNumber, "Give the product's name or barcode");
      continue;
    }

    let type: StockImportType = "in";
    if (v.type) {
      const mapped = TYPE_WORDS[normalizeHeader(v.type)];
      if (!mapped) { addIssue(rowNumber, `Type "${v.type}" should be In, Out or Recount`); continue; }
      type = mapped;
    }
    const quantity = v.quantity === "" ? { error: "Quantity is empty" } : whole("Quantity", v.quantity, type === "adjustment" ? 0 : 1);
    if ("error" in quantity) { addIssue(rowNumber, quantity.error); continue; }

    let supplier: { id: string; name: string } | null = null;
    if (v.supplier && type === "in") {
      supplier = supplierByName.get(normalizeName(v.supplier)) ?? null;
      if (!supplier) { addIssue(rowNumber, `No supplier is called "${v.supplier}". Add it under Inventory, Suppliers first.`); continue; }
    }
    if (v.notes.length > IMPORT_NOTES_MAX) { addIssue(rowNumber, `Notes are longer than ${IMPORT_NOTES_MAX} characters`); continue; }

    const before = running.get(product.id) ?? 0;
    let after: number;
    if (type === "in") after = before + quantity.value;
    else if (type === "out") {
      if (quantity.value > before) { addIssue(rowNumber, `${product.name} has only ${before} in stock at this point, so ${quantity.value} cannot be taken out`); continue; }
      after = before - quantity.value;
    } else after = quantity.value;
    if (after > MAX_COUNT) { addIssue(rowNumber, `${product.name} would have too many in stock`); continue; }
    running.set(product.id, after);

    plan.rows.push({
      rowNumber,
      productId: product.id,
      productName: product.name,
      type,
      quantity: quantity.value,
      supplierId: supplier?.id ?? null,
      supplierName: supplier?.name ?? null,
      notes: v.notes || null,
      stockBefore: before,
      stockAfter: after,
    });
  }
  return plan;
}
