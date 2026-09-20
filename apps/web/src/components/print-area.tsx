"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders `children` as a direct child of <body>, invisible on screen. While one is mounted,
 * printing hides the rest of the app (see `.print-root` in globals.css), so receipts and labels
 * print on their own without the sidebar, dialog or page behind them.
 *
 * `pageSize` sets the paper size for jobs that need it (label rolls), e.g. "50mm 30mm".
 */
export function PrintArea({ children, pageSize }: { children: ReactNode; pageSize?: string }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.body); }, []);
  if (!host) return null;
  return createPortal(
    <div className="print-root">
      {pageSize && <style>{`@page { size: ${pageSize}; margin: 0; }`}</style>}
      {children}
    </div>,
    host,
  );
}

/** Opens the system print dialog: the browser's on the web, the WebView's in the desktop app. */
export function printPage() {
  window.print();
}
