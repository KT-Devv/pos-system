import { useState, useEffect } from 'react';
import { Plus, Search, ArrowDownCircle, ArrowUpCircle, Edit } from 'lucide-react';
import { Button } from '@pos/shared/components/button';
import { Input } from '@pos/shared/components/input';
import { Card, CardContent, CardHeader, CardTitle } from '@pos/shared/components/card';
import { Badge } from '@pos/shared/components/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@pos/shared/components/dialog';
import { Label } from '@pos/shared/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@pos/shared/components/select';
import { formatDateTime } from '@pos/shared/lib/utils';
import { api } from '../lib/ipc';

export default function Inventory() {
  const [history, setHistory] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({
    product_id: '',
    type: 'in' as 'in' | 'out' | 'adjustment',
    quantity: 0,
    supplier_id: '',
    notes: '',
  });

  const loadData = async () => {
    const [hist, prods, sups] = await Promise.all([
      api.inventory.history({ limit: 100 }),
      api.products.list(),
      api.suppliers.list(),
    ]);
    setHistory(hist as any[]);
    setProducts(prods as any[]);
    setSuppliers(sups as any[]);
  };

  useEffect(() => { loadData(); }, []);

  const handleStockEntry = async () => {
    if (!newEntry.product_id || newEntry.quantity <= 0) return;

    if (newEntry.type === 'in') {
      await api.inventory.stockIn({
        product_id: newEntry.product_id,
        quantity: newEntry.quantity,
        supplier_id: newEntry.supplier_id || undefined,
        notes: newEntry.notes || undefined,
      });
    } else if (newEntry.type === 'out') {
      await api.inventory.stockOut({
        product_id: newEntry.product_id,
        quantity: newEntry.quantity,
        notes: newEntry.notes || undefined,
      });
    } else {
      await api.inventory.adjust({
        product_id: newEntry.product_id,
        quantity: newEntry.quantity,
        notes: newEntry.notes || undefined,
      });
    }

    setNewEntry({ product_id: '', type: 'in', quantity: 0, supplier_id: '', notes: '' });
    setIsDialogOpen(false);
    loadData();
  };

  const filteredHistory = history.filter((entry) =>
    entry.product_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">Track stock movements and manage inventory</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Stock Entry
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search stock history..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredHistory.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No stock history yet</p>
            ) : (
              filteredHistory.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${entry.type === 'in' ? 'bg-green-100' : entry.type === 'out' ? 'bg-red-100' : 'bg-yellow-100'}`}>
                      {entry.type === 'in' ? (
                        <ArrowDownCircle className="h-5 w-5 text-green-600" />
                      ) : entry.type === 'out' ? (
                        <ArrowUpCircle className="h-5 w-5 text-red-600" />
                      ) : (
                        <Edit className="h-5 w-5 text-yellow-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium">{entry.product_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {entry.notes}
                        {entry.supplier_name && ` • ${entry.supplier_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={entry.type === 'in' ? 'success' : entry.type === 'out' ? 'destructive' : 'warning'}>
                      {entry.type === 'in' ? '+' : entry.type === 'out' ? '-' : '±'}{entry.quantity}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDateTime(entry.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stock Entry Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stock Entry</DialogTitle>
            <DialogDescription>Record a new stock movement.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Product</Label>
              <Select value={newEntry.product_id} onValueChange={(v) => setNewEntry({ ...newEntry, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={newEntry.type} onValueChange={(v: any) => setNewEntry({ ...newEntry, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Stock In</SelectItem>
                  <SelectItem value="out">Stock Out</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Quantity</Label>
              <Input type="number" value={newEntry.quantity || ''} onChange={(e) => setNewEntry({ ...newEntry, quantity: Number(e.target.value) })} placeholder="0" />
            </div>
            {newEntry.type === 'in' && (
              <div className="grid gap-2">
                <Label>Supplier</Label>
                <Select value={newEntry.supplier_id} onValueChange={(v) => setNewEntry({ ...newEntry, supplier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input value={newEntry.notes} onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleStockEntry}>Save Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
