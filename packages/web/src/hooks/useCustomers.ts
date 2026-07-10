import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  loyalty_points: number;
  created_at: string;
}

export function useCustomers() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch customers");
    }
  }, []);

  const addCustomer = useCallback(async (customer: {
    name: string;
    phone?: string | null;
    email?: string | null;
  }) => {
    try {
      const { error } = await supabase.from("customers").insert(customer);
      if (error) throw error;
      await fetchCustomers();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add customer");
      return false;
    }
  }, [fetchCustomers]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchCustomers();
      setLoading(false);
    };
    init();
  }, [fetchCustomers]);

  return { customers, loading, error, addCustomer, refetch: fetchCustomers };
}
