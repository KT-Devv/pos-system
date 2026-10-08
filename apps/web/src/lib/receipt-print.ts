import { printPage } from "@/components/print-area";

/**
 * Receipts print on a roll, so the page has to be exactly as long as the receipt: on a fixed Letter or A4 page the
 * printer feeds a whole sheet of blank paper, and its cutter only fires at the end of the page.
 *
 * A browser takes the page size from an `@page` rule. The receipt's height is only known once it is laid out, so the rule
 * is written when Print is pressed, into a constructable stylesheet: that is allowed under the desktop app's
 * content-security policy, which refuses an inline <style>. Chrome, Edge, Firefox and the desktop app obey the rule.
 * Safari ignores `@page size`; there the paper size is chosen in the print window.
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

/** The width the receipt is drawn at: the roll's width less the margin a thermal printer cannot reach. */
export const receiptWidthMm = (paper: ReceiptPaperMm) => paper - 8;

const MM_PER_PX = 25.4 / 96;
/** Spare length so rounding can never push the last line onto a second page. */
const SPARE_MM = 3;

let pageSheet: CSSStyleSheet | null = null;

function setPageSize(paper: ReceiptPaperMm, heightMm: number): void {
  if (typeof CSSStyleSheet === "undefined" || !("adoptedStyleSheets" in document)) return;
  try {
    const sheet = (pageSheet ??= new CSSStyleSheet());
    sheet.replaceSync(`@page { size: ${paper}mm ${Math.max(40, Math.ceil(heightMm))}mm; margin: 0; }`);
    if (!document.adoptedStyleSheets.includes(sheet)) document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    // Labels print on their own named pages, so the rule is dropped as soon as printing ends.
    window.addEventListener("afterprint", () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
    }, { once: true });
  } catch {
    // The print window decides the page size.
  }
}

/**
 * Prints the receipt on a page of `paper` width and the receipt's own length. `shown` is the receipt as laid out on
 * screen. Its layout height is used, not its bounding box: the dialog scales while it opens, which shrinks the box.
 */
export function printReceipt(paper: ReceiptPaperMm, shown: HTMLElement | null | undefined): void {
  if (shown) setPageSize(paper, shown.offsetHeight * MM_PER_PX + SPARE_MM);
  printPage();
}
