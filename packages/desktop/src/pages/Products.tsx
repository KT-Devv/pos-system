import { useState } from 'react';
import { Plus, Search, Edit, Trash2, Package, Tag, Barcode, ScanBarcode } from 'lucide-react';
import { Button } from '@pos/shared/components/button';
import { Input } from '@pos/shared/components/input';
import { Card, CardContent, CardHeader, CardTitle } from '@pos/shared/components/card';
import { Badge } from '@pos/shared/components/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@pos/shared/components/dialog';
import { Label } from '@pos/shared/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@pos/shared/components/select';
import { formatCurrency } from '@pos/shared/lib/utils';
import { useProducts } from '@/hooks/useProducts';
import BarcodeLabel from '@/components/BarcodeLabel';
import QRScanner from '@/components/QRScanner';
import type { Product } from '@pos/shared/types';

export default function Products() {
  const { products, categories, loading, error, lowStockThreshold, addProduct, updateProduct, deleteProduct, addCategory, deleteCategory } = useProducts();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [barcodeScanTarget, setBarcodeScanTarget] = useState<'add' | 'edit'>('add');
  const [newProduct, setNewProduct] = useState({
    name: '', category_id: '', cost_price: 0, selling_price: 0, stock: 0,
    barcode: '', measurement_unit: '', pack_quantity: 0, unit_cost: 0,
  });

  const categoryName = (p: Product) => {
    const cat = categories.find((c) => c.id === p.category_id);
    return cat?.name || '';
  };

  const categoryNames = ['All', ...categories.map((c) => c.name)];

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || categoryName(product) === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddProduct = async () => {
    if (newProduct.name && newProduct.cost_price > 0 && newProduct.selling_price > 0) {
      const ok = await addProduct({
        name: newProduct.name,
        category_id: newProduct.category_id || null,
        cost_price: newProduct.cost_price,
        selling_price: newProduct.selling_price,
        stock: newProduct.stock,
        barcode: newProduct.barcode || null,
        measurement_unit: newProduct.measurement_unit || null,
        pack_quantity: newProduct.pack_quantity || null,
        unit_cost: newProduct.unit_cost || null,
      });
      if (ok) {
        setNewProduct({ name: '', category_id: '', cost_price: 0, selling_price: 0, stock: 0, barcode: '', measurement_unit: '', pack_quantity: 0, unit_cost: 0 });
        setIsAddDialogOpen(false);
      }
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Delete this product? Products referenced in past sales cannot be deleted.')) return;
    setDeleteError(null);
    const ok = await deleteProduct(id);
    if (!ok) setDeleteError(error || 'Failed to delete product');
  };

  const handleEditProduct = async () => {
    if (!editingProduct) return;
    const ok = await updateProduct(editingProduct.id, {
      name: editingProduct.name,
      category_id: editingProduct.category_id,
      cost_price: editingProduct.cost_price,
      selling_price: editingProduct.selling_price,
      stock: editingProduct.stock,
      barcode: editingProduct.barcode,
    });
    if (ok) { setIsEditDialogOpen(false); setEditingProduct(null); }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const ok = await addCategory(newCategoryName.trim());
    if (ok) setNewCategoryName('');
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category? Products in this category will become uncategorized.')) return;
    await deleteCategory(id);
  };

  const handleBarcodeScan = (code: string) => {
    if (barcodeScanTarget === 'add') {
      setNewProduct({ ...newProduct, barcode: code });
    } else {
      if (editingProduct) setEditingProduct({ ...editingProduct, barcode: code });
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product inventory</p>
        </div>
        <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)}><Tag className="h-4 w-4 mr-2" />Categories</Button>
        <Button onClick={() => setIsAddDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Product</Button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            {categoryNames.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading products...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                  </div>
                  <Badge variant={product.stock <= lowStockThreshold ? 'destructive' : 'secondary'}>{product.stock} in stock</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Category:</span><span>{categoryName(product) || 'Uncategorized'}</span></div>
                  {product.barcode && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Barcode:</span><span className="font-mono text-xs">{product.barcode}</span></div>}
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Cost Price:</span><span>{formatCurrency(product.cost_price)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Selling Price:</span><span className="font-bold">{formatCurrency(product.selling_price)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Profit:</span><span className="text-green-600">{formatCurrency(product.selling_price - product.cost_price)}</span></div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditingProduct(product); setIsEditDialogOpen(true); }}>
                    <Edit className="h-4 w-4 mr-1" />Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setLabelProduct(product)}>
                    <Barcode className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDeleteProduct(product.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {deleteError && <p className="text-red-500 mt-4">{deleteError}</p>}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Product</DialogTitle><DialogDescription>Add a new product to your inventory.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Product Name</Label><Input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Enter product name" /></div>
            <div className="grid gap-2"><Label>Category</Label>
              <Select value={newProduct.category_id} onValueChange={(v) => setNewProduct({ ...newProduct, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{categories.map((cat) => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Cost Price (GHS)</Label><Input type="number" value={newProduct.cost_price || ''} onChange={(e) => setNewProduct({ ...newProduct, cost_price: Number(e.target.value) })} /></div>
              <div className="grid gap-2"><Label>Selling Price (GHS)</Label><Input type="number" value={newProduct.selling_price || ''} onChange={(e) => setNewProduct({ ...newProduct, selling_price: Number(e.target.value) })} /></div>
            </div>
            <div className="grid gap-2"><Label>Initial Stock</Label><Input type="number" value={newProduct.stock || ''} onChange={(e) => setNewProduct({ ...newProduct, stock: Number(e.target.value) })} /></div>
            <div className="grid gap-2"><Label>Barcode</Label>
              <div className="flex gap-2">
                {newProduct.barcode ? (
                  <div className="flex items-center gap-2 flex-1 border rounded-md px-3 py-2 text-sm">
                    <Barcode className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-xs flex-1">{newProduct.barcode}</span>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setNewProduct({ ...newProduct, barcode: '' })}>Remove</Button>
                  </div>
                ) : (
                  <Button variant="outline" className="flex-1" onClick={() => { setBarcodeScanTarget('add'); setIsBarcodeScannerOpen(true); }}>
                    <ScanBarcode className="h-4 w-4 mr-2" />Scan Barcode
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2"><Label>Quantity / Measure</Label><Input value={newProduct.measurement_unit} onChange={(e) => setNewProduct({ ...newProduct, measurement_unit: e.target.value })} placeholder="e.g. 500g" /></div>
              <div className="grid gap-2"><Label>Quantity in box</Label><Input type="number" value={newProduct.pack_quantity || ''} onChange={(e) => setNewProduct({ ...newProduct, pack_quantity: Number(e.target.value) })} placeholder="e.g. 60" /></div>
              <div className="grid gap-2 md:col-span-2"><Label>Unit cost price (GHS)</Label><Input type="number" step="0.01" value={newProduct.unit_cost || ''} onChange={(e) => setNewProduct({ ...newProduct, unit_cost: Number(e.target.value) })} placeholder="e.g. 4.50" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddProduct}>Add Product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Product</DialogTitle><DialogDescription>Update product details.</DialogDescription></DialogHeader>
          {editingProduct && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2"><Label>Product Name</Label><Input value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Category</Label>
                <Select value={editingProduct.category_id || ''} onValueChange={(v) => setEditingProduct({ ...editingProduct, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{categories.map((cat) => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Cost Price (GHS)</Label><Input type="number" value={editingProduct.cost_price} onChange={(e) => setEditingProduct({ ...editingProduct, cost_price: Number(e.target.value) })} /></div>
                <div className="grid gap-2"><Label>Selling Price (GHS)</Label><Input type="number" value={editingProduct.selling_price} onChange={(e) => setEditingProduct({ ...editingProduct, selling_price: Number(e.target.value) })} /></div>
              </div>
              <div className="grid gap-2"><Label>Stock</Label><Input type="number" value={editingProduct.stock} onChange={(e) => setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })} /></div>
              <div className="grid gap-2"><Label>Barcode</Label>
                <div className="flex gap-2">
                  {editingProduct.barcode ? (
                    <div className="flex items-center gap-2 flex-1 border rounded-md px-3 py-2 text-sm">
                      <Barcode className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-xs flex-1">{editingProduct.barcode}</span>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setEditingProduct({ ...editingProduct, barcode: null })}>Remove</Button>
                    </div>
                  ) : (
                    <Button variant="outline" className="flex-1" onClick={() => { setBarcodeScanTarget('edit'); setIsBarcodeScannerOpen(true); }}>
                      <ScanBarcode className="h-4 w-4 mr-2" />Scan Barcode
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditProduct}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage Categories</DialogTitle><DialogDescription>Add or remove product categories.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category name" onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()} />
              <Button onClick={handleAddCategory} disabled={!newCategoryName.trim()}>Add</Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-auto">
              {categories.length === 0 && <p className="text-sm text-muted-foreground">No categories yet</p>}
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <span className="font-medium">{cat.name}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteCategory(cat.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCategoryDialogOpen(false); setNewCategoryName(''); }}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BarcodeLabel
        open={!!labelProduct}
        onClose={() => setLabelProduct(null)}
        product={labelProduct ? { name: labelProduct.name, barcode: labelProduct.barcode, price: labelProduct.selling_price } : null}
      />

      <QRScanner open={isBarcodeScannerOpen} onClose={() => setIsBarcodeScannerOpen(false)} onScan={handleBarcodeScan} />
    </div>
  );
}
