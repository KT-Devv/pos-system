"use client";

import { type FormEvent, type MouseEvent, useCallback, useEffect, useId, useRef, useState } from "react";
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
import { CameraOff, Check, Flashlight, FlashlightOff, SwitchCamera, X, ZoomIn } from "lucide-react";
import type { Html5Qrcode } from "html5-qrcode";
import type { QrWorkerReply } from "./qr-worker";

/** What the caller made of a scanned code; shown under the camera so the cashier can see it worked. */
export type ScanResult = { ok: boolean; message: string };

/**
 * A camera keeps reporting the same code every frame while it is in view. A code only counts again
 * after it has been out of view for this long, so holding an item still never adds it twice.
 */
const REPEAT_QUIET_MS = 2500;

const CAMERA_KEY = "kt-pos-camera";

type Camera = { id: string; label: string };
type Features = {
  zoom: { min: number; max: number; step: number; value: number } | null;
  torch: boolean;
  /** Focus modes the camera offers ("continuous", "single-shot", "manual"). Empty when it has no autofocus control. */
  focus: string[];
};
const NO_FEATURES: Features = { zoom: null, torch: false, focus: [] };

// focusMode and pointsOfInterest are not in TypeScript's DOM typings yet; Chrome on Android honours them.
type FocusConstraint = MediaTrackConstraintSet & { focusMode?: string; pointsOfInterest?: { x: number; y: number }[] };
const focusConstraints = (set: FocusConstraint): MediaTrackConstraints => ({ advanced: [set] });

function savedCamera(): string | undefined {
  try {
    return window.localStorage.getItem(CAMERA_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function saveCamera(id: string | undefined) {
  try {
    if (id) window.localStorage.setItem(CAMERA_KEY, id);
  } catch {
    // Remembering the camera is a convenience only.
  }
}

/**
 * 720p is plenty for a barcode and keeps decoding fast; below that, small codes blur. Autofocus is
 * asked for up front. `ideal` (never `exact`) so a laptop with no rear camera, or a camera that has
 * since been unplugged, still starts.
 */
function scanConstraints(cameraId?: string): MediaTrackConstraints {
  return {
    ...(cameraId ? { deviceId: { ideal: cameraId } } : { facingMode: { ideal: "environment" } }),
    width: { ideal: 1280 },
    height: { ideal: 720 },
    ...focusConstraints({ focusMode: "continuous" }),
  };
}

/**
 * html5-qrcode's own QR decoder misses roughly one valid code in twenty however well it is held
 * (measured on clean codes), so QR codes are also read by jsQR. The two share the same picture and
 * whichever reads first wins; retail barcodes still go through html5-qrcode alone.
 */
const QR_FALLBACK_MAX_WIDTH = 960;

/** A browser with its own barcode reader (Chrome on Android) already reads QR codes reliably. */
async function hasNativeQrReader(): Promise<boolean> {
  const detector = (window as unknown as { BarcodeDetector?: { getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
  if (!detector) return false;
  try {
    return (await detector.getSupportedFormats()).includes("qr_code");
  } catch {
    return false;
  }
}

/**
 * Reads QR codes from the live picture in a Web Worker and reports each one. Returns a function that
 * stops it. The next picture is only sent once the last has been searched, and after a pause as long
 * as the search took, so a slow phone spends at most half its time on this.
 */
function startQrFallback(regionId: string, onCode: (text: string) => void): () => void {
  let worker: Worker;
  try {
    worker = new Worker(new URL("./qr-worker.ts", import.meta.url));
  } catch {
    return () => {}; // No worker support: html5-qrcode alone still reads what it can.
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let sentAt = 0;

  const send = () => {
    if (stopped) return;
    const video = document.getElementById(regionId)?.querySelector("video");
    if (!context || !video || document.hidden || video.paused || video.readyState < 2 || video.videoWidth === 0) {
      timer = setTimeout(send, 150);
      return;
    }
    const scale = Math.min(1, QR_FALLBACK_MAX_WIDTH / video.videoWidth);
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    try {
      context.drawImage(video, 0, 0, width, height);
      const picture = context.getImageData(0, 0, width, height);
      sentAt = performance.now();
      worker.postMessage({ data: picture.data, width, height }, [picture.data.buffer]);
    } catch {
      timer = setTimeout(send, 150); // A picture that cannot be read is skipped; try the next one.
    }
  };

  worker.onmessage = (event: MessageEvent<QrWorkerReply>) => {
    if (stopped) return;
    if (event.data.text) onCode(event.data.text);
    timer = setTimeout(send, Math.max(100, performance.now() - sentAt));
  };
  worker.onerror = () => { stopped = true; worker.terminate(); };

  timer = setTimeout(send, 150);
  return () => {
    stopped = true;
    clearTimeout(timer);
    worker.terminate();
  };
}

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
  const [features, setFeatures] = useState<Features>(NO_FEATURES);
  const [zoom, setZoom] = useState(1);
  const [torchOn, setTorchOn] = useState(false);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [cameraId, setCameraId] = useState<string | undefined>(savedCamera);
  // A tall portrait picture would push the controls off a phone screen, so keep the preview narrower.
  const [previewWidth] = useState(() => (window.innerHeight > window.innerWidth * 1.1 ? Math.round(window.innerHeight * 0.3) : undefined));

  const handler = useRef(onScan);
  const seen = useRef<{ code: string; at: number } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const activeCamera = useRef<string | undefined>(undefined);
  const camerasRead = useRef(false);
  const refocusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The previous camera must be fully released before the next one starts, or the two fight over the preview.
  const teardown = useRef<Promise<void>>(Promise.resolve());

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
    let scanner: Html5Qrcode | undefined;
    let started: Promise<unknown> = Promise.resolve();
    let stopQrFallback = () => {};

    (async () => {
      await teardown.current;
      if (cancelled) return;
      try {
        // Loaded on demand: the library is large and most sessions never open the camera.
        const { Html5Qrcode: Scanner, Html5QrcodeSupportedFormats: Format } = await import("html5-qrcode");
        if (cancelled) return;
        setStatus("starting");
        scanner = new Scanner(regionId, {
          verbose: false,
          useBarCodeDetectorIfSupported: true,
          // One-dimensional retail barcodes and QR codes (many products carry a QR code instead).
          formatsToSupport: [Format.EAN_13, Format.EAN_8, Format.UPC_A, Format.UPC_E, Format.CODE_128, Format.CODE_39, Format.QR_CODE],
        });
        scannerRef.current = scanner;
        // No scan window: the whole picture is read, so a square QR code is never cut off and the
        // code does not have to be lined up with a box. The constraints replace the camera argument.
        started = scanner.start(
          { facingMode: "environment" },
          { fps: 10, disableFlip: true, videoConstraints: scanConstraints(cameraId) },
          onDecoded,
          undefined,
        );
        await started;
        if (cancelled) return;

        // What this particular camera can do differs a lot between phones, laptops and webcams.
        const capabilities = scanner.getRunningTrackCapabilities() as MediaTrackCapabilities & { focusMode?: string[] };
        const focus = Array.isArray(capabilities.focusMode) ? capabilities.focusMode : [];
        const camera = scanner.getRunningTrackCameraCapabilities();
        const zoomFeature = camera.zoomFeature();
        setFeatures({
          zoom: zoomFeature.isSupported()
            ? { min: zoomFeature.min(), max: zoomFeature.max(), step: zoomFeature.step() || 0.1, value: zoomFeature.value() ?? zoomFeature.min() }
            : null,
          torch: camera.torchFeature().isSupported(),
          focus,
        });
        setZoom(zoomFeature.isSupported() ? zoomFeature.value() ?? zoomFeature.min() : 1);
        setTorchOn(false);
        activeCamera.current = scanner.getRunningTrackSettings().deviceId;
        setStatus("live");

        if (!(await hasNativeQrReader()) && !cancelled) stopQrFallback = startQrFallback(regionId, onDecoded);

        if (focus.includes("continuous")) {
          await scanner.applyVideoConstraints(focusConstraints({ focusMode: "continuous" })).catch(() => {});
        }
        // Labels only appear once permission is granted, so the list is read after the camera is running.
        // Once is enough: reading it opens a second stream, which is best not repeated on every restart.
        if (!camerasRead.current) {
          camerasRead.current = true;
          Scanner.getCameras().then(setCameras).catch(() => { camerasRead.current = false; });
        }
      } catch (cause) {
        if (cancelled) return;
        setStatus("unavailable");
        setProblem(describeCameraError(cause));
      }
    })();

    return () => {
      cancelled = true;
      stopQrFallback();
      clearTimeout(refocusTimer.current);
      const instance = scanner;
      scannerRef.current = null;
      // stop() throws if the camera never started, so it only runs once start() has settled.
      teardown.current = instance
        ? started.then(() => instance.stop()).then(() => instance.clear()).catch(() => {})
        : Promise.resolve();
    };
  }, [regionId, onDecoded, cameraId]);

  const onManualSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(manual);
    setManual("");
  };

  const changeZoom = async (value: number) => {
    setZoom(value);
    try {
      await scannerRef.current?.getRunningTrackCameraCapabilities().zoomFeature().apply(value);
    } catch {
      // The slider stays where the user put it; the camera just did not take the value.
    }
  };

  const toggleTorch = async () => {
    const next = !torchOn;
    try {
      await scannerRef.current?.getRunningTrackCameraCapabilities().torchFeature().apply(next);
      setTorchOn(next);
    } catch {
      // Not every camera that reports a torch lets the page switch it.
    }
  };

  const switchCamera = () => {
    if (cameras.length < 2) return;
    const index = cameras.findIndex((camera) => camera.id === activeCamera.current);
    const next = cameras[(index + 1) % cameras.length];
    saveCamera(next.id);
    setCameraId(next.id);
  };

  /** Tap the picture to make the camera focus again there, then hand focus back to continuous. */
  const refocus = async (event: MouseEvent<HTMLDivElement>) => {
    const scanner = scannerRef.current;
    if (!scanner || status !== "live" || features.focus.length === 0) return;
    const box = event.currentTarget.getBoundingClientRect();
    const point = { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height };
    try {
      if (features.focus.includes("single-shot")) {
        await scanner.applyVideoConstraints(focusConstraints({ focusMode: "single-shot", pointsOfInterest: [point] }));
        if (features.focus.includes("continuous")) {
          clearTimeout(refocusTimer.current);
          refocusTimer.current = setTimeout(() => {
            void scannerRef.current?.applyVideoConstraints(focusConstraints({ focusMode: "continuous" })).catch(() => {});
          }, 1500);
        }
      } else if (features.focus.includes("continuous")) {
        await scanner.applyVideoConstraints(focusConstraints({ focusMode: "continuous", pointsOfInterest: [point] }));
      }
    } catch {
      // A camera that refuses the request keeps its current focus.
    }
  };

  const canRefocus = features.focus.length > 0;

  return (
    <div className="grid gap-3">
      <div
        id={regionId}
        onClick={(event) => void refocus(event)}
        style={{ maxWidth: previewWidth }}
        className={cn(
          "mx-auto w-full overflow-hidden rounded-xl bg-black [&_video]:w-full",
          // Keep the box from collapsing while the camera starts; once live the picture sets the height.
          status === "starting" && "min-h-[200px]",
          canRefocus && "cursor-crosshair",
          status === "unavailable" && "hidden",
        )}
      />
      {status === "unavailable" && (
        <Alert variant="warning">
          <CameraOff className="h-4 w-4" />
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}

      {status === "live" && (features.zoom || features.torch || cameras.length > 1) && (
        <div className="flex flex-wrap items-center gap-2">
          {features.zoom && (
            <label className="flex min-w-40 flex-1 items-center gap-2 text-muted-foreground">
              <ZoomIn className="h-4 w-4 shrink-0" />
              <span className="sr-only">Zoom</span>
              <input
                type="range"
                aria-label="Zoom"
                className="h-2 w-full cursor-pointer accent-primary"
                min={features.zoom.min}
                max={features.zoom.max}
                step={features.zoom.step}
                value={zoom}
                onChange={(event) => void changeZoom(Number(event.target.value))}
              />
            </label>
          )}
          {features.torch && (
            <Button type="button" variant="outline" size="sm" aria-pressed={torchOn} onClick={() => void toggleTorch()}>
              {torchOn ? <FlashlightOff /> : <Flashlight />}
              {torchOn ? "Light off" : "Light"}
            </Button>
          )}
          {cameras.length > 1 && (
            <Button type="button" variant="outline" size="sm" onClick={switchCamera} title="Use the next camera">
              <SwitchCamera />
              Switch camera
            </Button>
          )}
        </div>
      )}

      {status !== "unavailable" && (
        <p className="text-center text-xs text-muted-foreground">
          {status === "starting"
            ? "Starting the camera…"
            : canRefocus
              ? "Hold a barcode or QR code about 15 to 25 cm away. Tap the picture to focus; if it stays blurry, move back a little."
              : "Hold a barcode or QR code steady in view. If it stays blurry, move back a little."}
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
 * Scans barcodes and QR codes with the device camera, or takes a code typed in. `onScan` returns how it
 * went, which is shown under the camera; the dialog stays open so several items can be scanned in a row.
 * The owner closes it (via `onClose`) when one code is all that is needed.
 */
export function BarcodeScannerDialog({
  open,
  onClose,
  onScan,
  title = "Scan a barcode",
  description = "Use the camera to read a barcode or QR code, or type the code.",
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
