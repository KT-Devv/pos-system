export type UserRole = "admin" | "cashier";
export type PaymentMethod = "cash" | "momo" | "card";
export type StockMovementType = "in" | "out" | "adjustment";

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

export interface SaleLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
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
  const normalizedDiscount = roundCurrency(Math.max(0, discount));

  return {
    subtotal,
    discount: normalizedDiscount,
    total: roundCurrency(Math.max(0, subtotal - normalizedDiscount)),
  };
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
  if (input.discount !== undefined && (!Number.isFinite(input.discount) || input.discount < 0)) {
    errors.push("Discount must be zero or greater");
  }

  return errors;
}
