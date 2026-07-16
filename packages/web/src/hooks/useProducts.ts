import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { getLowStockThreshold } from "../lib/settings";

export interface ProductRow {
  id: string;
  name: string;
  category_id: string | null;
  cost_price: number;
  selling_price: number;
  stock: number;
  barcode: string | null;
  image: string | null;
  created_at: string;
  categories?: { id: string; name: string } | null;
}

export interface CategoryRow {
  id: string;
  name: string;
}

export function useProducts() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*, categories(id, name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    setProducts(data || []);
  }, []);

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase.from("categories").select("*").order("name");
    if (error) throw new Error(error.message);
    setCategories(data || []);
  }, []);

  const addProduct = useCallback(async (product: {
    name: string;
    category_id?: string | null;
    cost_price: number;
    selling_price: number;
    stock?: number;
    barcode?: string | null;
    measurement_unit?: string | null;
    pack_quantity?: number | null;
    unit_cost?: number | null;
  }) => {
    setError(null);
    const initialStock = Math.max(0, Number(product.stock ?? 0));
    const packQuantity = Math.max(0, Number(product.pack_quantity ?? 0));
    const qtyToRecord = initialStock > 0 ? initialStock : packQuantity;

    const { data: insertedProduct, error: insertError } = await supabase
      .from("products")
      .insert({
        ...product,
        stock: 0,
        barcode: product.barcode ?? null,
      })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      return false;
    }

    if (insertedProduct && qtyToRecord > 0) {
      const detailParts = [
        product.measurement_unit?.trim() || null,
        product.pack_quantity ? `pack ${product.pack_quantity}` : null,
        product.unit_cost != null ? `unit cost ${product.unit_cost}` : null,
      ].filter(Boolean) as string[];
      const noteText = detailParts.length > 0 ? detailParts.join(" • ") : null;

      const { error: historyError } = await supabase.from("stock_history").insert({
        product_id: insertedProduct.id,
        type: "in",
        quantity: Math.abs(qtyToRecord),
        supplier_id: null,
        notes: noteText || `Initial stock for ${product.name}`,
      });

      if (historyError) {
        setError(historyError.message);
        return true;
      }
    }

    await fetchProducts();
    return true;
  }, [fetchProducts]);

  const updateProduct = useCallback(async (id: string, product: Partial<ProductRow>) => {
    setError(null);
    const { error } = await supabase.from("products").update({
      name: product.name,
      category_id: product.category_id,
      cost_price: product.cost_price,
      selling_price: product.selling_price,
      stock: product.stock,
      barcode: product.barcode,
    }).eq("id", id);
    if (error) {
      setError(error.message);
      return false;
    }
    await fetchProducts();
    return true;
  }, [fetchProducts]);

  const deleteProduct = useCallback(async (id: string) => {
    setError(null);
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return false;
    }
    setProducts((prev) => prev.filter((p) => p.id !== id));
    return true;
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([fetchProducts(), fetchCategories()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load products");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [fetchProducts, fetchCategories]);

  return {
    products,
    categories,
    loading,
    error,
    lowStockThreshold: getLowStockThreshold(),
    addProduct,
    updateProduct,
    deleteProduct,
    refetch: fetchProducts,
  };
}
