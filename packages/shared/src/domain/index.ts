export type UserRole = "admin" | "cashier";
export type PaymentMethod = "cash" | "momo" | "card";
export type StockMovementType = "in" | "out" | "adjustment";
/** Which of a product's two prices a sale line is charged. */
export type PriceTier = "regular" | "wholesale";

export interface User {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string | null;
  costPrice: number;
  sellingPrice: number;
  /** Optional second price for wholesale sales. Null or absent means only the regular price exists. */
  wholesalePrice?: number | null;
  stock: number;
  barcode: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  loyaltyPoints: number;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
}

export interface SaleLine {
  productId: string;
  /** Units sold: single items, or packs when unitId is set. */
  quantity: number;
  /** Price and cost of one unit (a single, or a whole pack). */
  unitPrice: number;
  unitCost: number;
  /** The pack size sold; absent or null for singles. */
  unitId?: string | null;
  /** Single items in one unit; absent or 1 for singles. */
  unitQuantity?: number;
  /** The price the line is asked to be charged at; the server applies it only where a wholesale price exists. */
  priceTier?: PriceTier;
}

export interface Sale {
  id: string;
  cashierId: string;
  lines: SaleLine[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  customerId: string | null;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  supplierId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateSaleInput {
  cashierId: string;
  lines: SaleLine[];
  discount?: number;
  paymentMethod: PaymentMethod;
  customerId?: string | null;
}

export interface ProductInput {
  name: string;
  categoryId?: string | null;
  costPrice: number;
  sellingPrice: number;
  wholesalePrice?: number | null;
  stock?: number;
  barcode?: string | null;
  imageUrl?: string | null;
}

export function calculateSaleTotal(
  lines: readonly SaleLine[],
  discount = 0,
): { subtotal: number; discount: number; total: number } {
  const subtotal = roundCurrency(
    lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
  );
  const normalizedDiscount = roundCurrency(
    Math.min(Math.max(0, discount), subtotal),
  );

  return {
    subtotal,
    discount: normalizedDiscount,
    total: roundCurrency(subtotal - normalizedDiscount),
  };
}

/** Whether a sale at this tier is charged the wholesale price: only when the product has one. */
export function usesWholesalePrice(wholesalePrice: number | null | undefined, tier: PriceTier): boolean {
  return tier === "wholesale" && wholesalePrice !== null && wholesalePrice !== undefined && wholesalePrice > 0;
}

/** The price one single item is charged: the wholesale price on a wholesale sale when the product has one, else the regular price. */
export function unitPriceForTier(regularPrice: number, wholesalePrice: number | null | undefined, tier: PriceTier): number {
  return usesWholesalePrice(wholesalePrice, tier) ? (wholesalePrice as number) : regularPrice;
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function validateProductInput(input: ProductInput): string[] {
  const errors: string[] = [];

  if (!input.name.trim()) errors.push("Product name is required");
  if (!Number.isFinite(input.costPrice) || input.costPrice < 0) {
    errors.push("Cost price must be zero or greater");
  }
  if (!Number.isFinite(input.sellingPrice) || input.sellingPrice <= 0) {
    errors.push("Selling price must be greater than zero");
  }
  if (input.wholesalePrice !== undefined && input.wholesalePrice !== null && (!Number.isFinite(input.wholesalePrice) || input.wholesalePrice <= 0)) {
    errors.push("Wholesale price must be greater than zero, or left empty");
  }
  if (
    input.stock !== undefined &&
    (!Number.isInteger(input.stock) || input.stock < 0)
  ) {
    errors.push("Stock must be a whole number that is zero or greater");
  }

  return errors;
}

export function validateSaleInput(input: CreateSaleInput): string[] {
  const errors: string[] = [];

  if (!input.cashierId) errors.push("Cashier is required");
  if (!input.lines.length) errors.push("At least one sale item is required");
  if (input.lines.some((line) => !Number.isInteger(line.quantity) || line.quantity <= 0)) {
    errors.push("Sale quantities must be positive whole numbers");
  }
  if (input.lines.some((line) => !Number.isFinite(line.unitPrice) || line.unitPrice < 0)) {
    errors.push("Sale prices must be zero or greater");
  }
  if (input.lines.some((line) => line.priceTier !== undefined && line.priceTier !== "regular" && line.priceTier !== "wholesale")) {
    errors.push("Unknown price tier");
  }
  if (input.discount !== undefined && (!Number.isFinite(input.discount) || input.discount < 0)) {
    errors.push("Discount must be zero or greater");
  }

  return errors;
}
