import * as React from "react";
import { cn } from "../lib/utils";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** Supporting line under the value, e.g. a comparison or unit. */
  hint?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "destructive";
  /** The single number a view leads with: rendered much larger. */
  hero?: boolean;
}

const chip = {
  default: "bg-accent text-accent-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  destructive: "bg-destructive-soft text-destructive",
};

export function StatCard({ label, value, icon: Icon, hint, tone = "default", hero, className, ...props }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card p-5 shadow-xs", className)} {...props}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", chip[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p
        className={cn(
          "mt-2 font-extrabold tracking-tight",
          hero ? "text-4xl sm:text-5xl" : "text-[28px] leading-9",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
