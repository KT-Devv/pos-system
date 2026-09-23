"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders `children` as a direct child of <body>, invisible on screen. While one is mounted,
 * printing hides the rest of the app (see `.print-root` in globals.css), so receipts and labels
 * print on their own without the sidebar, dialog or page behind them.
 *
 * `page` picks a named paper size defined in globals.css (label rolls). The size is deliberately
 * not written into an inline <style>: the desktop app's content-security policy blocks those.
 */
export type PrintPage = "label-small" | "label-standard" | "label-large";

export function PrintArea({ children, page }: { children: ReactNode; page?: PrintPage }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.body); }, []);
  if (!host) return null;
  return createPortal(
    <div className={page ? `print-root print-page-${page}` : "print-root"}>{children}</div>,
    host,
  );
}

/** Opens the system print dialog: the browser's on the web, the WebView's in the desktop app. */
export function printPage() {
  window.print();
}
