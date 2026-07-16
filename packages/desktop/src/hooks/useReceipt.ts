import { api } from '../lib/ipc';

export interface ReceiptData {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  cashierName: string;
  date: string;
  saleId: string;
  receiptHeader?: string;
  receiptFooter?: string;
  receiptNote?: string;
  currency?: string;
}

export async function printReceipt(data: ReceiptData): Promise<boolean> {
  try {
    const result = await api.receipt.print(data) as { success: boolean };
    return result?.success ?? false;
  } catch {
    return false;
  }
}

export async function testPrinter(): Promise<boolean> {
  try {
    const result = await api.receipt.testPrint() as { success: boolean };
    return result?.success ?? false;
  } catch {
    return false;
  }
}
