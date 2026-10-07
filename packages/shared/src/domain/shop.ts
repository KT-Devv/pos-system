import { isSupportedCurrency } from "./currencies.js";

export type ShopRole = "owner" | "admin" | "cashier";

export const SHOP_ROLES: readonly ShopRole[] = ["owner", "admin", "cashier"];

export const ROLE_LABELS: Record<ShopRole, string> = {
  owner: "Owner",
  admin: "Admin",
  cashier: "Cashier",
};

export const ROLE_DESCRIPTIONS: Record<ShopRole, string> = {
  owner: "Full control of the shop, its team and settings.",
  admin: "Manages products, stock, customers and settings.",
  cashier: "Rings up sales and records stock. Cannot change the catalog.",
};

/** What a shop needs to be created or edited. Mirrors the columns on `shops`. */
export interface ShopInput {
  name: string;
  currency: string;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  lowStockThreshold: number;
  loyaltyEnabled: boolean;
  /** Currency units a customer spends to earn one loyalty point. */
  loyaltySpendPerPoint: number;
}

export const SHOP_NAME_MIN = 2;
export const SHOP_NAME_MAX = 80;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Mirrors the database constraints so people get a clear message before a round trip. */
export function validateShopInput(input: ShopInput): string[] {
  const errors: string[] = [];
  const name = input.name.trim();

  if (name.length < SHOP_NAME_MIN) errors.push(`Shop name must be at least ${SHOP_NAME_MIN} characters`);
  if (name.length > SHOP_NAME_MAX) errors.push(`Shop name must be at most ${SHOP_NAME_MAX} characters`);
  if (!isSupportedCurrency(input.currency)) errors.push("Choose a currency from the list");
  if (input.email && input.email.trim() && !EMAIL.test(input.email.trim())) {
    errors.push("Enter a valid shop email address");
  }
  if (!Number.isInteger(input.lowStockThreshold) || input.lowStockThreshold < 0) {
    errors.push("Low-stock level must be a whole number that is zero or greater");
  }
  if (input.loyaltyEnabled && (!Number.isFinite(input.loyaltySpendPerPoint) || input.loyaltySpendPerPoint <= 0)) {
    errors.push("Loyalty spend per point must be greater than zero");
  }
  return errors;
}

/** Owners and admins manage the catalog, stock rules, shop settings and (owner) the team. */
export function canManageShop(role: ShopRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function canManageTeam(role: ShopRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** Which roles the acting role may hand out when inviting. */
export function invitableRoles(actor: ShopRole | null | undefined): ShopRole[] {
  if (actor === "owner") return ["admin", "cashier"];
  if (actor === "admin") return ["cashier"];
  return [];
}

/** An invitation code is this many letters and digits (the database makes them; see create_invite). */
export const INVITE_CODE_LENGTH = 10;
/** How long a code works for. The database sets the real expiry; this is only for wording. */
export const INVITE_CODE_HOURS = 24;

/** A code as the database wants it: letters and digits only, upper case, whatever was typed or pasted. */
export function normalizeInviteCode(text: string): string {
  return text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** "7KQ4MX9HTP" -> "7KQ4M-X9HTP": easier to read out, and to type. */
export function formatInviteCode(text: string): string {
  const code = normalizeInviteCode(text);
  return code.length > 5 ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}

export function looksLikeInviteCode(text: string): boolean {
  return normalizeInviteCode(text).length === INVITE_CODE_LENGTH;
}

/**
 * The message an owner or admin sends along with a new invitation code. With the shop's web address it carries a
 * sign-up link that fills the code in; either way the code is there to type.
 */
export function invitationMessage(input: { shopName: string; role: ShopRole; code: string; siteUrl?: string | null }): string {
  const role = ROLE_LABELS[input.role].toLowerCase();
  const article = /^[aeiou]/.test(role) ? "an" : "a";
  const code = formatInviteCode(input.code);
  const how = input.siteUrl
    ? `Sign up here: ${input.siteUrl}/login?tab=signup&code=${normalizeInviteCode(input.code)}\nYour invitation code (already filled in if you use that link): ${code}`
    : `Sign up on KT POS System and type this invitation code when it asks for one: ${code}`;
  return `You've been invited to join ${input.shopName} on KT POS System as ${article} ${role}.\n${how}\nThe code works once and expires in ${INVITE_CODE_HOURS} hours.`;
}

/** Whether `actor` may remove a member holding `target`. Nobody removes the owner. */
export function canRemoveMember(actor: ShopRole | null | undefined, target: ShopRole): boolean {
  if (target === "owner") return false;
  if (actor === "owner") return true;
  return actor === "admin" && target === "cashier";
}

/** Loyalty points earned by a sale total (whole points, rounded down). */
export function loyaltyPointsFor(
  total: number,
  settings: { loyaltyEnabled: boolean; loyaltySpendPerPoint: number },
): number {
  if (!settings.loyaltyEnabled || !(settings.loyaltySpendPerPoint > 0) || !(total > 0)) return 0;
  return Math.floor(total / settings.loyaltySpendPerPoint);
}

/** Stock at or below zero is "out"; below the shop's threshold is "low". */
export function stockLevel(stock: number, lowStockThreshold: number): "out" | "low" | "ok" {
  if (stock <= 0) return "out";
  return stock < lowStockThreshold ? "low" : "ok";
}
