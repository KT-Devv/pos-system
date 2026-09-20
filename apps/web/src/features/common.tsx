"use client";

import type { ReactNode } from "react";
import {
  Badge,
  cn,
  currencyDecimals,
  currencySymbol,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  stockLevel,
} from "@pos/shared";
import { Banknote, CreditCard, Search, Smartphone, type LucideIcon } from "lucide-react";
import type { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export { fetchAll } from "@/lib/paging";

export type Client = ReturnType<typeof createSupabaseBrowserClient>;
export type Feedback = { onError: (message: string) => void; onNotice: (message: string) => void };
export type Option = { value: string; label: string };

export type Category = { id: string; name: string };
export type Product = {
  id: string;
  name: string;
  category_id: string | null;
  cost_price: number;
  selling_price: number;
  stock: number;
  barcode: string | null;
  categories?: { name: string } | null;
};
export type Supplier = { id: string; name: string; phone: string | null; email: string | null; address: string | null };
export type Customer = { id: string; name: string; phone: string | null; email: string | null; loyalty_points: number };
export type PaymentMethodValue = "cash" | "momo" | "card";

/** Turns database errors into something a shop owner can act on. */
export function friendlyError(message: string): string {
  if (/products_shop_barcode_key|products_barcode_key/.test(message)) return "Another product already uses that barcode.";
  if (/categories_shop_id_name_key|categories_name_key/.test(message)) return "You already have a category with that name.";
  if (/sale_lines.*foreign key|foreign key.*sale_lines/i.test(message)) return "This product appears in past sales, so it can't be deleted.";
  if (/row-level security/i.test(message)) return "You don't have permission to do that.";
  if (/currency cannot be changed/i.test(message)) return "The currency can't be changed after sales have been recorded.";
  return message;
}

export const fail = (onError: (message: string) => void, value: unknown) =>
  onError(friendlyError(value instanceof Error ? value.message : typeof value === "object" && value !== null && "message" in value ? String((value as { message: unknown }).message) : String(value)));

export const PAYMENT_METHODS: Record<PaymentMethodValue, { label: string; short: string; icon: LucideIcon }> = {
  cash: { label: "Cash", short: "Cash", icon: Banknote },
  momo: { label: "Mobile money", short: "MoMo", icon: Smartphone },
  card: { label: "Card", short: "Card", icon: CreditCard },
};

export function paymentLabel(method: string) {
  return PAYMENT_METHODS[method as PaymentMethodValue]?.label ?? method;
}

export function StockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  const level = stockLevel(stock, threshold);
  if (level === "out") return <Badge variant="destructive">Out of stock</Badge>;
  if (level === "low") return <Badge variant="warning">Low · {stock}</Badge>;
  return <Badge variant="success">{stock} in stock</Badge>;
}

/** Radix Select can't hold an empty-string value, so "" is mapped to a sentinel. */
export function MenuSelect({
  id,
  placeholder,
  value,
  options,
  onValueChange,
  className,
}: {
  id?: string;
  placeholder?: string;
  value: string;
  options: Option[];
  onValueChange: (value: string) => void;
  className?: string;
}) {
  // "" only maps to the sentinel when there is an explicit empty option; otherwise leave it
  // empty so Radix shows the placeholder.
  const hasEmptyOption = options.some((option) => option.value === "");
  const selectValue = value === "" ? (hasEmptyOption ? "__none__" : "") : value;
  return (
    <Select value={selectValue} onValueChange={(val) => onValueChange(val === "__none__" ? "" : val)}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={6}>
        {options.map((option) => {
          const itemVal = option.value === "" ? "__none__" : option.value;
          return (
            <SelectItem key={itemVal} value={itemVal}>
              {option.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/** Label + control + optional hint, stacked. */
export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
  inputClassName,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
  inputClassName?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "placeholder" | "className">) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        className={cn("pl-9", inputClassName)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...rest}
      />
    </div>
  );
}

/** Currency-prefixed number input used for prices and discounts. */
export function MoneyInput({
  id,
  value,
  onChange,
  required,
  min = "0",
  className,
  ...rest
}: {
  id?: string;
  value: string | number;
  onChange: (value: string) => void;
  required?: boolean;
  min?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className" | "id" | "min" | "required">) {
  const symbol = currencySymbol();
  const decimals = currencyDecimals();
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
        {symbol}
      </span>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        step={decimals === 0 ? "1" : "0.01"}
        required={required}
        style={{ paddingLeft: `${1.1 + symbol.length * 0.6}rem` }}
        className="tabular-nums"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...rest}
      />
    </div>
  );
}
