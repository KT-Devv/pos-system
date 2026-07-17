import { useEffect, useRef, useState } from 'react';
import { Button } from '@pos/shared/components/button';
import { Input } from '@pos/shared/components/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@pos/shared/components/dialog';
import { Camera, Keyboard, X } from 'lucide-react';

interface QRScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export default function QRScanner({ open, onClose, onScan }: QRScannerProps) {
  const [mode, setMode] = useState<'camera' | 'manual'>('manual');
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<unknown>(null);

  useEffect(() => {
    if (!open) {
      stopScanning();
      setManualCode('');
      setError(null);
    }
  }, [open]);

  const startCameraScanning = async () => {
    if (!scannerRef.current) return;
    setMode('camera');
    setScanning(true);
    setError(null);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          onScan(decodedText);
          stopScanning();
          onClose();
        },
        () => {}
      );
    } catch {
      setError('Could not access camera. Try manual entry instead.');
      setScanning(false);
    }
  };

  const stopScanning = async () => {
    if (html5QrCodeRef.current) {
      try {
        const scanner = html5QrCodeRef.current as { stop: () => Promise<void>; clear: () => void };
        await scanner.stop();
        scanner.clear();
      } catch { /* ignore */ }
      html5QrCodeRef.current = null;
    }
    setScanning(false);
  };

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Scan QR Code / Barcode
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant={mode === 'camera' ? 'default' : 'outline'} onClick={startCameraScanning} className="flex-1">
              <Camera className="h-4 w-4 mr-2" />Camera
            </Button>
            <Button variant={mode === 'manual' ? 'default' : 'outline'} onClick={() => { stopScanning(); setMode('manual'); }} className="flex-1">
              <Keyboard className="h-4 w-4 mr-2" />Manual
            </Button>
          </div>

          {mode === 'camera' && (
            <div className="relative">
              <div id="qr-reader" ref={scannerRef} className="w-full rounded-lg overflow-hidden" />
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-primary rounded-lg animate-pulse" />
                </div>
              )}
            </div>
          )}

          {mode === 'manual' && (
            <div className="space-y-4">
              <Input
                placeholder="Type or scan barcode/QR code..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                autoFocus
              />
              <Button className="w-full" onClick={handleManualSubmit} disabled={!manualCode.trim()}>
                Search Product
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <p className="text-xs text-muted-foreground text-center">
            {mode === 'camera' ? 'Point your camera at a QR code or barcode' : 'USB scanners will auto-submit the code'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
