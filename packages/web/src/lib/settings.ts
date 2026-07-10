import type { ShopSettings } from "../hooks/useSettings";

const STORAGE_KEY = "pos-shop-settings";

const defaults: Pick<ShopSettings, "shopName" | "lowStockThreshold" | "cashEnabled" | "momoEnabled" | "cardEnabled" | "receiptHeader" | "receiptFooter" | "receiptNote"> = {
  shopName: "Mom's Shop",
  lowStockThreshold: 10,
  cashEnabled: true,
  momoEnabled: true,
  cardEnabled: false,
  receiptHeader: "Mom's Shop",
  receiptFooter: "Thank you for your purchase!",
  receiptNote: "See you again soon!",
};

export function loadShopSettings(): typeof defaults {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch {
    // ignore
  }
  return defaults;
}

export function getLowStockThreshold(): number {
  return loadShopSettings().lowStockThreshold;
}
