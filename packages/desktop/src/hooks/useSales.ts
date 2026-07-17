import { useState, useCallback } from 'react';
import { api } from '@/lib/ipc';

export function useCreateSale() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSale = useCallback(async (
    cashierId: string,
    items: { product_id: string; quantity: number; price: number; cost_price: number }[],
    total: number,
    discount: number,
    paymentMethod: 'cash' | 'momo' | 'card'
  ) => {
    setCreating(true);
    setError(null);
    try {
      const sale = await api.sales.create({
        cashier_id: cashierId,
        items,
        total,
        discount,
        payment_method: paymentMethod,
      });
      return sale;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sale');
      return null;
    } finally {
      setCreating(false);
    }
  }, []);

  return { createSale, creating, error };
}

export function useSaleDetails() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSaleWithItems = useCallback(async (saleId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.sales.getWithItems(saleId) as {
        id: string;
        total: number;
        discount: number;
        payment_method: string;
        created_at: string;
        cashier_name: string;
        items: Array<{
          product_name: string;
          quantity: number;
          price: number;
          cost_price: number;
        }>;
      } | null;
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sale');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getSaleWithItems, loading, error };
}
