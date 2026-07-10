import { useState, useCallback } from "react";

export interface ShopSettings {
  shopName: string;
  phone: string;
  address: string;
  fullName: string;
  email: string;
  cashEnabled: boolean;
  momoEnabled: boolean;
  cardEnabled: boolean;
  momoNumber: string;
  lowStockAlerts: boolean;
  dailySalesSummary: boolean;
  smsReceipts: boolean;
  lowStockThreshold: number;
  receiptHeader: string;
  receiptFooter: string;
  receiptNote: string;
}

const STORAGE_KEY = "pos-shop-settings";

const defaults: ShopSettings = {
  shopName: "Mom's Shop",
  phone: "+233 24 123 4567",
  address: "Accra, Ghana",
  fullName: "Admin User",
  email: "admin@shop.com",
  cashEnabled: true,
  momoEnabled: true,
  cardEnabled: false,
  momoNumber: "+233 24 123 4567",
  lowStockAlerts: true,
  dailySalesSummary: true,
  smsReceipts: false,
  lowStockThreshold: 10,
  receiptHeader: "Mom's Shop",
  receiptFooter: "Thank you for your purchase!",
  receiptNote: "Exchange within 7 days with receipt",
};

function loadSettings(): ShopSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch {}
  return { ...defaults };
}

function saveSettings(settings: ShopSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export function useSettings() {
  const [settings, setSettings] = useState<ShopSettings>(loadSettings);

  const update = useCallback(<K extends keyof ShopSettings>(key: K, value: ShopSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSettings({ ...defaults });
    saveSettings(defaults);
  }, []);

  return { settings, update, reset };
}
