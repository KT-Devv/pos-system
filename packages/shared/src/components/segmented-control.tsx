import * as React from "react";
import { cn } from "../lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  size?: "md" | "lg";
  fullWidth?: boolean;
  className?: string;
  "aria-label": string;
}

/** Single-choice toggle group (radiogroup semantics, arrow-key navigation). */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  size = "md",
  fullWidth = false,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, step: 1 | -1) => {
    for (let i = 1; i <= options.length; i += 1) {
      const next = (from + step * i + options.length * i) % options.length;
      if (!options[next].disabled) {
        onValueChange(options[next].value);
        refs.current[next]?.focus();
        return;
      }
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex gap-1 rounded-lg bg-muted p-1", fullWidth && "flex w-full", className)}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                move(index, 1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                move(index, -1);
              }
            }}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 font-semibold disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
              size === "md" ? "h-8 text-sm max-md:h-10 max-md:min-w-0 max-md:px-1.5 max-md:text-[13px]" : "h-11 text-sm",
              fullWidth && "flex-1",
              checked
                ? "bg-raised text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
