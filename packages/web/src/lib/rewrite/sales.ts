import type { CreateSaleInput, DomainSale, SaleLine } from "@pos/shared";
import { calculateSaleTotal } from "@pos/shared";
import { supabase } from "../supabase";

type SaleRow = {
  id: string;
  cashier_id: string;
  customer_id: string | null;
  subtotal: number | string;
  discount: number | string;
  total: number | string;
  payment_method: DomainSale["paymentMethod"];
  created_at: string;
};

function toSale(row: SaleRow, lines: SaleLine[] = []): DomainSale {
  return {
    id: row.id,
    cashierId: row.cashier_id,
    customerId: row.customer_id,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    total: Number(row.total),
    paymentMethod: row.payment_method,
    lines,
    createdAt: row.created_at,
  };
}

export async function createSupabaseSale(input: CreateSaleInput): Promise<DomainSale> {
  const totals = calculateSaleTotal(input.lines, input.discount);
  const { data, error } = await supabase.rpc("create_sale", {
    p_cashier_id: input.cashierId,
    p_customer_id: input.customerId ?? null,
    p_payment_method: input.paymentMethod,
    p_discount: totals.discount,
    p_lines: input.lines.map((line) => ({
      product_id: line.productId,
      quantity: line.quantity,
    })),
  });

  if (error) throw error;
  const saleId = data as string;
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select("id,cashier_id,customer_id,subtotal,discount,total,payment_method,created_at")
    .eq("id", saleId)
    .single();

  if (saleError) throw saleError;
  return toSale(sale as SaleRow, input.lines);
}
