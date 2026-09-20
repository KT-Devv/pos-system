"use client";

import { useState } from "react";
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

const LABEL_SIZES = {
  small: { width: 40, height: 25, label: "40 × 25 mm" },
  standard: { width: 50, height: 30, label: "50 × 30 mm" },
  large: { width: 60, height: 40, label: "60 × 40 mm" },
} as const;
type LabelSize = keyof typeof LABEL_SIZES;

const MAX_COPIES = 100;

// The label roll stays loaded from one product to the next, so the size is remembered for the session.
let lastSize: LabelSize = "standard";

/** One shelf/product label. Sized in millimetres so it prints at the size of the label stock. */
function BarcodeLabel({ product, size, index }: { product: Product; size: LabelSize; index: number }) {
  const { width, height } = LABEL_SIZES[size];
  const barcode = product.barcode ?? "";
  return (
    <div
      className="box-border flex flex-col justify-between overflow-hidden bg-white p-[1.5mm] text-black"
      // Each label on its own page for label rolls; none before the first, so no blank leading page.
      style={{ width: `${width}mm`, height: `${height}mm`, breakBefore: index === 0 ? "auto" : "page" }}
    >
      <p className={`${size === "small" ? "line-clamp-1" : "line-clamp-2"} text-[8.5pt] font-bold leading-tight`}>{product.name}</p>
      <div>
        <BarcodeSvg value={barcode} className="block w-full" />
        <p className="text-center font-mono text-[7pt] leading-none tracking-[0.15em]">{barcode}</p>
      </div>
      <p className="text-[10pt] font-extrabold leading-none">{formatCurrency(product.selling_price)}</p>
    </div>
  );
}

/** Previews and prints barcode labels for a product. Pass `null` to keep it closed. */
export function BarcodeLabelDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const [size, setSize] = useState<LabelSize>(lastSize);
  const [copies, setCopies] = useState("1");
  const chooseSize = (next: LabelSize) => {
    lastSize = next;
    setSize(next);
  };

  const count = Math.min(MAX_COPIES, Math.max(1, Math.floor(Number(copies)) || 1));
  const barcode = product?.barcode ?? "";
  const printable = canEncodeCode128(barcode);
  const { width, height } = LABEL_SIZES[size];

  return (
    <>
      <Dialog open={product !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Print barcode label</DialogTitle>
            <DialogDescription>{product?.name}</DialogDescription>
          </DialogHeader>

          {product && !barcode && (
            <Alert variant="info">
              <Info className="h-4 w-4" />
              <AlertDescription>This product has no barcode yet. Edit it to type one in, scan one, or generate a new one.</AlertDescription>
            </Alert>
          )}
          {product && barcode && !printable && (
            <Alert variant="warning">
              <Info className="h-4 w-4" />
              <AlertDescription>
                This barcode can&apos;t be printed as a label: it needs to be 1 to {CODE128_MAX_LENGTH} letters, numbers or common symbols.
              </AlertDescription>
            </Alert>
          )}

          {product && printable && (
            <>
              <div className="grid justify-center rounded-xl border bg-muted p-4">
                <div className="shadow-sm">
                  <BarcodeLabel product={product} size={size} index={0} />
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
        <PrintArea pageSize={`${width}mm ${height}mm`}>
          {Array.from({ length: count }, (_, index) => (
            <BarcodeLabel key={index} product={product} size={size} index={index} />
          ))}
        </PrintArea>
      )}
    </>
  );
}
