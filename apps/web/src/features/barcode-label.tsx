"use client";

import { type CSSProperties, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  Alert,
  AlertDescription,
  Button,
  canEncodeCode128,
  code128Bars,
  CODE128_MAX_LENGTH,
  CODE128_QUIET_ZONE,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  formatCurrency,
  Input,
  SegmentedControl,
} from "@pos/shared";
import { Info, Printer } from "lucide-react";
import { PrintArea, printPage } from "@/components/print-area";
import { Field, type Product } from "./common";

const BAR_HEIGHT = 40;

/** A Code 128 barcode as SVG. Width follows its container; give it a height with a class. */
export function BarcodeSvg({ value, className }: { value: string; className?: string }) {
  const { bars, modules } = code128Bars(value);
  const width = modules + CODE128_QUIET_ZONE * 2;
  return (
    <svg
      role="img"
      aria-label={`Barcode ${value}`}
      viewBox={`0 0 ${width} ${BAR_HEIGHT}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      className={className}
    >
      {bars.map((bar) => (
        <rect key={bar.x} x={CODE128_QUIET_ZONE + bar.x} y={0} width={bar.width} height={BAR_HEIGHT} fill="#000" />
      ))}
    </svg>
  );
}

/** Quiet zone the QR specification asks for on every side, in modules. */
const QR_QUIET_ZONE = 4;
/**
 * Longest text a QR label encodes. Past this the code needs more than ~50 modules, which on a 27 mm
 * square is under half a millimetre each: too fine for a thermal printer to reproduce reliably.
 */
const QR_MAX_LENGTH = 120;

/** A QR code as SVG: one path of dark modules on white, so it prints crisply at any size. */
export function QrSvg({ value, className, style }: { value: string; className?: string; style?: CSSProperties }) {
  const { size, path } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
    let d = "";
    for (let row = 0; row < modules.size; row += 1) {
      for (let col = 0; col < modules.size; col += 1) {
        if (modules.get(row, col)) d += `M${col + QR_QUIET_ZONE} ${row + QR_QUIET_ZONE}h1v1h-1z`;
      }
    }
    return { size: modules.size + QR_QUIET_ZONE * 2, path: d };
  }, [value]);
  return (
    <svg role="img" aria-label={`QR code ${value}`} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" className={className} style={style}>
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}

const LABEL_SIZES = {
  small: { width: 40, height: 25, label: "40 × 25 mm" },
  standard: { width: 50, height: 30, label: "50 × 30 mm" },
  large: { width: 60, height: 40, label: "60 × 40 mm" },
} as const;
type LabelSize = keyof typeof LABEL_SIZES;
type LabelKind = "barcode" | "qr";

const MAX_COPIES = 100;

// The label roll stays loaded from one product to the next, so these are remembered for the session.
let lastSize: LabelSize = "standard";
let lastKind: LabelKind = "barcode";

function canPrintAs(kind: LabelKind, code: string) {
  return kind === "qr" ? code.length > 0 && code.length <= QR_MAX_LENGTH : canEncodeCode128(code);
}

/** One shelf/product label. Sized in millimetres so it prints at the size of the label stock. */
function CodeLabel({ product, size, kind, index }: { product: Product; size: LabelSize; kind: LabelKind; index: number }) {
  const { width, height } = LABEL_SIZES[size];
  const code = product.barcode ?? "";
  const frame = {
    width: `${width}mm`,
    height: `${height}mm`,
    // Each label on its own page for label rolls; none before the first, so no blank leading page.
    breakBefore: index === 0 ? "auto" : "page",
  } as const;

  if (kind === "qr") {
    // Square code on the left as large as the label allows, the words beside it.
    const qrSize = Math.min(height - 3, width * 0.55);
    return (
      <div className="box-border flex items-stretch gap-[1.5mm] overflow-hidden bg-white p-[1.5mm] text-black" style={frame}>
        <QrSvg value={code} className="block shrink-0" style={{ width: `${qrSize}mm`, height: `${qrSize}mm` }} />
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <p className="line-clamp-4 break-words text-[7.5pt] font-bold leading-tight">{product.name}</p>
          <div>
            <p className="break-all font-mono text-[6pt] leading-tight">{code}</p>
            <p className="text-[10pt] font-extrabold leading-none">{formatCurrency(product.selling_price)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="box-border flex flex-col justify-between overflow-hidden bg-white p-[1.5mm] text-black" style={frame}>
      <p className={`${size === "small" ? "line-clamp-1" : "line-clamp-2"} text-[8.5pt] font-bold leading-tight`}>{product.name}</p>
      <div>
        <BarcodeSvg value={code} className="block w-full" />
        <p className="text-center font-mono text-[7pt] leading-none tracking-[0.15em]">{code}</p>
      </div>
      <p className="text-[10pt] font-extrabold leading-none">{formatCurrency(product.selling_price)}</p>
    </div>
  );
}

/** Previews and prints barcode or QR labels for a product. Pass `null` to keep it closed. */
export function BarcodeLabelDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const [size, setSize] = useState<LabelSize>(lastSize);
  const [kind, setKind] = useState<LabelKind>(lastKind);
  const [copies, setCopies] = useState("1");
  const chooseSize = (next: LabelSize) => {
    lastSize = next;
    setSize(next);
  };
  const chooseKind = (next: LabelKind) => {
    lastKind = next;
    setKind(next);
  };

  const count = Math.min(MAX_COPIES, Math.max(1, Math.floor(Number(copies)) || 1));
  const code = product?.barcode ?? "";
  const printable = canPrintAs(kind, code);

  return (
    <>
      <Dialog open={product !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Print label</DialogTitle>
            <DialogDescription>{product?.name}</DialogDescription>
          </DialogHeader>

          {product && !code && (
            <Alert variant="info">
              <Info className="h-4 w-4" />
              <AlertDescription>This product has no barcode yet. Edit it to type one in, scan one, or generate a new one.</AlertDescription>
            </Alert>
          )}
          {product && code && !printable && (
            <Alert variant="warning">
              <Info className="h-4 w-4" />
              <AlertDescription>
                {kind === "qr"
                  ? `This code is too long for a QR label (up to ${QR_MAX_LENGTH} characters).`
                  : canPrintAs("qr", code)
                    ? `This code can't be printed as a barcode: it needs to be 1 to ${CODE128_MAX_LENGTH} letters, numbers or common symbols. Choose QR code instead.`
                    : `This code can't be printed as a label.`}
              </AlertDescription>
            </Alert>
          )}

          {product && code && (
            <Field label="Label type">
              <SegmentedControl
                aria-label="Label type"
                fullWidth
                value={kind}
                onValueChange={chooseKind}
                options={[{ value: "barcode", label: "Barcode" }, { value: "qr", label: "QR code" }]}
              />
            </Field>
          )}

          {product && printable && (
            <>
              <div className="grid justify-center rounded-xl border bg-muted p-4">
                <div className="shadow-sm">
                  <CodeLabel product={product} size={size} kind={kind} index={0} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
                <Field label="Label size">
                  <SegmentedControl
                    aria-label="Label size"
                    fullWidth
                    value={size}
                    onValueChange={chooseSize}
                    options={(Object.keys(LABEL_SIZES) as LabelSize[]).map((key) => ({ value: key, label: LABEL_SIZES[key].label }))}
                  />
                </Field>
                <Field label="Copies" htmlFor="label-copies">
                  <Input
                    id="label-copies"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_COPIES}
                    value={copies}
                    onChange={(event) => setCopies(event.target.value)}
                  />
                </Field>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Close</Button>
            <Button type="button" disabled={!printable} onClick={printPage}>
              <Printer />
              {printable && count > 1 ? `Print ${count} labels` : "Print label"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {product && printable && (
        <PrintArea page={`label-${size}`}>
          {Array.from({ length: count }, (_, index) => (
            <CodeLabel key={index} product={product} size={size} kind={kind} index={index} />
          ))}
        </PrintArea>
      )}
    </>
  );
}
