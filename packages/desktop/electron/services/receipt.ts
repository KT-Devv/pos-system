import { ipcMain } from 'electron';
import jsPDF from 'jspdf';

interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

interface ReceiptData {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  cashierName: string;
  date: string;
  saleId: string;
}

export function registerReceiptHandlers(): void {
  ipcMain.handle('receipt:print', async (_event, data: ReceiptData) => {
    try {
      const printerType = await getPrinterType();

      if (printerType === 'thermal') {
        return await printThermal(data);
      } else {
        return await printPDF(data);
      }
    } catch (error) {
      console.error('Receipt print error:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('receipt:testPrint', async () => {
    try {
      const printerType = await getPrinterType();
      if (printerType === 'thermal') {
        return await testThermalPrint();
      }
      return { success: true, message: 'Test print skipped (PDF mode)' };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}

async function getPrinterType(): Promise<string> {
  try {
    const { getDatabase } = await import('../db/index.js');
    const db = await getDatabase();
    const stmt = db.prepare("SELECT value FROM settings WHERE key = 'printer_type'");
    if (stmt.step()) {
      const row = stmt.getAsObject() as { value: string };
      stmt.free();
      return row.value || 'none';
    }
    stmt.free();
    return 'none';
  } catch {
    return 'none';
  }
}

async function printThermal(data: ReceiptData): Promise<{ success: boolean; error?: string }> {
  try {
    const escpos = await import('node-thermal-printer').catch(() => null);

    if (!escpos) {
      return await printPDF(data);
    }

    const printer = new escpos.Printer({
      type: escpos.types.EPSON,
      interface: 'usb',
      options: {
        codepage: 'cp437',
      },
    });

    await printer.alignCenter();
    await printer.bold(true);
    await printer.setTextSize(2, 2);
    await printer.println(data.shopName);
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
      const line = `${item.name} x${item.quantity}`;
      const price = `GHS ${item.price.toFixed(2)}`;
      await printer.leftRight(line, price);
    }

    await printer.drawLine();
    await printer.alignRight();
    await printer.println(`Subtotal: GHS ${data.subtotal.toFixed(2)}`);
    if (data.discount > 0) {
      await printer.println(`Discount: -GHS ${data.discount.toFixed(2)}`);
    }
    await printer.bold(true);
    await printer.println(`TOTAL: GHS ${data.total.toFixed(2)}`);
    await printer.bold(false);
    await printer.drawLine();
    await printer.alignCenter();
    await printer.println(`Payment: ${data.paymentMethod.toUpperCase()}`);
    await printer.println('');
    await printer.println('Thank you for your purchase!');
    await printer.println('See you again!');
    await printer.cut();
    await printer.execute();

    return { success: true };
  } catch (error) {
    return await printPDF(data);
  }
}

async function testThermalPrint(): Promise<{ success: boolean; error?: string }> {
  try {
    const escpos = await import('node-thermal-printer').catch(() => null);

    if (!escpos) {
      return { success: false, error: 'node-thermal-printer not available' };
    }

    const printer = new escpos.Printer({
      type: escpos.types.EPSON,
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
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 200],
    });

    const pageWidth = 80;
    const margin = 5;
    let y = 10;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(data.shopName, pageWidth / 2, y, { align: 'center' });
    y += 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    if (data.shopPhone) {
      doc.text(data.shopPhone, pageWidth / 2, y, { align: 'center' });
      y += 4;
    }
    if (data.shopAddress) {
      doc.text(data.shopAddress, pageWidth / 2, y, { align: 'center' });
      y += 4;
    }

    y += 2;
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFontSize(7);
    doc.text(`Date: ${data.date}`, margin, y);
    y += 4;
    doc.text(`Receipt: #${data.saleId.slice(0, 8)}`, margin, y);
    y += 4;
    doc.text(`Cashier: ${data.cashierName}`, margin, y);
    y += 5;

    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFontSize(7);
    for (const item of data.items) {
      doc.text(`${item.name} x${item.quantity}`, margin, y);
      doc.text(`GHS ${item.price.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
      y += 4;
    }

    y += 2;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.text(`Subtotal:`, margin, y);
    doc.text(`GHS ${data.subtotal.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 4;

    if (data.discount > 0) {
      doc.text(`Discount:`, margin, y);
      doc.text(`-GHS ${data.discount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
      y += 4;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`TOTAL:`, margin, y);
    doc.text(`GHS ${data.total.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 6;

    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Payment: ${data.paymentMethod.toUpperCase()}`, pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text('Thank you for your purchase!', pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.text('See you again!', pageWidth / 2, y, { align: 'center' });

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
