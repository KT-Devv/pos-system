import * as React from "react";
import { cn } from "../lib/utils";

export interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Pixel size of the square mark. */
  size?: number;
  /** Show the "KT POS System" wordmark beside the mark. */
  wordmark?: boolean;
  /** `onDark` for the dark sidebar and brand panels. */
  tone?: "brand" | "onDark";
}

/** The KT POS System mark: a till receipt with a torn edge, on a rounded tile. */
export function Logo({ size = 36, wordmark = false, tone = "brand", className, ...props }: LogoProps) {
  const onDark = tone === "onDark";
  return (
    <div className={cn("flex items-center gap-2.5", className)} {...props}>
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-[28%]",
          onDark ? "bg-[#3fc08d] text-[#052418]" : "bg-primary text-primary-foreground",
        )}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 32 32" width={size * 0.62} height={size * 0.62} fill="none">
          <path
            d="M8 5.5h16a1 1 0 0 1 1 1v20.2a.6.6 0 0 1-.97.47L21.5 25.2l-2.53 1.97a.6.6 0 0 1-.74 0L15.7 25.2l-2.53 1.97a.6.6 0 0 1-.74 0L9.9 25.2l-1.93 1.97A.6.6 0 0 1 7 26.7V6.5a1 1 0 0 1 1-1Z"
            fill="currentColor"
          />
          <path
            d="M11.5 11.5h9M11.5 15.5h9M11.5 19.5h5"
            stroke={onDark ? "#3fc08d" : "var(--primary)"}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {wordmark && (
        <span className={cn("text-[17px] font-extrabold leading-none tracking-tight", onDark && "text-white")}>
          KT <span className={cn("font-semibold", onDark ? "text-[#3fc08d]" : "text-primary")}>POS System</span>
        </span>
      )}
    </div>
  );
}
