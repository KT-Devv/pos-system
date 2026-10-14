"use client";

import { useEffect } from "react";
import { syncDesktopSales } from "@/lib/desktop";
import { useWorkspace } from "@/lib/workspace";

/**
 * Sends the sales the desktop app saved while offline, when a screen opens and the moment the connection returns.
 * Screens showing stock listen for `kt:sales-synced` to reload once the server has the sales.
 */
export function useOfflineSync(onNotice: (message: string) => void, onError: (message: string) => void) {
  const { supabase, shop } = useWorkspace();
  useEffect(() => {
    const sync = () => {
      if (!navigator.onLine) return;
      syncDesktopSales(shop.id, async sale => {
        const { error } = await supabase.rpc("create_sale", {
          p_shop_id: sale.shopId,
          p_cashier_id: sale.cashierId,
          p_customer_id: sale.customerId,
          p_payment_method: sale.paymentMethod,
          p_discount: sale.discount,
          p_lines: sale.lines.map(line => ({ product_id: line.productId, quantity: line.quantity, unit_id: line.unitId, price_tier: line.priceTier })),
        });
        if (error) throw error;
      })
        .then(count => {
          if (count > 0) {
            onNotice(`Sent ${count} offline ${count === 1 ? "sale" : "sales"}.`);
            window.dispatchEvent(new Event("kt:sales-synced"));
          }
        })
        .catch(error => {
          onError(error instanceof Error ? error.message : "Offline synchronization failed");
          // Sales sent before the failure are on the server: screens should show their effect.
          window.dispatchEvent(new Event("kt:sales-synced"));
        });
    };
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [supabase, shop.id, onNotice, onError]);
}
