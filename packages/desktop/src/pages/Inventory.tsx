import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, ArrowDownCircle, ArrowUpCircle, Edit, Loader2 } from 'lucide-react';
import { Button } from '@pos/shared/components/button';
import { Input } from '@pos/shared/components/input';
import { Card, CardContent, CardHeader, CardTitle } from '@pos/shared/components/card';
import { Badge } from '@pos/shared/components/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@pos/shared/components/dialog';
import { Label } from '@pos/shared/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@pos/shared/components/select';
import { formatDateTime } from '@pos/shared/lib/utils';
import { api } from '../lib/ipc';

const EMPTY_ENTRY = { product_id: '', type: 'in' as 'in' | 'out' | 'adjustment', quantity: 0, supplier_id: '', notes: '' };

export default function Inventory() {
  const [history, setHistory] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEntry, setNewEntry] = useState(EMPTY_ENTRY);
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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

  const resetForm = useCallback(() => {
    setNewEntry(EMPTY_ENTRY);
    setFormErrors({});
  }, []);

  useEffect(() => {
    if (!isDialogOpen) resetForm();
  }, [isDialogOpen, resetForm]);

  const validateEntry = (entry: typeof EMPTY_ENTRY): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!entry.product_id) errors.product_id = 'Product is required';
    if (entry.quantity <= 0) errors.quantity = 'Quantity must be greater than 0';
    return errors;
  };

  const handleStockEntry = async () => {
    const errors = validateEntry(newEntry);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setLoading(true);
    try {
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
      setIsDialogOpen(false);
      loadData();
    } catch (err) {
      console.error('Failed to record stock entry:', err);
      alert('Failed to save stock entry. Please try again.');
    } finally {
      setLoading(false);
    }
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
              <Label>Product *</Label>
              <Select value={newEntry.product_id || undefined} onValueChange={(v) => setNewEntry({ ...newEntry, product_id: v })}>
                <SelectTrigger className={formErrors.product_id ? 'border-destructive' : ''}><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.product_id && <p className="text-sm text-destructive">{formErrors.product_id}</p>}
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
              <Label>Quantity *</Label>
              <Input
                type="number"
                min="1"
                value={newEntry.quantity || ''}
                onChange={(e) => setNewEntry({ ...newEntry, quantity: Number(e.target.value) || 0 })}
                placeholder="0"
                className={formErrors.quantity ? 'border-destructive' : ''}
              />
              {formErrors.quantity && <p className="text-sm text-destructive">{formErrors.quantity}</p>}
            </div>
            {newEntry.type === 'in' && (
              <div className="grid gap-2">
                <Label>Supplier</Label>
                <Select value={newEntry.supplier_id || undefined} onValueChange={(v) => setNewEntry({ ...newEntry, supplier_id: v })}>
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
            <Button onClick={handleStockEntry} disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : 'Save Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
