"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pos/shared";
import { Plus, Star, Users } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { type Client, type Customer, Field, type Feedback, fail, SearchInput } from "./common";

const emptyForm = { name: "", phone: "", email: "" };

export function Customers({ supabase, onError, onNotice }: { supabase: Client } & Feedback) {
  const { shop } = useWorkspace();
  const loyalty = shop.loyalty_enabled;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("customers").select("id,name,phone,email,loyalty_points").order("name");
    if (error) fail(onError, error); else setCustomers((data ?? []) as Customer[]);
    setLoaded(true);
  }, [supabase, onError]);

  useEffect(() => { void load(); }, [load]);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) { onError("Customer name is required."); return; }
    const { error } = await supabase.from("customers").insert({ shop_id: shop.id, name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null });
    if (error) { fail(onError, error); return; }
    setForm(emptyForm);
    setOpen(false);
    onNotice("Customer added.");
    await load();
  };

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return customers.filter(c => `${c.name} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase().includes(query));
  }, [customers, search]);

  const totalPoints = customers.reduce((sum, c) => sum + c.loyalty_points, 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Customers"
        description={loaded ? `${customers.length} ${customers.length === 1 ? "customer" : "customers"}${loyalty ? ` · ${totalPoints.toLocaleString()} loyalty points outstanding` : ""}` : "Contact details for repeat shoppers."}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus />
            Add customer
          </Button>
        }
      />

      <Card>
        <div className="border-b p-4">
          <SearchInput label="Search customers" placeholder="Search by name, phone, or email…" value={search} onChange={setSearch} className="sm:max-w-sm" />
        </div>
        <CardContent className="p-0">
          {filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden sm:table-cell">Contact</TableHead>
                  {loyalty && <TableHead className="text-right">Loyalty</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(customer => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={customer.name} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{customer.name}</p>
                          <p className="truncate text-xs text-muted-foreground sm:hidden">{customer.phone || customer.email || "No contact details"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {customer.phone || customer.email ? (
                        <>
                          {customer.phone && <p>{customer.phone}</p>}
                          {customer.email && <p className="text-xs text-muted-foreground">{customer.email}</p>}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {loyalty && (
                      <TableCell className="text-right">
                        <Badge variant={customer.loyalty_points > 0 ? "success" : "secondary"}>
                          <Star />
                          {customer.loyalty_points} pts
                        </Badge>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={Users}
              title={!loaded ? "Loading customers…" : customers.length === 0 ? "No customers yet" : "No matching customers"}
              description={!loaded ? undefined : customers.length === 0 ? "Add customers to reward repeat shoppers with loyalty points." : "Try a different search."}
              action={loaded && customers.length === 0 ? <Button onClick={() => setOpen(true)}><Plus />Add customer</Button> : undefined}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add customer</DialogTitle>
            <DialogDescription>Keep contact details so loyalty points can be tracked.</DialogDescription>
          </DialogHeader>
          <form id="customer-form" onSubmit={add} className="grid gap-4">
            <Field label="Full name" htmlFor="customer-name">
              <Input id="customer-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Phone" htmlFor="customer-phone">
              <Input id="customer-phone" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email" htmlFor="customer-email">
              <Input id="customer-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </Field>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="customer-form">Add customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
