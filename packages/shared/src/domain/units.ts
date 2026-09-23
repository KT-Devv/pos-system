/**
 * Pack sizes. A product is priced per single item and its stock is counted in single items. A pack size
 * sells a fixed number of those items at its own price ("Pack of 12", "Box of 24"), and selling one
 * takes that many items out of stock.
 */

export interface PackSize {
  id: string;
  name: string;
  /** Single items in one pack. Always 2 or more. */
  quantity: number;
  sellingPrice: number;
  barcode: string | null;
}

export interface PackSizeInput {
  name: string;
  quantity: number;
  sellingPrice: number;
}

export const PACK_NAME_MAX = 40;

/** "Pack" of 12 reads "Pack of 12". A name that already carries a number ("5 kg bag") is left as it is. */
export function packLabel(name: string, quantity: number): string {
  const trimmed = name.trim();
  return /\d/.test(trimmed) ? trimmed : `${trimmed} of ${quantity}`;
}

/** Mirrors the database rules so people get a clear message before a round trip. */
export function validatePackSize(
  input: PackSizeInput,
  others: readonly Pick<PackSizeInput, "name" | "quantity">[] = [],
): string[] {
  const errors: string[] = [];
  const name = input.name.trim();
  if (!name) errors.push("Give each pack size a name, such as Pack or Box");
  if (name.length > PACK_NAME_MAX) errors.push(`Pack size names can be at most ${PACK_NAME_MAX} characters`);
  if (!Number.isInteger(input.quantity) || input.quantity < 2) {
    errors.push(`${name || "A pack size"} must hold a whole number of items, 2 or more`);
  }
  if (!Number.isFinite(input.sellingPrice) || input.sellingPrice <= 0) {
    errors.push(`${name || "A pack size"} needs a price above zero`);
  }
  if (name && others.some((other) => other.name.trim().toLowerCase() === name.toLowerCase())) {
    errors.push(`Two pack sizes are called ${name}`);
  }
  if (Number.isInteger(input.quantity) && others.some((other) => other.quantity === input.quantity)) {
    errors.push(`Two pack sizes hold ${input.quantity} items`);
  }
  return errors;
}

/** Single items a set of sale lines takes out of stock. `unitQuantity` is 1 (or absent) for singles. */
export function itemsNeeded(lines: readonly { quantity: number; unitQuantity?: number | null }[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * (line.unitQuantity ?? 1), 0);
}

/**
 * How many of a pack (or singles, with unitQuantity 1) can still be added, given the stock and the
 * single items other lines in the cart already claim.
 */
export function unitsAvailable(stock: number, claimedByOthers: number, unitQuantity: number): number {
  return Math.max(0, Math.floor((stock - claimedByOthers) / Math.max(1, unitQuantity)));
}

export interface StockBreakdown {
  packs: { name: string; quantity: number; count: number; label: string }[];
  singles: number;
}

/** Stock split into whole packs, biggest first, and the singles left over. */
export function stockBreakdown(stock: number, packs: readonly Pick<PackSize, "name" | "quantity">[]): StockBreakdown {
  let left = Math.max(0, Math.floor(stock));
  const parts: StockBreakdown["packs"] = [];
  for (const pack of [...packs].sort((a, b) => b.quantity - a.quantity)) {
    const count = Math.floor(left / pack.quantity);
    if (count > 0) {
      parts.push({ name: pack.name, quantity: pack.quantity, count, label: packLabel(pack.name, pack.quantity) });
      left -= count * pack.quantity;
    }
  }
  return { packs: parts, singles: left };
}

/**
 * "2 × Box of 24 + 2 singles", or null when the stock is smaller than every pack (so there is nothing
 * to add to the plain number).
 */
export function describeStock(stock: number, packs: readonly Pick<PackSize, "name" | "quantity">[]): string | null {
  const { packs: parts, singles } = stockBreakdown(stock, packs);
  if (parts.length === 0) return null;
  const pieces = parts.map((part) => `${part.count} × ${part.label}`);
  if (singles > 0) pieces.push(`${singles} ${singles === 1 ? "single" : "singles"}`);
  return pieces.join(" + ");
}

/** Price of one item when bought as a pack. */
export function pricePerItem(pack: Pick<PackSize, "sellingPrice" | "quantity">): number {
  return pack.sellingPrice / pack.quantity;
}
