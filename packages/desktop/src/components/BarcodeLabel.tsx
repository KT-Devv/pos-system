import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@pos/shared/components/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@pos/shared/components/dialog';
import { Printer } from 'lucide-react';

interface BarcodeLabelProps {
  open: boolean;
  onClose: () => void;
  product: { name: string; barcode: string | null; price: number } | null;
}

export default function BarcodeLabel({ open, onClose, product }: BarcodeLabelProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !product) { setQrDataUrl(null); return; }
    const code = product.barcode || product.name;
    QRCode.toDataURL(code, { width: 128, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [open, product]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank', 'width=300,height=200');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Barcode Label</title><style>
      @page{size:60mm 40mm;margin:2mm}*{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:center;padding:2mm;width:56mm}
      .name{font-size:9px;font-weight:bold;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;margin-bottom:1mm}
      img{width:22mm;height:22mm}
      .barcode-text{font-size:7px;font-family:monospace;text-align:center;margin-top:0.5mm}
      .price{font-size:10px;font-weight:bold;text-align:center;margin-top:0.5mm}
    </style></head><body>${content.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Print Barcode Label</DialogTitle>
        </DialogHeader>
        <div ref={printRef} className="flex flex-col items-center gap-2 p-4 border rounded-lg bg-white text-black">
          <p className="text-xs font-bold text-center truncate w-full">{product.name}</p>
          {qrDataUrl && <img src={qrDataUrl} alt="QR Code" className="w-32 h-32" />}
          {product.barcode && <p className="text-[10px] font-mono text-center">{product.barcode}</p>}
          <p className="text-sm font-bold text-center">GH₵ {product.price.toFixed(2)}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Print Label</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
