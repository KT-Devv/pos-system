"use client";

import { useEffect } from "react";
import { isServerDown, setServerDown, workOffline } from "@/lib/connection";
import { after, isTauri, isUnreachable, syncDesktopSales } from "@/lib/desktop";
import { type FlushReport, flushOutbox, pendingChanges } from "@/lib/outbox";
import { refreshReplica, REPLICA_TABLES } from "@/lib/replica";
import { useRealtimeRefresh } from "@/lib/use-realtime";
import { useWorkspace } from "@/lib/workspace";

/**
 * Everything the desktop app does to keep working offline, run from whichever screen is open:
 *  - sends the sales and changes made offline, in the order they were made, when a screen opens and when the connection
 *    returns (then fires `kt:sales-synced` so screens reload);
 *  - notices when the server answers again after it stopped (a connection that is up but has no internet);
 *  - keeps the saved copy of the shop's data (`lib/replica.ts`) up to date while online.
 */
export function useOfflineSync(onNotice: (message: string) => void, onError: (message: string) => void) {
  const { supabase, shop } = useWorkspace();

  useEffect(() => {
    if (!isTauri()) return;
    const sync = () => {
      if (!navigator.onLine) return;
      const report: FlushReport = { sent: 0, rejected: [] };
      syncDesktopSales(
        shop.id,
        async sale => {
          const { error } = await supabase.rpc("create_sale", {
            p_shop_id: sale.shopId,
            p_cashier_id: sale.cashierId,
            p_customer_id: sale.customerId,
            p_payment_method: sale.paymentMethod,
            p_discount: sale.discount,
            p_lines: sale.lines.map(line => ({ product_id: line.productId, quantity: line.quantity, unit_id: line.unitId, price_tier: line.priceTier })),
          });
          if (error) throw error;
        },
        undefined,
        until => flushOutbox(supabase, shop.id, report, until),
      )
        .then(count => {
          if (count > 0 || report.sent > 0) {
            const parts = [
              count > 0 ? `${count} offline ${count === 1 ? "sale" : "sales"}` : "",
              report.sent > 0 ? `${report.sent} offline ${report.sent === 1 ? "change" : "changes"}` : "",
            ].filter(Boolean);
            onNotice(`Sent ${parts.join(" and ")}.`);
            window.dispatchEvent(new Event("kt:sales-synced"));
          }
          if (report.rejected.length > 0) {
            onError(`${report.rejected.length} offline ${report.rejected.length === 1 ? "change was" : "changes were"} refused by the server and not saved: ${report.rejected[0]}`);
            window.dispatchEvent(new Event("kt:sales-synced"));
          }
        })
        .catch(error => {
          onError(error instanceof Error ? error.message : "Offline synchronization failed");
          // Whatever was sent before the failure is on the server: screens should show it.
          window.dispatchEvent(new Event("kt:sales-synced"));
        });
    };

    // While the server is not answering, ask it every few seconds; the moment it does, send what is waiting.
    const watch = async () => {
      if (!navigator.onLine) return;
      if (isServerDown()) {
        const answered = await Promise.race([
          Promise.resolve(supabase.from("shops").select("id").limit(1)).then(result => !result.error || !isUnreachable(result.error)).catch(() => false),
          after(4000),
        ]);
        if (answered === true) setServerDown(false);
      } else if (pendingChanges(shop.id) > 0) {
        sync();
      }
    };

    sync();
    window.addEventListener("online", sync);
    window.addEventListener("kt:server-back", sync);
    const timer = window.setInterval(() => { void watch(); }, 10000);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("kt:server-back", sync);
      window.clearInterval(timer);
    };
  }, [supabase, shop.id, onNotice, onError]);

  // The saved copy: read in full a moment after the screen opens, and again after anything changes, but only while online
  // and with nothing waiting to be sent (the copy then holds those edits, which a fresh read would lose).
  const refresh = () => {
    if (!isTauri() || workOffline() || pendingChanges(shop.id) > 0) return;
    void refreshReplica(supabase, shop.id, () => pendingChanges(shop.id) === 0).catch(() => false);
  };
  useEffect(() => {
    if (!isTauri()) return;
    let timer: number | undefined;
    const later = (ms: number) => () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, ms);
    };
    const soon = later(1500);
    const afterChange = later(3000);
    soon();
    window.addEventListener("kt:sales-synced", afterChange);
    window.addEventListener("kt:server-back", afterChange);
    window.addEventListener("online", afterChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("kt:sales-synced", afterChange);
      window.removeEventListener("kt:server-back", afterChange);
      window.removeEventListener("online", afterChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, shop.id]);
  useRealtimeRefresh(REPLICA_TABLES, refresh);
}
