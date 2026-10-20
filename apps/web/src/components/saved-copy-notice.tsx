"use client";

import { WifiOff } from "lucide-react";
import { useWorkOffline } from "@/lib/connection";
import { isTauri } from "@/lib/desktop";
import { useOutboxCount } from "@/lib/outbox";
import { useWorkspace } from "@/lib/workspace";

/**
 * Tells the person the desktop app is working from its saved copy of the shop, since what they see may be behind what
 * other computers have done, and how many of their own changes are waiting to be sent. Shows nothing otherwise.
 */
export function SavedCopyNotice({ savedAt }: { savedAt: number | null }) {
  const { shop } = useWorkspace();
  const offline = useWorkOffline();
  const waiting = useOutboxCount(shop.id);
  if (!isTauri() || (!offline && savedAt === null && waiting === 0)) return null;
  const when = savedAt !== null ? new Date(savedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft p-3.5 text-sm text-warning">
      <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="font-medium">
        {offline || savedAt !== null
          ? `Working offline. Changes you make are saved on this computer and sent when the connection returns.${when ? ` What you see is as it was on ${when}, plus your own changes.` : ""}`
          : "Connected again."}
        {waiting > 0 && ` ${waiting} ${waiting === 1 ? "change is" : "changes are"} waiting to be sent.`}
      </p>
    </div>
  );
}
