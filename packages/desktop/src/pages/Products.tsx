import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Package } from 'lucide-react';
import { Button } from '@pos/shared/components/button';
import { Input } from '@pos/shared/components/input';
import { Card, CardContent, CardHeader, CardTitle } from '@pos/shared/components/card';
import { Badge } from '@pos/shared/components/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@pos/shared/components/dialog';
import { Label } from '@pos/shared/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@pos/shared/components/select';
import { formatCurrency } from '@pos/shared/lib/utils';
import { api } from '../lib/ipc';
import QRCode from 'qrcode';

export default function Products() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    category_id: '',
    cost_price: 0,
    selling_price: 0,
    stock: 0,
    barcode: '',
  });

  const loadProducts = async () => {
    const data = await api.products.list(search || undefined);
    setProducts(data as any[]);
  };

  const loadCategories = async () => {
    const data = await api.categories.list();
    setCategories(data as any[]);
  };

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [search]);

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.selling_price) return;

    const barcode = newProduct.barcode || crypto.randomUUID().slice(0, 8);
    const qrData = await QRCode.toDataURL(barcode, { width: 200 });
    await api.products.create({
      ...newProduct,
      barcode,
      qr_code: qrData,
    });

    setNewProduct({ name: '', category_id: '', cost_price: 0, selling_price: 0, stock: 0, barcode: '' });
    setIsAddDialogOpen(false);
    loadProducts();
  };

  const handleEditProduct = async () => {
    if (!editingProduct) return;
    await api.products.update(editingProduct.id, {
      name: editingProduct.name,
      category_id: editingProduct.category_id,
      cost_price: editingProduct.cost_price,
      selling_price: editingProduct.selling_price,
      barcode: editingProduct.barcode,
    });
    setIsEditDialogOpen(false);
    setEditingProduct(null);
    loadProducts();
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      await api.products.delete(id);
      loadProducts();
    }
  };

  const openEditDialog = (product: any) => {
    setEditingProduct({ ...product });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product inventory</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.map((product) => (
          <Card key={product.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                </div>
                <Badge variant={product.stock < 10 ? 'destructive' : 'secondary'}>
                  {product.stock} in stock
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Category:</span>
                  <span>{product.category_name || 'Uncategorized'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cost Price:</span>
                  <span>{formatCurrency(product.cost_price)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Selling Price:</span>
                  <span className="font-bold">{formatCurrency(product.selling_price)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Profit:</span>
                  <span className="text-green-600">
                    {formatCurrency(product.selling_price - product.cost_price)}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog(product)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDeleteProduct(product.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Product Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>Add a new product to your inventory.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Product Name</Label>
              <Input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Enter product name" />
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={newProduct.category_id} onValueChange={(v) => setNewProduct({ ...newProduct, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Cost Price (GHS)</Label>
                <Input type="number" value={newProduct.cost_price || ''} onChange={(e) => setNewProduct({ ...newProduct, cost_price: Number(e.target.value) })} placeholder="0.00" />
              </div>
              <div className="grid gap-2">
                <Label>Selling Price (GHS)</Label>
                <Input type="number" value={newProduct.selling_price || ''} onChange={(e) => setNewProduct({ ...newProduct, selling_price: Number(e.target.value) })} placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Initial Stock</Label>
                <Input type="number" value={newProduct.stock || ''} onChange={(e) => setNewProduct({ ...newProduct, stock: Number(e.target.value) })} placeholder="0" />
              </div>
              <div className="grid gap-2">
                <Label>Barcode (optional)</Label>
                <Input value={newProduct.barcode} onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })} placeholder="Enter barcode" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddProduct}>Add Product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update product information.</DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Product Name</Label>
                <Input value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={editingProduct.category_id || ''} onValueChange={(v) => setEditingProduct({ ...editingProduct, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Cost Price (GHS)</Label>
                  <Input type="number" value={editingProduct.cost_price} onChange={(e) => setEditingProduct({ ...editingProduct, cost_price: Number(e.target.value) })} />
                </div>
                <div className="grid gap-2">
                  <Label>Selling Price (GHS)</Label>
                  <Input type="number" value={editingProduct.selling_price} onChange={(e) => setEditingProduct({ ...editingProduct, selling_price: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Barcode</Label>
                <Input value={editingProduct.barcode || ''} onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditProduct}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
