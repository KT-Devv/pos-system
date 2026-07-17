import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/ipc';

export interface Product {
  id: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  cost_price: number;
  selling_price: number;
  stock: number;
  barcode: string | null;
  qr_code: string | null;
  image: string | null;
  created_at: string;
}

export function useProducts(search?: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.products.list(search);
      setProducts(data as Product[]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { products, loading, refresh };
}

export function useProductByBarcode(barcode: string | null) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!barcode) {
      setProduct(null);
      return;
    }
    setLoading(true);
    api.products.getByBarcode(barcode)
      .then((p) => setProduct(p as Product | null))
      .finally(() => setLoading(false));
  }, [barcode]);

  return { product, loading };
}
