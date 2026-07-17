import { useState } from 'react';
import { Plus, Search, Phone, Mail, Star, Edit, Trash2 } from 'lucide-react';
import { Button } from '@pos/shared/components/button';
import { Input } from '@pos/shared/components/input';
import { Card, CardContent, CardHeader, CardTitle } from '@pos/shared/components/card';
import { Badge } from '@pos/shared/components/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@pos/shared/components/dialog';
import { Label } from '@pos/shared/components/label';
import { useCustomers } from '@/hooks/useCustomers';
import type { Customer } from '@pos/shared/types';

export default function Customers() {
  const { customers, loading, error, addCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const [search, setSearch] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });

  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(search.toLowerCase()) ||
    (customer.phone || '').includes(search)
  );

  const handleAddCustomer = async () => {
    if (newCustomer.name) {
      const ok = await addCustomer({
        name: newCustomer.name,
        phone: newCustomer.phone || null,
        email: newCustomer.email || null,
      });
      if (ok) { setIsAddDialogOpen(false); setNewCustomer({ name: '', phone: '', email: '' }); }
    }
  };

  const handleEditCustomer = async () => {
    if (!editingCustomer) return;
    const ok = await updateCustomer(editingCustomer.id, {
      name: editingCustomer.name,
      phone: editingCustomer.phone,
      email: editingCustomer.email,
    });
    if (ok) { setIsEditDialogOpen(false); setEditingCustomer(null); }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('Delete this customer?')) return;
    await deleteCustomer(id);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage your customer database</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Customer</Button>
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{customers.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Loyalty Points</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? '...' : customers.reduce((sum, c) => sum + (c.loyalty_points || 0), 0)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Avg. Loyalty Points</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{loading || customers.length === 0 ? '...' : Math.round(customers.reduce((sum, c) => sum + (c.loyalty_points || 0), 0) / customers.length)}</div></CardContent></Card>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search customers by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading customers...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => (
            <Card key={customer.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{customer.name}</CardTitle>
                  <Badge variant="secondary"><Star className="h-3 w-3 mr-1" />{customer.loyalty_points || 0} pts</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {customer.phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /><span>{customer.phone}</span></div>}
                  {customer.email && <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span>{customer.email}</span></div>}
                  <div className="text-sm pt-2 border-t"><span className="text-muted-foreground">Loyalty Points: </span><span className="font-bold">{customer.loyalty_points || 0}</span></div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditingCustomer(customer); setIsEditDialogOpen(true); }}>
                    <Edit className="h-4 w-4 mr-1" />Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDeleteCustomer(customer.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredCustomers.length === 0 && <p className="text-center text-muted-foreground mt-8">No customers found</p>}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Customer</DialogTitle><DialogDescription>Add a new customer to your database.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Customer Name</Label><Input value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} placeholder="Enter customer name" /></div>
            <div className="grid gap-2"><Label>Phone Number</Label><Input value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="+233 XX XXX XXXX" /></div>
            <div className="grid gap-2"><Label>Email (Optional)</Label><Input type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} placeholder="customer@email.com" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCustomer}>Add Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Customer</DialogTitle><DialogDescription>Update customer details.</DialogDescription></DialogHeader>
          {editingCustomer && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2"><Label>Customer Name</Label><Input value={editingCustomer.name} onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Phone Number</Label><Input value={editingCustomer.phone || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Email</Label><Input type="email" value={editingCustomer.email || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Loyalty Points</Label><Input type="number" value={editingCustomer.loyalty_points || 0} onChange={(e) => setEditingCustomer({ ...editingCustomer, loyalty_points: Number(e.target.value) })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditCustomer}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
