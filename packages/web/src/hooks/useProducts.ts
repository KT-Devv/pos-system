import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

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
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(id, name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch products");
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch categories");
    }
  }, []);

  const addProduct = useCallback(async (product: {
    name: string;
    category_id?: string | null;
    cost_price: number;
    selling_price: number;
    stock?: number;
    barcode?: string | null;
  }) => {
    try {
      const { error } = await supabase.from("products").insert(product);
      if (error) throw error;
      await fetchProducts();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add product");
      return false;
    }
  }, [fetchProducts]);

  const deleteProduct = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      setProducts((prev) => prev.filter((p) => p.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product");
      return false;
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchProducts(), fetchCategories()]);
      setLoading(false);
    };
    init();
  }, [fetchProducts, fetchCategories]);

  const updateProduct = useCallback(async (id: string, updates: {
    name?: string;
    category_id?: string | null;
    cost_price?: number;
    selling_price?: number;
    barcode?: string | null;
  }) => {
    try {
      const { error } = await supabase.from("products").update(updates).eq("id", id);
      if (error) throw error;
      await fetchProducts();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update product");
      return false;
    }
  }, [fetchProducts]);

  return { products, categories, loading, error, addProduct, updateProduct, deleteProduct, refetch: fetchProducts };
}
