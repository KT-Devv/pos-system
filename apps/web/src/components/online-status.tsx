"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@pos/shared";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Live navigator.onLine; assumes online during server render. */
export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

export function OnlineStatus({ className }: { className?: string }) {
  const online = useOnline();
  return (
    <span
      role="status"
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold",
        online ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", online ? "bg-success" : "bg-warning")} />
      <span className="hidden sm:inline">{online ? "Online" : "Offline"}</span>
      <span className="sr-only sm:hidden">{online ? "Online" : "Offline"}</span>
    </span>
  );
}
