/**
 * Receipts print on a roll, so the page should be exactly as long as the receipt: a fixed Letter or A4 page makes the
 * printer feed a whole sheet of blank paper, and the cutter only fires at the end of that page.
 *
 * Browsers that obey CSS (Chrome, Edge and the desktop app) take the page size from an `@page` rule. The receipt's height
 * is only known once it is laid out, so the rule is written at print time, into a constructable stylesheet: that is
 * allowed under the desktop app's content-security policy, which refuses an inline <style>. Safari ignores `@page size`
 * altogether, so there the paper size has to be chosen in the print window (the receipt dialog says so).
 */

export const RECEIPT_PAPER_MM = [58, 80] as const;
export type ReceiptPaperMm = (typeof RECEIPT_PAPER_MM)[number];

const STORAGE_KEY = "kt-receipt-paper";

/** The roll width this device prints on. A printer belongs to a device, so this is remembered per device. */
export function readReceiptPaper(): ReceiptPaperMm {
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    if (RECEIPT_PAPER_MM.includes(stored as ReceiptPaperMm)) return stored as ReceiptPaperMm;
  } catch {
    // Storage can be unavailable (private windows, blocked site data): the default is fine.
  }
  return 80;
}

export function saveReceiptPaper(paper: ReceiptPaperMm): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(paper));
  } catch {
    // Not remembered; it still applies to this print.
  }
}

/** The width the receipt itself is drawn at: the roll's width less a margin the printer cannot reach. */
export const receiptWidthMm = (paper: ReceiptPaperMm) => paper - 8;

let pageSheet: CSSStyleSheet | null = null;

/** Sets the receipt page to `paper` wide and `heightMm` tall. Returns false where the browser cannot (the print window decides then). */
export function setReceiptPageSize(paper: ReceiptPaperMm, heightMm: number): boolean {
  if (typeof CSSStyleSheet === "undefined" || !("adoptedStyleSheets" in document)) return false;
  try {
    pageSheet ??= new CSSStyleSheet();
    pageSheet.replaceSync(`@page receipt { size: ${paper}mm ${Math.max(40, Math.ceil(heightMm))}mm; margin: 0; }`);
    if (!document.adoptedStyleSheets.includes(pageSheet)) document.adoptedStyleSheets = [...document.adoptedStyleSheets, pageSheet];
    return true;
  } catch {
    return false;
  }
}

/** Safari (not Chrome, Edge or another browser that merely says "Safari" too) cannot be told a paper size. */
export function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Safari\//.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/.test(navigator.userAgent);
}
