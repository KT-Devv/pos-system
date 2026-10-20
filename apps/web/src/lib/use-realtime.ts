"use client";

import { useEffect, useRef } from "react";
import { useWorkspace } from "@/lib/workspace";

/**
 * Calls `reload` whenever another computer (or another browser tab) changes one of `tables` in this shop, so a product
 * added on one PC shows up on the till without refreshing the page or abandoning the sale. Changes arrive over Supabase
 * Realtime (migration 012 puts the tables in its publication); several changes at once cause one reload.
 *
 * It also reloads when the window comes back into view and when the live connection is re-established, which covers
 * anything missed while the computer slept or was offline.
 */
export function useRealtimeRefresh(tables: readonly string[], reload: () => void) {
  const { supabase, shop } = useWorkspace();
  const latest = useRef(reload);
  useEffect(() => { latest.current = reload; });
  const key = tables.join(",");

  useEffect(() => {
    let timer: number | undefined;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { if (navigator.onLine) latest.current(); }, 400);
    };

    const channel = supabase.channel(`live:${shop.id}:${key}`);
    for (const table of key.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `shop_id=eq.${shop.id}` }, schedule);
      // A delete cannot be filtered by shop; it carries no private data and only makes this screen look again.
      channel.on("postgres_changes", { event: "DELETE", schema: "public", table }, schedule);
    }
    let connectedBefore = false;
    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      if (connectedBefore) schedule();
      connectedBefore = true;
    });

    const wake = () => { if (document.visibilityState === "visible") schedule(); };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      void supabase.removeChannel(channel);
    };
  }, [supabase, shop.id, key]);
}
