/**
 * Barcode helpers: matching what a scanner reads against the catalog, generating in-store codes,
 * and encoding Code 128 for printed labels. Pure functions, so they can be tested without a DOM.
 */

/**
 * Bar/space widths (in modules) for Code 128 symbol values 0-102. Values 0-94 are the printable ASCII
 * characters 32-126 in code set B; 95-102 never carry data here but can be the checksum symbol.
 */
const CODE128_B_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131",
];
const START_B = "211214";
const STOP = "2331112";
const START_B_VALUE = 104;

/** Longest text a label will encode; longer codes make bars too thin to scan on a small label. */
export const CODE128_MAX_LENGTH = 40;

/** Code 128 set B carries printable ASCII only. */
export function canEncodeCode128(text: string): boolean {
  if (text.length === 0 || text.length > CODE128_MAX_LENGTH) return false;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 32 || code > 126) return false;
  }
  return true;
}

function runsToModules(widths: string): string {
  let bar = true;
  let out = "";
  for (const width of widths) {
    out += (bar ? "1" : "0").repeat(Number(width));
    bar = !bar;
  }
  return out;
}

/** The symbol sequence as a string of modules: "1" is a bar, "0" a space. Excludes the quiet zone. */
export function code128Modules(text: string): string {
  if (!canEncodeCode128(text)) {
    throw new Error(`Cannot encode "${text}" as Code 128: use 1-${CODE128_MAX_LENGTH} printable ASCII characters`);
  }
  const values = Array.from(text, (char) => char.charCodeAt(0) - 32);
  const checksum = values.reduce((sum, value, index) => sum + value * (index + 1), START_B_VALUE) % 103;
  return [START_B, ...values.map((value) => CODE128_B_PATTERNS[value]), CODE128_B_PATTERNS[checksum], STOP]
    .map(runsToModules)
    .join("");
}

export interface BarcodeBar {
  /** Offset from the start of the symbol, in modules. */
  x: number;
  /** Width in modules. */
  width: number;
}

/** Runs of adjacent bar modules merged into rectangles. `modules` is the symbol width, quiet zone excluded. */
export function code128Bars(text: string): { bars: BarcodeBar[]; modules: number } {
  const pattern = code128Modules(text);
  const bars: BarcodeBar[] = [];
  let start = -1;
  for (let i = 0; i <= pattern.length; i += 1) {
    const on = i < pattern.length && pattern[i] === "1";
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      bars.push({ x: start, width: i - start });
      start = -1;
    }
  }
  return { bars, modules: pattern.length };
}

/** Quiet zone the specification asks for on each side of the symbol, in modules. */
export const CODE128_QUIET_ZONE = 10;

/** Removes what scanners append (Enter, Tab) and stray whitespace. */
export function normalizeBarcode(raw: string): string {
  let out = "";
  for (const char of raw) {
    const code = char.charCodeAt(0);
    if (code >= 32 && code !== 127) out += char;
  }
  return out.trim();
}

/**
 * Whether a scanned code refers to a stored one. Exact match, or the same number written as UPC-A
 * (12 digits), EAN-13 (a leading zero more) or GTIN-14 (two more): phones, hand scanners and QR
 * codes report whichever form they carry.
 */
export function barcodesMatch(scanned: string, stored: string): boolean {
  const a = normalizeBarcode(scanned);
  const b = normalizeBarcode(stored);
  if (!a || !b) return false;
  if (a === b) return true;
  const gtin = /^\d{12,14}$/;
  return gtin.test(a) && gtin.test(b) && a.padStart(14, "0") === b.padStart(14, "0");
}

/** The GTIN carried by a GS1 Digital Link ("https://id.gs1.org/01/05901234123457") or element string. */
function gtinIn(text: string): string | null {
  return text.match(/\/01\/(\d{14})(?:[/?#]|$)/)?.[1]
    ?? text.match(/\(01\)\s*(\d{14})/)?.[1]
    ?? text.match(/^01(\d{14})/)?.[1]
    ?? null;
}

/** The GTIN in its usual 13-digit form when it has a leading zero, so it matches what shops store. */
function shortenGtin(gtin: string): string {
  return gtin.startsWith("0") ? gtin.slice(1) : gtin;
}

const CODE_PARAMS = ["barcode", "code", "ean", "gtin", "upc", "sku", "id"];

/**
 * What a scan could mean, best guess first. A barcode is just its digits, but a QR code often holds
 * a link or a GS1 string around the number, so those are unwrapped: the GTIN, then a code-like
 * query value, then the last path segment.
 */
export function barcodeCandidates(scanned: string): string[] {
  const text = normalizeBarcode(scanned);
  if (!text) return [];
  const found = [text];
  const add = (value: string | null | undefined) => {
    const cleaned = value ? normalizeBarcode(value) : "";
    if (cleaned && !found.includes(cleaned)) found.push(cleaned);
  };

  const gtin = gtinIn(text);
  if (gtin) {
    add(shortenGtin(gtin));
    add(gtin);
  }
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      for (const key of CODE_PARAMS) add(url.searchParams.get(key));
      const segments = url.pathname.split("/").filter(Boolean);
      add(segments.length ? decodeURIComponent(segments[segments.length - 1]) : null);
    } catch {
      // Not a parseable link: the raw text is still a candidate.
    }
  }
  return found;
}

/** The value to store for a scanned code: the barcode inside a QR link if there is one, else the text. */
export function barcodeFromScan(scanned: string): string {
  const text = normalizeBarcode(scanned);
  const gtin = gtinIn(text);
  return gtin ? shortenGtin(gtin) : text;
}

/**
 * The product a scanned code belongs to. Tries each reading of the scan in turn, preferring an exact
 * match over the UPC/EAN/GTIN equivalence.
 */
export function findByBarcode<T extends { barcode: string | null }>(items: readonly T[], scanned: string): T | undefined {
  for (const code of barcodeCandidates(scanned)) {
    const found = items.find((item) => item.barcode !== null && normalizeBarcode(item.barcode) === code)
      ?? items.find((item) => item.barcode !== null && barcodesMatch(code, item.barcode));
    if (found) return found;
  }
  return undefined;
}

/** The EAN-13 check digit for the first twelve digits. */
export function ean13CheckDigit(first12: string): number {
  if (!/^\d{12}$/.test(first12)) throw new Error("EAN-13 needs exactly 12 digits before the check digit");
  const sum = Array.from(first12).reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

/**
 * A new EAN-13 for products that have no printed barcode. The leading 2 is the range GS1 reserves
 * for in-store use, so it can never collide with a manufacturer's code. Retries until it finds one
 * not in `taken`; the database's unique index is the final guard against a race.
 */
export function generateInternalBarcode(taken: Iterable<string | null>, random: () => number = Math.random): string {
  const used = new Set<string>();
  for (const code of taken) if (code) used.add(code);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let body = "2";
    for (let i = 0; i < 11; i += 1) body += Math.min(9, Math.floor(random() * 10));
    const code = body + ean13CheckDigit(body);
    if (!used.has(code)) return code;
  }
  throw new Error("Could not generate an unused barcode; try again");
}
