import { ipcMain } from 'electron';
import jsPDF from 'jspdf';
import { getDatabase } from '../db/index.js';
import { queryOne } from '../lib/db-helpers.js';
import { requireSession } from '../lib/session.js';

interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

interface ReceiptData {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  receiptHeader?: string;
  receiptFooter?: string;
  receiptNote?: string;
  currency?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  cashierName: string;
  date: string;
  saleId: string;
}

async function getSetting(key: string, fallback = ''): Promise<string> {
  const db = await getDatabase();
  const row = queryOne(db, 'SELECT value FROM settings WHERE key = ?', [key]);
  return (row?.value as string) || fallback;
}

export function registerReceiptHandlers(): void {
  ipcMain.handle('receipt:print', async (_event, token: string, data: ReceiptData) => {
    requireSession(token);
    try {
      const printerType = await getSetting('printer_type', 'none');
      const currency = data.currency || (await getSetting('currency', 'GHS'));
      const enriched = {
        ...data,
        currency,
        receiptHeader: data.receiptHeader || (await getSetting('receipt_header', data.shopName)),
        receiptFooter: data.receiptFooter || (await getSetting('receipt_footer', 'Thank you for your purchase!')),
        receiptNote: data.receiptNote || (await getSetting('receipt_note', 'See you again soon!')),
      };

      if (printerType === 'thermal') {
        return await printThermal(enriched);
      }
      if (printerType === 'pdf') {
        return await printPDF(enriched);
      }
      return { success: true, message: 'Receipt saved (no printer configured)' };
    } catch (error) {
      console.error('Receipt print error:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('receipt:testPrint', async (_event, token: string) => {
    requireSession(token);
    try {
      const printerType = await getSetting('printer_type', 'none');
      if (printerType === 'thermal') {
        return await testThermalPrint();
      }
      return { success: true, message: 'Test print skipped (no thermal printer configured)' };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`;
}

async function printThermal(data: ReceiptData): Promise<{ success: boolean; error?: string }> {
  try {
    const mod = await import('node-thermal-printer').catch(() => null);
    if (!mod?.ThermalPrinter || !mod?.PrinterTypes) {
      return await printPDF(data);
    }

    const printer = new mod.ThermalPrinter({
      type: mod.PrinterTypes.EPSON,
      interface: 'usb',
    });

    const currency = data.currency || 'GHS';

    await printer.alignCenter();
    await printer.bold(true);
    await printer.setTextSize(2, 2);
    await printer.println(data.receiptHeader || data.shopName);
    await printer.bold(false);
    await printer.setTextSize(1, 1);

    if (data.shopPhone) await printer.println(data.shopPhone);
    if (data.shopAddress) await printer.println(data.shopAddress);
    await printer.drawLine();
    await printer.alignLeft();
    await printer.println(`Date: ${data.date}`);
    await printer.println(`Receipt: #${data.saleId.slice(0, 8)}`);
    await printer.println(`Cashier: ${data.cashierName}`);
    await printer.drawLine();

    for (const item of data.items) {
      await printer.leftRight(`${item.name} x${item.quantity}`, formatMoney(item.price, currency));
    }

    await printer.drawLine();
    await printer.alignRight();
    await printer.println(`Subtotal: ${formatMoney(data.subtotal, currency)}`);
    if (data.discount > 0) {
      await printer.println(`Discount: -${formatMoney(data.discount, currency)}`);
    }
    await printer.bold(true);
    await printer.println(`TOTAL: ${formatMoney(data.total, currency)}`);
    await printer.bold(false);
    await printer.drawLine();
    await printer.alignCenter();
    await printer.println(`Payment: ${data.paymentMethod.toUpperCase()}`);
    await printer.println('');
    await printer.println(data.receiptFooter || 'Thank you for your purchase!');
    if (data.receiptNote) await printer.println(data.receiptNote);
    await printer.cut();
    await printer.execute();

    return { success: true };
  } catch {
    return await printPDF(data);
  }
}

async function testThermalPrint(): Promise<{ success: boolean; error?: string }> {
  try {
    const mod = await import('node-thermal-printer').catch(() => null);
    if (!mod?.ThermalPrinter || !mod?.PrinterTypes) {
      return { success: false, error: 'node-thermal-printer not available' };
    }

    const printer = new mod.ThermalPrinter({
      type: mod.PrinterTypes.EPSON,
      interface: 'usb',
    });

    await printer.alignCenter();
    await printer.bold(true);
    await printer.println('POS System Test Print');
    await printer.bold(false);
    await printer.drawLine();
    await printer.println('If you can read this,');
    await printer.println('your printer is working!');
    await printer.drawLine();
    await printer.cut();
    await printer.execute();

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function printPDF(data: ReceiptData): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    const currency = data.currency || 'GHS';
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 200] });
    const pageWidth = 80;
    const margin = 5;
    let y = 10;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(data.receiptHeader || data.shopName, pageWidth / 2, y, { align: 'center' });
    y += 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    if (data.shopPhone) { doc.text(data.shopPhone, pageWidth / 2, y, { align: 'center' }); y += 4; }
    if (data.shopAddress) { doc.text(data.shopAddress, pageWidth / 2, y, { align: 'center' }); y += 4; }

    y += 2;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFontSize(7);
    doc.text(`Date: ${data.date}`, margin, y); y += 4;
    doc.text(`Receipt: #${data.saleId.slice(0, 8)}`, margin, y); y += 4;
    doc.text(`Cashier: ${data.cashierName}`, margin, y); y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    for (const item of data.items) {
      doc.text(`${item.name} x${item.quantity}`, margin, y);
      doc.text(formatMoney(item.price, currency), pageWidth - margin, y, { align: 'right' });
      y += 4;
    }

    y += 2;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.text('Subtotal:', margin, y);
    doc.text(formatMoney(data.subtotal, currency), pageWidth - margin, y, { align: 'right' });
    y += 4;

    if (data.discount > 0) {
      doc.text('Discount:', margin, y);
      doc.text(`-${formatMoney(data.discount, currency)}`, pageWidth - margin, y, { align: 'right' });
      y += 4;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('TOTAL:', margin, y);
    doc.text(formatMoney(data.total, currency), pageWidth - margin, y, { align: 'right' });
    y += 6;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Payment: ${data.paymentMethod.toUpperCase()}`, pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text(data.receiptFooter || 'Thank you for your purchase!', pageWidth / 2, y, { align: 'center' });
    y += 4;
    if (data.receiptNote) doc.text(data.receiptNote, pageWidth / 2, y, { align: 'center' });

    const { dialog } = await import('electron');
    const result = await dialog.showSaveDialog({
      defaultPath: `receipt-${data.saleId.slice(0, 8)}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (!result.canceled && result.filePath) {
      doc.save(result.filePath);
      return { success: true, filePath: result.filePath };
    }

    return { success: false, error: 'Save cancelled' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
