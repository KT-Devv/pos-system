import { Button } from '@pos/shared/components/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@pos/shared/components/dialog';
import { formatCurrency } from '@pos/shared/lib/utils';
import { Printer, X } from 'lucide-react';
import type { ReceiptData } from '../hooks/useReceipt';
import { printReceipt } from '../hooks/useReceipt';

interface ReceiptPreviewProps {
  open: boolean;
  onClose: () => void;
  data: ReceiptData | null;
}

export default function ReceiptPreview({ open, onClose, data }: ReceiptPreviewProps) {
  if (!data) return null;

  const handlePrint = async () => {
    await printReceipt(data);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Receipt Preview
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Receipt Preview */}
        <div className="bg-white border rounded-lg p-4 font-mono text-xs space-y-2 max-h-96 overflow-auto">
          <div className="text-center">
            <p className="font-bold text-base">{data.shopName}</p>
            {data.shopPhone && <p className="text-muted-foreground">{data.shopPhone}</p>}
            {data.shopAddress && <p className="text-muted-foreground">{data.shopAddress}</p>}
          </div>

          <div className="border-t border-dashed my-2" />

          <div className="space-y-1">
            <p>Date: {data.date}</p>
            <p>Receipt: #{data.saleId.slice(0, 8)}</p>
            <p>Cashier: {data.cashierName}</p>
          </div>

          <div className="border-t border-dashed my-2" />

          <div className="space-y-1">
            {data.items.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span>{item.name} x{item.quantity}</span>
                <span>{formatCurrency(item.price)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed my-2" />

          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatCurrency(data.subtotal)}</span>
            </div>
            {data.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount:</span>
                <span>-{formatCurrency(data.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm border-t pt-1">
              <span>TOTAL:</span>
              <span>{formatCurrency(data.total)}</span>
            </div>
          </div>

          <div className="border-t border-dashed my-2" />

          <div className="text-center">
            <p>Payment: {data.paymentMethod.toUpperCase()}</p>
            <p className="mt-2">Thank you for your purchase!</p>
            <p>See you again!</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
