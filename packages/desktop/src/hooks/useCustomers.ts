import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/ipc';
import type { Customer } from '@pos/shared/types';

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    try {
      const data = await api.customers.list() as Customer[];
      setCustomers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch customers');
    }
  }, []);

  const addCustomer = useCallback(async (customer: {
    name: string;
    phone?: string | null;
    email?: string | null;
  }) => {
    try {
      await api.customers.create(customer);
      await fetchCustomers();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add customer');
      return false;
    }
  }, [fetchCustomers]);

  const getCustomer = useCallback(async (id: string) => {
    try {
      return await api.customers.get(id) as Customer | null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get customer');
      return null;
    }
  }, []);

  const updateCustomer = useCallback(async (id: string, data: { name?: string; phone?: string | null; email?: string | null; loyalty_points?: number }) => {
    try {
      await api.customers.update(id, data);
      await fetchCustomers();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update customer');
      return false;
    }
  }, [fetchCustomers]);

  const deleteCustomer = useCallback(async (id: string) => {
    try {
      await api.customers.delete(id);
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete customer');
      return false;
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchCustomers();
      setLoading(false);
    };
    init();
  }, [fetchCustomers]);

  return { customers, loading, error, addCustomer, getCustomer, updateCustomer, deleteCustomer, refetch: fetchCustomers };
}
