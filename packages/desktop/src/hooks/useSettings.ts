import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/ipc';

export interface ShopSettings {
  shopName: string;
  phone: string;
  address: string;
  currency: string;
  lowStockThreshold: number;
  cashEnabled: boolean;
  momoEnabled: boolean;
  cardEnabled: boolean;
  momoNumber: string;
  lowStockAlerts: boolean;
  dailySalesSummary: boolean;
  smsReceipts: boolean;
  receiptHeader: string;
  receiptFooter: string;
  receiptNote: string;
  printerType: string;
  printerPaperSize: string;
}

const defaults: ShopSettings = {
  shopName: "Mom's Shop",
  phone: '',
  address: '',
  currency: 'GHS',
  lowStockThreshold: 10,
  cashEnabled: true,
  momoEnabled: true,
  cardEnabled: false,
  momoNumber: '',
  lowStockAlerts: true,
  dailySalesSummary: true,
  smsReceipts: false,
  receiptHeader: "Mom's Shop",
  receiptFooter: 'Thank you for your purchase!',
  receiptNote: '',
  printerType: 'none',
  printerPaperSize: '80',
};

function mapKeyToSetting(key: string): keyof ShopSettings | null {
  const map: Record<string, keyof ShopSettings> = {
    shop_name: 'shopName',
    shop_phone: 'phone',
    shop_address: 'address',
    currency: 'currency',
    low_stock_threshold: 'lowStockThreshold',
    cash_enabled: 'cashEnabled',
    momo_enabled: 'momoEnabled',
    card_enabled: 'cardEnabled',
    momo_number: 'momoNumber',
    low_stock_alerts: 'lowStockAlerts',
    daily_sales_summary: 'dailySalesSummary',
    sms_receipts: 'smsReceipts',
    receipt_header: 'receiptHeader',
    receipt_footer: 'receiptFooter',
    receipt_note: 'receiptNote',
    printer_type: 'printerType',
    printer_paper_size: 'printerPaperSize',
  };
  return map[key] ?? null;
}

function parseValue(value: string | null, type: 'boolean' | 'number' | 'string'): unknown {
  if (value === null) return undefined;
  if (type === 'boolean') return value === 'true';
  if (type === 'number') return Number(value);
  return value;
}

function serializeValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function typeForKey(key: keyof ShopSettings): 'boolean' | 'number' | 'string' {
  if (typeof defaults[key] === 'boolean') return 'boolean';
  if (typeof defaults[key] === 'number') return 'number';
  return 'string';
}

export function useSettings() {
  const [settings, setSettings] = useState<ShopSettings>({ ...defaults });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await api.settings.get() as Record<string, string> | null;
        if (cancelled || !raw) return;
        const merged = { ...defaults };
        for (const [dbKey, val] of Object.entries(raw)) {
          const settingKey = mapKeyToSetting(dbKey);
          if (settingKey) {
            const parsed = parseValue(val as string, typeForKey(settingKey));
            if (parsed !== undefined) (merged as Record<string, unknown>)[settingKey] = parsed;
          }
        }
        setSettings(merged);
      } catch {
        // keep defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const update = useCallback(async <K extends keyof ShopSettings>(key: K, value: ShopSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    const dbKeyMap: Record<string, string> = {
      shopName: 'shop_name', phone: 'shop_phone', address: 'shop_address',
      currency: 'currency', lowStockThreshold: 'low_stock_threshold',
      cashEnabled: 'cash_enabled', momoEnabled: 'momo_enabled', cardEnabled: 'card_enabled',
      momoNumber: 'momo_number', lowStockAlerts: 'low_stock_alerts',
      dailySalesSummary: 'daily_sales_summary', smsReceipts: 'sms_receipts',
      receiptHeader: 'receipt_header', receiptFooter: 'receipt_footer',
      receiptNote: 'receipt_note', printerType: 'printer_type',
      printerPaperSize: 'printer_paper_size',
    };
    const dbKey = dbKeyMap[key as string] || key as string;
    await api.settings.set(dbKey, serializeValue(value));
  }, []);

  const reset = useCallback(async () => {
    setSettings({ ...defaults });
    for (const [dbKey, val] of Object.entries({
      shop_name: defaults.shopName, shop_phone: defaults.phone, shop_address: defaults.address,
      currency: defaults.currency, low_stock_threshold: String(defaults.lowStockThreshold),
      cash_enabled: 'true', momo_enabled: 'true', card_enabled: 'false',
      momo_number: defaults.momoNumber, low_stock_alerts: 'true',
      daily_sales_summary: 'true', sms_receipts: 'false',
      receipt_header: defaults.receiptHeader, receipt_footer: defaults.receiptFooter,
      receipt_note: defaults.receiptNote, printer_type: defaults.printerType,
      printer_paper_size: defaults.printerPaperSize,
    })) {
      await api.settings.set(dbKey, val);
    }
  }, []);

  return { settings, update, reset, loading };
}
