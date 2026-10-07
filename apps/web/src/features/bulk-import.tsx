"use client";

import { type DragEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  cn,
  columnsFor,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  examplesFor,
  formatCurrency,
  IMPORT_MAX_FILE_BYTES,
  IMPORT_MAX_ROWS,
  type ImportKind,
  type ImportCell,
  parseCsv,
  planProductImport,
  planStockImport,
  type ProductImportPlan,
  type RawTable,
  readTable,
  type StockImportPlan,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  templateCsv,
  type TableReading,
} from "@pos/shared";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { type Client, fail, fetchAll, loadPackSizes } from "./common";

type Plan = { kind: "products"; plan: ProductImportPlan } | { kind: "stock"; plan: StockImportPlan };
type Review = { fileName: string; reading: TableReading; result: Plan | null };

const COPY: Record<ImportKind, { title: string; intro: string; file: string; sheet: string; tips: string[] }> = {
  products: {
    title: "Import products",
    intro: "Add many products at once from an Excel or CSV file. Download the template, fill it in, and upload it.",
    file: "kt-pos-products-template",
    sheet: "Products",
    tips: [
      "Rows that start with e.g. are examples and are ignored.",
      "Keep the headings exactly as they are. Up to 2,000 rows at a time.",
      "Products already in your shop (same name) are skipped, so uploading a file twice adds nothing.",
      "For a product with more than one pack size, repeat its Name on another row and fill in only the pack columns.",
      "If any row has a problem, nothing is imported until you fix it.",
    ],
  },
  stock: {
    title: "Import stock",
    intro: "Record stock in, stock out and recounts for many products at once from an Excel or CSV file.",
    file: "kt-pos-stock-template",
    sheet: "Stock",
    tips: [
      "Rows that start with e.g. are examples and are ignored.",
      "Name each product by its Product name or its Barcode, exactly as it is in your shop.",
      "Quantities count single items. A Recount sets the stock to the number you counted.",
      "Rows are applied in order, and if any row has a problem nothing is recorded until you fix it.",
    ],
  },
};

const MAX_LISTED_PROBLEMS = 25;
const PREVIEW_ROWS = 8;

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function downloadExcelTemplate(kind: ImportKind) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const columns = columnsFor(kind);
  const head = (value: string) => ({ value, fontWeight: "bold" as const, backgroundColor: "#dff3e8" });
  const guide = [
    [head("Column"), head("Required?"), head("What to put in it")],
    ...columns.map((column) => [column.header, column.required ? "Yes" : "No", column.help]),
    [null, null, null],
    [head("Good to know"), null, null],
    ...COPY[kind].tips.map((tip) => [tip, null, null]),
  ];
  await writeXlsxFile(
    [
      {
        sheet: COPY[kind].sheet,
        data: [columns.map((column) => head(column.header)), ...examplesFor(kind).map((row) => row.map((value) => (value === "" ? null : value)))],
        columns: columns.map((column) => ({ width: Math.max(14, column.header.length + 6) })),
        stickyRowsCount: 1,
      },
      { sheet: "How to fill in", data: guide, columns: [{ width: 22 }, { width: 12 }, { width: 100 }] },
    ],
  ).toFile(`${COPY[kind].file}.xlsx`);
}

/** Reads an .xlsx or .csv file into rows of cells. Throws a message a shop owner can act on. */
async function readFileTable(file: File, kind: ImportKind): Promise<RawTable> {
  if (file.size === 0) throw new Error("That file is empty.");
  if (file.size > IMPORT_MAX_FILE_BYTES) {
    throw new Error(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${IMPORT_MAX_FILE_BYTES / 1024 / 1024} MB.`);
  }
  const buffer = await file.arrayBuffer();
  const head = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  if (head[0] === 0x50 && head[1] === 0x4b) {
    const { default: readXlsxFile } = await import("read-excel-file/universal");
    let sheets;
    try {
      sheets = await readXlsxFile(buffer);
    } catch {
      throw new Error("That Excel file could not be read. Open it in Excel and save it again as an Excel Workbook (.xlsx) or as CSV.");
    }
    const wanted = new RegExp(`^${COPY[kind].sheet}$`, "i");
    const sheet = sheets.find((s) => wanted.test(s.sheet)) ?? sheets.find((s) => !/how|instruction|guide/i.test(s.sheet)) ?? sheets[0];
    return (sheet?.data ?? []) as ImportCell[][];
  }
  if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) {
    throw new Error("That is an old Excel (.xls) file. Open it in Excel and save it as an Excel Workbook (.xlsx) or as CSV.");
  }
  if (/\.xlsx?$/i.test(file.name)) throw new Error("That file is not a valid Excel workbook. Save it as .xlsx or CSV and try again.");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder("windows-1252").decode(buffer); // Excel's "CSV" on Windows
  }
  return parseCsv(text);
}

function ProblemList({ issues }: { issues: { rowNumber: number; message: string }[] }) {
  return (
    <ul className="mt-2 grid gap-1 text-sm">
      {issues.slice(0, MAX_LISTED_PROBLEMS).map((issue, index) => (
        <li key={index}><span className="font-semibold tabular-nums">Row {issue.rowNumber}:</span> {issue.message}</li>
      ))}
      {issues.length > MAX_LISTED_PROBLEMS && <li className="text-muted-foreground">…and {issues.length - MAX_LISTED_PROBLEMS} more.</li>}
    </ul>
  );
}

export function BulkImportDialog({
  kind,
  open,
  onClose,
  supabase,
  onImported,
  onError,
}: {
  kind: ImportKind;
  open: boolean;
  onClose: () => void;
  supabase: Client;
  onImported: (message: string) => void;
  onError: (message: string) => void;
}) {
  const { shop } = useWorkspace();
  const copy = COPY[kind];
  const fileInput = useRef<HTMLInputElement>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [problem, setProblem] = useState("");
  const [working, setWorking] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (open) return;
    setReview(null);
    setProblem("");
    setWorking(false);
  }, [open]);

  const chooseFile = useCallback(async (file: File) => {
    setProblem("");
    setWorking(true);
    try {
      const reading = readTable(await readFileTable(file, kind), columnsFor(kind), kind === "stock" ? ["product", "barcode"] : []);
      if (reading.fileProblems.length > 0) { setReview({ fileName: file.name, reading, result: null }); return; }

      // Check against what is in the shop right now, not what the screen loaded a while ago.
      const [products, packs, categories, suppliers] = await Promise.all([
        fetchAll<{ id: string; name: string; barcode: string | null; stock: number }>((from, to) =>
          supabase.from("products").select("id,name,barcode,stock").order("id").range(from, to)),
        loadPackSizes(supabase),
        supabase.from("categories").select("name"),
        supabase.from("suppliers").select("id,name"),
      ]);
      const failure = products.error ?? packs.error ?? categories.error ?? suppliers.error;
      if (failure) throw new Error(failure.message);

      const result: Plan = kind === "products"
        ? {
            kind,
            plan: planProductImport(reading.records, {
              productNames: products.data.map((p) => p.name),
              barcodes: [
                ...products.data.flatMap((p) => (p.barcode ? [p.barcode] : [])),
                ...[...packs.data.values()].flat().flatMap((pack) => (pack.barcode ? [pack.barcode] : [])),
              ],
              categories: (categories.data ?? []).map((c) => c.name as string),
            }),
          }
        : {
            kind,
            plan: planStockImport(
              reading.records,
              products.data.map((p) => ({ ...p, stock: Number(p.stock) })),
              (suppliers.data ?? []) as { id: string; name: string }[],
            ),
          };
      setReview({ fileName: file.name, reading, result });
    } catch (error) {
      setReview(null);
      setProblem(error instanceof Error ? error.message : "That file could not be read.");
    } finally {
      setWorking(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }, [kind, supabase]);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void chooseFile(file);
  };

  const result = review?.result ?? null;
  const issues = result?.plan.issues ?? [];
  const toImport = result ? result.plan.rows.length : 0;

  const runImport = async () => {
    if (!result || issues.length > 0 || toImport === 0) return;
    setWorking(true);
    let message: string;
    if (result.kind === "products") {
      const { data, error } = await supabase.rpc("bulk_import_products", {
        p_shop_id: shop.id,
        p_rows: result.plan.rows.map((row) => ({
          name: row.name,
          category: row.category,
          cost_price: row.costPrice,
          selling_price: row.sellingPrice,
          wholesale_price: row.wholesalePrice,
          stock: row.stock,
          barcode: row.barcode,
          packs: row.packs.map((pack) => ({ name: pack.name, quantity: pack.quantity, selling_price: pack.sellingPrice, barcode: pack.barcode })),
        })),
      });
      if (error) { setWorking(false); fail(onError, error); return; }
      const done = data as { products: number; packs: number; categories: number; skipped: number };
      message = `Added ${done.products} ${done.products === 1 ? "product" : "products"}`
        + (done.packs ? `, ${done.packs} pack ${done.packs === 1 ? "size" : "sizes"}` : "")
        + (done.categories ? ` and ${done.categories} ${done.categories === 1 ? "category" : "categories"}` : "")
        + (done.skipped ? ` (${done.skipped} already existed)` : "") + ".";
    } else {
      const { data, error } = await supabase.rpc("bulk_record_stock", {
        p_shop_id: shop.id,
        p_rows: result.plan.rows.map((row) => ({ product_id: row.productId, type: row.type, quantity: row.quantity, supplier_id: row.supplierId, notes: row.notes })),
      });
      if (error) { setWorking(false); fail(onError, error); return; }
      const count = Number(data);
      message = `Recorded ${count} stock ${count === 1 ? "movement" : "movements"}.`;
    }
    setWorking(false);
    onImported(message);
    onClose();
  };

  const downloadCsv = () => saveBlob(new Blob([templateCsv(kind)], { type: "text/csv;charset=utf-8" }), `${copy.file}.csv`);
  const downloadExcel = () => { void downloadExcelTemplate(kind).catch(() => onError("The template could not be created. Try the CSV template instead.")); };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !working) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.intro}</DialogDescription>
        </DialogHeader>

        {!review && (
          <div className="grid gap-4">
            <div className="grid gap-2 rounded-xl border bg-muted/40 p-4">
              <p className="text-sm font-semibold">1. Get the template</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={downloadExcel}><Download />Excel template (.xlsx)</Button>
                <Button type="button" variant="outline" size="sm" onClick={downloadCsv}><Download />CSV template</Button>
              </div>
              <ul className="mt-1 grid gap-1 text-xs text-muted-foreground">
                {copy.tips.map((tip) => <li key={tip}>• {tip}</li>)}
              </ul>
            </div>

            <div
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn("grid justify-items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center", dragging ? "border-primary bg-accent" : "border-input")}
            >
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">2. Upload your filled-in file</p>
                <p className="text-xs text-muted-foreground">Excel (.xlsx) or CSV, up to {IMPORT_MAX_FILE_BYTES / 1024 / 1024} MB and {IMPORT_MAX_ROWS.toLocaleString()} rows. Drop it here or choose it.</p>
              </div>
              <Button type="button" disabled={working} onClick={() => fileInput.current?.click()}>
                <Upload />
                {working ? "Reading…" : "Choose file"}
              </Button>
              <input
                ref={fileInput}
                type="file"
                hidden
                accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                aria-label={`${copy.title}: choose a file`}
                onChange={(event) => { const file = event.target.files?.[0]; if (file) void chooseFile(file); }}
              />
            </div>
            {problem && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{problem}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {review && (
          <div className="grid min-w-0 gap-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate font-semibold text-foreground">{review.fileName}</span>
              {review.reading.examplesIgnored > 0 && <span className="shrink-0">· {review.reading.examplesIgnored} example {review.reading.examplesIgnored === 1 ? "row" : "rows"} ignored</span>}
            </p>

            {review.reading.fileProblems.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="grid gap-1">{review.reading.fileProblems.map((text) => <li key={text}>{text}</li>)}</ul>
                </AlertDescription>
              </Alert>
            )}

            {result && issues.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-semibold">{issues.length} {issues.length === 1 ? "problem" : "problems"} to fix. Nothing has been imported.</p>
                  <div className="max-h-48 overflow-y-auto pr-1"><ProblemList issues={issues} /></div>
                  <p className="mt-2 text-xs">Fix them in your file, save it, and choose it again.</p>
                </AlertDescription>
              </Alert>
            )}

            {result && issues.length === 0 && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {result.kind === "products" ? (
                    <>
                      <Badge variant="success"><CheckCircle2 />{toImport} {toImport === 1 ? "product" : "products"} to add</Badge>
                      {result.plan.packCount > 0 && <Badge variant="secondary">{result.plan.packCount} pack {result.plan.packCount === 1 ? "size" : "sizes"}</Badge>}
                      {result.plan.newCategories.length > 0 && <Badge variant="secondary">{result.plan.newCategories.length} new {result.plan.newCategories.length === 1 ? "category" : "categories"}</Badge>}
                      {result.plan.alreadyThere.length > 0 && <Badge variant="warning">{result.plan.alreadyThere.length} already in your shop, skipped</Badge>}
                    </>
                  ) : (
                    <Badge variant="success"><CheckCircle2 />{toImport} stock {toImport === 1 ? "movement" : "movements"} to record</Badge>
                  )}
                </div>
                {result.kind === "products" && result.plan.newCategories.length > 0 && (
                  <p className="-mt-2 text-xs text-muted-foreground">New categories: {result.plan.newCategories.slice(0, 8).join(", ")}{result.plan.newCategories.length > 8 ? `, and ${result.plan.newCategories.length - 8} more` : ""}.</p>
                )}

                {toImport === 0 ? (
                  <Alert variant="info">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Everything in this file is already in your shop, so there is nothing to add.</AlertDescription>
                  </Alert>
                ) : (
                  <div className="max-h-72 overflow-auto rounded-lg border">
                    {result.kind === "products" ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="hidden sm:table-cell">Row</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="hidden sm:table-cell">Category</TableHead>
                            <TableHead className="hidden text-right sm:table-cell">Cost</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.plan.rows.slice(0, PREVIEW_ROWS).map((row) => (
                            <TableRow key={row.rowNumber}>
                              <TableCell className="hidden tabular-nums text-muted-foreground sm:table-cell">{row.rowNumber}</TableCell>
                              <TableCell className="font-semibold">
                                {row.name}
                                {row.packs.length > 0 && <p className="text-xs font-normal text-muted-foreground">{row.packs.map((p) => `${p.name} of ${p.quantity}`).join(", ")}</p>}
                              </TableCell>
                              <TableCell className="hidden text-muted-foreground sm:table-cell">{row.category ?? "—"}</TableCell>
                              <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">{formatCurrency(row.costPrice)}</TableCell>
                              <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(row.sellingPrice)}</TableCell>
                              <TableCell className="text-right tabular-nums">{row.stock}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="hidden sm:table-cell">Row</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Stock after</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.plan.rows.slice(0, PREVIEW_ROWS).map((row) => (
                            <TableRow key={row.rowNumber}>
                              <TableCell className="hidden tabular-nums text-muted-foreground sm:table-cell">{row.rowNumber}</TableCell>
                              <TableCell className="font-semibold">
                                {row.productName}
                                {row.supplierName && <p className="text-xs font-normal text-muted-foreground">{row.supplierName}</p>}
                              </TableCell>
                              <TableCell>{row.type === "in" ? "Stock in" : row.type === "out" ? "Stock out" : "Recount"}</TableCell>
                              <TableCell className="text-right font-semibold tabular-nums">{row.quantity}</TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">{row.stockBefore} → {row.stockAfter}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
                {toImport > PREVIEW_ROWS && <p className="-mt-2 text-xs text-muted-foreground">Showing the first {PREVIEW_ROWS} of {toImport} rows.</p>}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={working} onClick={onClose}>Cancel</Button>
          {review && <Button type="button" variant="outline" disabled={working} onClick={() => { setReview(null); setProblem(""); }}>Choose another file</Button>}
          {review && result && issues.length === 0 && toImport > 0 && (
            <Button type="button" disabled={working} onClick={() => void runImport()}>
              {working ? "Importing…" : kind === "products" ? `Import ${toImport} ${toImport === 1 ? "product" : "products"}` : `Record ${toImport} ${toImport === 1 ? "movement" : "movements"}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
