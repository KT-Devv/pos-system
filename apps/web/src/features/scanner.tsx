"use client";

import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  normalizeBarcode,
} from "@pos/shared";
import { CameraOff, Check, X } from "lucide-react";

/** What the caller made of a scanned code; shown under the camera so the cashier can see it worked. */
export type ScanResult = { ok: boolean; message: string };

/**
 * A camera keeps reporting the same code every frame while it is in view. A code only counts again
 * after it has been out of view for this long, so holding an item still never adds it twice.
 */
const REPEAT_QUIET_MS = 2500;

function describeCameraError(cause: unknown): string {
  const text = cause instanceof Error ? `${cause.name} ${cause.message}` : String(cause);
  if (/NotAllowed|Permission|denied/i.test(text)) {
    return "Camera access was blocked. Allow the camera for this app in your browser or system settings, or type the code below.";
  }
  if (/NotFound|no camera|Requested device not found/i.test(text)) return "No camera was found on this device. Type the code below instead.";
  if (/NotReadable|in use|Could not start video source/i.test(text)) return "The camera is in use by another app. Close it and try again, or type the code below.";
  if (/secure|https/i.test(text)) return "Camera scanning needs a secure (https) connection. Type the code below instead.";
  return "The camera could not be started. Type the code below instead.";
}

function ScannerView({ onScan }: { onScan: (code: string) => ScanResult | void }) {
  const regionId = `scanner-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [status, setStatus] = useState<"starting" | "live" | "unavailable">("starting");
  const [problem, setProblem] = useState("");
  const [last, setLast] = useState<(ScanResult & { code: string }) | null>(null);
  const [manual, setManual] = useState("");
  const handler = useRef(onScan);
  const seen = useRef<{ code: string; at: number } | null>(null);

  useEffect(() => { handler.current = onScan; });

  const submit = useCallback((raw: string) => {
    const code = normalizeBarcode(raw);
    if (!code) return;
    const result = handler.current(code);
    if (result) setLast({ ...result, code });
  }, []);

  const onDecoded = useCallback((raw: string) => {
    const code = normalizeBarcode(raw);
    if (!code) return;
    const now = Date.now();
    const previous = seen.current;
    seen.current = { code, at: now };
    if (previous && previous.code === code && now - previous.at < REPEAT_QUIET_MS) return;
    submit(code);
  }, [submit]);

  useEffect(() => {
    let cancelled = false;
    let scanner: import("html5-qrcode").Html5Qrcode | undefined;
    let started: Promise<unknown> = Promise.resolve();

    (async () => {
      try {
        // Loaded on demand: the library is large and most sessions never open the camera.
        const { Html5Qrcode, Html5QrcodeSupportedFormats: Format } = await import("html5-qrcode");
        if (cancelled) return;
        scanner = new Html5Qrcode(regionId, {
          verbose: false,
          useBarCodeDetectorIfSupported: true,
          formatsToSupport: [Format.EAN_13, Format.EAN_8, Format.UPC_A, Format.UPC_E, Format.CODE_128, Format.CODE_39, Format.QR_CODE],
        });
        started = scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (width, height) => ({ width: Math.floor(Math.min(width * 0.9, 340)), height: Math.floor(Math.min(height * 0.55, 170)) }),
          },
          onDecoded,
          undefined,
        );
        await started;
        if (!cancelled) setStatus("live");
      } catch (cause) {
        if (cancelled) return;
        setStatus("unavailable");
        setProblem(describeCameraError(cause));
      }
    })();

    return () => {
      cancelled = true;
      const instance = scanner;
      // stop() throws if the camera never started, so it only runs once start() has settled.
      if (instance) void started.then(() => instance.stop()).then(() => instance.clear()).catch(() => {});
    };
  }, [regionId, onDecoded]);

  const onManualSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(manual);
    setManual("");
  };

  return (
    <div className="grid gap-3">
      <div
        id={regionId}
        className={cn("min-h-[200px] overflow-hidden rounded-xl bg-black [&_video]:w-full", status === "unavailable" && "hidden")}
      />
      {status === "unavailable" && (
        <Alert variant="warning">
          <CameraOff className="h-4 w-4" />
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}
      {status !== "unavailable" && (
        <p className="text-center text-xs text-muted-foreground">
          {status === "starting" ? "Starting the camera…" : "Hold the barcode inside the frame."}
        </p>
      )}

      <div aria-live="polite" className="min-h-6 text-center text-sm font-semibold">
        {last && (
          <span className={cn("inline-flex items-center gap-1.5", last.ok ? "text-success" : "text-destructive")}>
            {last.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            {last.message}
          </span>
        )}
      </div>

      <form onSubmit={onManualSubmit} className="flex gap-2">
        <Input
          aria-label="Type a barcode"
          placeholder="Or type the barcode…"
          className="font-mono"
          value={manual}
          onChange={(event) => setManual(event.target.value)}
        />
        <Button type="submit" variant="outline" disabled={!manual.trim()}>Use code</Button>
      </form>
    </div>
  );
}

/**
 * Scans barcodes with the device camera, or takes one typed in. `onScan` returns how it went, which is
 * shown under the camera; the dialog stays open so several items can be scanned in a row. Close it from
 * `onScan`'s owner (via `onClose`) when one code is all that is needed.
 */
export function BarcodeScannerDialog({
  open,
  onClose,
  onScan,
  title = "Scan a barcode",
  description = "Use the camera, or type the code.",
  doneLabel = "Done",
}: {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => ScanResult | void;
  title?: string;
  description?: string;
  doneLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ScannerView onScan={onScan} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{doneLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
