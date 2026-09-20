import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MoneyConfig {
  /** ISO 4217 code of the shop's currency. */
  currency: string;
  /** BCP 47 locale for number formatting; undefined uses the viewer's own locale. */
  locale?: string;
}

let moneyConfig: MoneyConfig = { currency: "USD" };
const formatters = new Map<string, Intl.NumberFormat>();

/** Set once the shop is known so every screen formats amounts in the shop's currency. */
export function configureMoney(config: Partial<MoneyConfig>): void {
  moneyConfig = { ...moneyConfig, ...config };
}

export function getMoneyConfig(): Readonly<MoneyConfig> {
  return moneyConfig;
}

function moneyFormatter(currency: string, locale?: string) {
  const key = `${locale ?? ""}|${currency}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    // Each currency uses its own number of decimals (2 for most, 0 for yen or CFA francs).
    formatter = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" });
    formatters.set(key, formatter);
  }
  return formatter;
}

export function formatCurrency(
  amount: number,
  currency: string = moneyConfig.currency,
  locale: string | undefined = moneyConfig.locale,
): string {
  return moneyFormatter(currency, locale).format(amount);
}

/** "GH₵", "$", "€": the short symbol for a currency, for prefixes on inputs. */
export function currencySymbol(currency: string = moneyConfig.currency, locale: string | undefined = moneyConfig.locale): string {
  return moneyFormatter(currency, locale).formatToParts(0).find((part) => part.type === "currency")?.value ?? currency;
}

/** Decimal places the currency uses (0 for yen, 2 for most). */
export function currencyDecimals(currency: string = moneyConfig.currency): number {
  return moneyFormatter(currency, undefined).resolvedOptions().maximumFractionDigits ?? 2;
}

/** 1,284 -> "1.3K"; used for chart axes where full currency would not fit. */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "Ama Mensah" -> "AM"; single names give one letter. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function generateId(): string {
  return crypto.randomUUID();
}
