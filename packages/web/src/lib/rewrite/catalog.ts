import type { DomainProduct, ProductInput } from "@pos/shared";
import { supabase } from "../supabase";

type ProductRow = {
  id: string;
  name: string;
  category_id: string | null;
  cost_price: number | string;
  selling_price: number | string;
  stock: number;
  barcode: string | null;
  image_url: string | null;
  created_at: string;
};

function toProduct(row: ProductRow): DomainProduct {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    costPrice: Number(row.cost_price),
    sellingPrice: Number(row.selling_price),
    stock: row.stock,
    barcode: row.barcode,
    imageUrl: row.image_url,
    createdAt: row.created_at,
  };
}

export async function listCatalogProducts(search = ""): Promise<DomainProduct[]> {
  let query = supabase
    .from("products")
    .select("id,name,category_id,cost_price,selling_price,stock,barcode,image_url,created_at")
    .order("created_at", { ascending: false });

  if (search.trim()) {
    query = query.ilike("name", `%${search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as ProductRow[]).map(toProduct);
}

export async function createCatalogProduct(input: ProductInput): Promise<DomainProduct> {
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: input.name.trim(),
      category_id: input.categoryId ?? null,
      cost_price: input.costPrice,
      selling_price: input.sellingPrice,
      stock: input.stock ?? 0,
      barcode: input.barcode ?? null,
      image_url: input.imageUrl ?? null,
    })
    .select("id,name,category_id,cost_price,selling_price,stock,barcode,image_url,created_at")
    .single();

  if (error) throw error;
  return toProduct(data as ProductRow);
}
