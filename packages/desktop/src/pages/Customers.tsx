import { useState, useEffect } from 'react';
import { Plus, Search, Phone, Mail, Star } from 'lucide-react';
import { Button } from '@pos/shared/components/button';
import { Input } from '@pos/shared/components/input';
import { Card, CardContent, CardHeader, CardTitle } from '@pos/shared/components/card';
import { Badge } from '@pos/shared/components/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@pos/shared/components/dialog';
import { Label } from '@pos/shared/components/label';
import { api } from '../lib/ipc';

export default function Customers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });

  const loadCustomers = async () => {
    const data = await api.customers.list(search || undefined);
    setCustomers(data as any[]);
  };

  useEffect(() => { loadCustomers(); }, [search]);

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) return;
    await api.customers.create(newCustomer);
    setNewCustomer({ name: '', phone: '', email: '' });
    setIsAddDialogOpen(false);
    loadCustomers();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage your customer database</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search customers by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center text-muted-foreground">
              No customers yet. Add your first customer!
            </CardContent>
          </Card>
        ) : (
          customers.map((customer) => (
            <Card key={customer.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{customer.name}</CardTitle>
                  <Badge variant="secondary">
                    <Star className="h-3 w-3 mr-1" />
                    {customer.loyalty_points} pts
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{customer.phone}</span>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{customer.email}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add Customer Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>Add a new customer to your database.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Customer Name</Label>
              <Input value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} placeholder="Enter customer name" />
            </div>
            <div className="grid gap-2">
              <Label>Phone Number</Label>
              <Input value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="+233 XX XXX XXXX" />
            </div>
            <div className="grid gap-2">
              <Label>Email (Optional)</Label>
              <Input type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} placeholder="customer@email.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCustomer}>Add Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
