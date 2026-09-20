"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@pos/shared";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Customers } from "@/features/customers";
import { Inventory } from "@/features/inventory";
import { Products } from "@/features/products";
import { Reports } from "@/features/reports";
import { Sales } from "@/features/sales";
import type { Section } from "@/features/sections";
import { Settings } from "@/features/settings";
import { syncDesktopSales } from "@/lib/desktop";
import { useWorkspace, WorkspaceGate } from "@/lib/workspace";

function Toast({ tone, children, onDismiss }: { tone: "success" | "error"; children: React.ReactNode; onDismiss: () => void }) {
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border bg-card p-3.5 shadow-lg",
        tone === "success" ? "border-success/40" : "border-destructive/40",
      )}
    >
      <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full", tone === "success" ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive")}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="flex-1 pt-0.5 text-sm font-medium">{children}</p>
      <button type="button" aria-label="Dismiss" onClick={onDismiss} className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function SectionContent({ section }: { section: Section }) {
  const { supabase, user, shop, role, isAdmin, signOut } = useWorkspace();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reportError = useCallback((message: string) => {
    setNotice("");
    setError(message);
  }, []);
  const reportNotice = useCallback((message: string) => {
    setError("");
    setNotice(message);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

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
          p_lines: sale.lines.map(line => ({ product_id: line.productId, quantity: line.quantity })),
        });
        if (error) throw error;
      })
        .then(count => { if (count > 0) reportNotice(`Synced ${count} offline ${count === 1 ? "sale" : "sales"}.`); })
        .catch(error => reportError(error instanceof Error ? error.message : "Offline synchronization failed"));
    };
    sync();
    // Also sync the moment the connection comes back, not only when a screen loads.
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [supabase, shop.id, reportError, reportNotice]);

  return (
    <AppShell section={section} user={{ id: user.id, name: user.name, role }} shopName={shop.name} onSignOut={() => void signOut()}>
      {(notice || error) && (
        <div className="pointer-events-none fixed inset-x-4 top-16 z-[100] grid justify-items-end gap-2 md:top-[4.5rem]">
          {notice && <Toast tone="success" onDismiss={() => setNotice("")}>{notice}</Toast>}
          {error && <Toast tone="error" onDismiss={() => setError("")}>{error}</Toast>}
        </div>
      )}

      {section === "sales" && <Sales supabase={supabase} userId={user.id} onError={reportError} onNotice={reportNotice} />}
      {section === "products" && <Products supabase={supabase} isAdmin={isAdmin} onError={reportError} onNotice={reportNotice} />}
      {section === "inventory" && <Inventory supabase={supabase} onError={reportError} onNotice={reportNotice} />}
      {section === "customers" && <Customers supabase={supabase} onError={reportError} onNotice={reportNotice} />}
      {section === "reports" && <Reports supabase={supabase} onError={reportError} />}
      {section === "settings" && <Settings onError={reportError} onNotice={reportNotice} />}
    </AppShell>
  );
}

export default function SectionClient({ section }: { section: Section }) {
  return (
    <WorkspaceGate>
      <SectionContent section={section} />
    </WorkspaceGate>
  );
}
