import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/ipc';
import type { Product } from '@pos/shared/types';

export interface CategoryRow {
  id: string;
  name: string;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);

  const fetchProducts = useCallback(async () => {
    const data = await api.products.list() as Product[];
    setProducts(data || []);
  }, []);

  const fetchCategories = useCallback(async () => {
    const data = await api.categories.list() as CategoryRow[];
    setCategories(data || []);
  }, []);

  const fetchThreshold = useCallback(async () => {
    const val = await api.settings.get('low_stock_threshold') as string | null;
    if (val) setLowStockThreshold(Number(val) || 10);
  }, []);

  const addProduct = useCallback(async (product: {
    name: string;
    category_id?: string | null;
    cost_price: number;
    selling_price: number;
    stock?: number;
    barcode?: string | null;
    qr_code?: string | null;
    measurement_unit?: string | null;
    pack_quantity?: number | null;
    unit_cost?: number | null;
  }) => {
    setError(null);
    try {
      await api.products.create(product);
      await fetchProducts();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add product');
      return false;
    }
  }, [fetchProducts]);

  const updateProduct = useCallback(async (id: string, product: Partial<Product>) => {
    setError(null);
    try {
      await api.products.update(id, product);
      await fetchProducts();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
      return false;
    }
  }, [fetchProducts]);

  const deleteProduct = useCallback(async (id: string) => {
    setError(null);
    try {
      await api.products.delete(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
      return false;
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([fetchProducts(), fetchCategories(), fetchThreshold()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load products');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [fetchProducts, fetchCategories, fetchThreshold]);

  const addCategory = useCallback(async (name: string) => {
    setError(null);
    try {
      await api.categories.create(name);
      await fetchCategories();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add category');
      return false;
    }
  }, [fetchCategories]);

  const deleteCategory = useCallback(async (id: string) => {
    setError(null);
    try {
      await api.categories.delete(id);
      await fetchCategories();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
      return false;
    }
  }, [fetchCategories]);

  return {
    products, categories, loading, error, lowStockThreshold,
    addProduct, updateProduct, deleteProduct,
    addCategory, deleteCategory,
    refetch: fetchProducts,
  };
}
