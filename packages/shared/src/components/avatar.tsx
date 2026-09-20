import * as React from "react";
import { cn, initials } from "../lib/utils";

const tints = [
  "bg-accent text-accent-foreground",
  "bg-info-soft text-info",
  "bg-warning-soft text-warning",
  "bg-success-soft text-success",
  "bg-secondary text-secondary-foreground",
];

function tintFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return tints[hash % tints.length];
}

const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg" };

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  size?: keyof typeof sizes;
}

/** Initials avatar with a stable tint per name. */
export function Avatar({ name, size = "md", className, ...props }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-bold",
        sizes[size],
        tintFor(name),
        className,
      )}
      {...props}
    >
      {initials(name)}
    </span>
  );
}
