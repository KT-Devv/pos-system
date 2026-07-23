import { useState, useCallback, useEffect } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  Loader2,
} from "lucide-react";
import { Button } from "@pos/shared/components/button";
import { Input } from "@pos/shared/components/input";
import { Card, CardContent, CardHeader, CardTitle } from "@pos/shared/components/card";
import { Badge } from "@pos/shared/components/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@pos/shared/components/dialog";
import { Label } from "@pos/shared/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pos/shared/components/select";
import { formatCurrency } from "@pos/shared/lib/utils";
import { useProducts } from "../hooks/useProducts";

const EMPTY_PRODUCT = { name: "", category_id: "", cost_price: 0, selling_price: 0, stock: 0 };

export default function Products() {
  const { products, categories, loading, error, addProduct, updateProduct, deleteProduct } = useProducts();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [newProduct, setNewProduct] = useState(EMPTY_PRODUCT);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const categoryNames = ["All", ...categories.map((c) => c.name)];

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase());
    const productCategory = product.categories?.name || "";
    const matchesCategory = selectedCategory === "All" || productCategory === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const validateProduct = (product: typeof EMPTY_PRODUCT): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!product.name.trim()) errors.name = "Product name is required";
    if (!product.selling_price || product.selling_price <= 0) errors.selling_price = "Selling price must be greater than 0";
    if (product.cost_price < 0) errors.cost_price = "Cost price cannot be negative";
    if (product.stock < 0) errors.stock = "Stock cannot be negative";
    return errors;
  };

  const resetAddForm = useCallback(() => {
    setNewProduct(EMPTY_PRODUCT);
    setFormErrors({});
  }, []);

  const resetEditForm = useCallback(() => {
    setEditingProduct(null);
    setFormErrors({});
  }, []);

  useEffect(() => {
    if (!isAddDialogOpen) resetAddForm();
  }, [isAddDialogOpen, resetAddForm]);

  useEffect(() => {
    if (!isEditDialogOpen) resetEditForm();
  }, [isEditDialogOpen, resetEditForm]);

  const handleAddProduct = async () => {
    const errors = validateProduct(newProduct);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setSubmitting(true);
    const ok = await addProduct({
      name: newProduct.name,
      category_id: newProduct.category_id || null,
      cost_price: newProduct.cost_price,
      selling_price: newProduct.selling_price,
      stock: newProduct.stock,
    });
    setSubmitting(false);
    if (ok) {
      setIsAddDialogOpen(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      await deleteProduct(id);
    }
  };

  const handleEditProduct = async () => {
    if (!editingProduct) return;
    const errors = validateProduct(editingProduct);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setSubmitting(true);
    const ok = await updateProduct(editingProduct.id, {
      name: editingProduct.name,
      category_id: editingProduct.category_id || null,
      cost_price: editingProduct.cost_price,
      selling_price: editingProduct.selling_price,
      barcode: editingProduct.barcode,
    });
    setSubmitting(false);
    if (ok) {
      setIsEditDialogOpen(false);
    }
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

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categoryNames.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
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
                  <Badge variant={product.stock < 10 ? "destructive" : "secondary"}>
                    {product.stock} in stock
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Category:</span>
                    <span>{product.categories?.name || "Uncategorized"}</span>
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => { setEditingProduct({ ...product }); setIsEditDialogOpen(true); }}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteProduct(product.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Product Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Add a new product to your inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-name">Product Name *</Label>
              <Input
                id="add-name"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                placeholder="Enter product name"
                className={formErrors.name ? "border-destructive" : ""}
              />
              {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={newProduct.category_id || undefined}
                onValueChange={(value) => setNewProduct({ ...newProduct, category_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="add-cost">Cost Price (GHS)</Label>
                <Input
                  id="add-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newProduct.cost_price || ""}
                  onChange={(e) => setNewProduct({ ...newProduct, cost_price: Number(e.target.value) || 0 })}
                  placeholder="0.00"
                  className={formErrors.cost_price ? "border-destructive" : ""}
                />
                {formErrors.cost_price && <p className="text-sm text-destructive">{formErrors.cost_price}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-selling">Selling Price (GHS) *</Label>
                <Input
                  id="add-selling"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newProduct.selling_price || ""}
                  onChange={(e) => setNewProduct({ ...newProduct, selling_price: Number(e.target.value) || 0 })}
                  placeholder="0.00"
                  className={formErrors.selling_price ? "border-destructive" : ""}
                />
                {formErrors.selling_price && <p className="text-sm text-destructive">{formErrors.selling_price}</p>}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-stock">Initial Stock</Label>
              <Input
                id="add-stock"
                type="number"
                min="0"
                value={newProduct.stock || ""}
                onChange={(e) => setNewProduct({ ...newProduct, stock: Number(e.target.value) || 0 })}
                placeholder="0"
                className={formErrors.stock ? "border-destructive" : ""}
              />
              {formErrors.stock && <p className="text-sm text-destructive">{formErrors.stock}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddProduct} disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...</> : "Add Product"}
            </Button>
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
                <Label htmlFor="edit-name">Product Name *</Label>
                <Input
                  id="edit-name"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className={formErrors.name ? "border-destructive" : ""}
                />
                {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
              </div>
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={editingProduct.category_id || undefined} onValueChange={(v) => setEditingProduct({ ...editingProduct, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-cost">Cost Price (GHS)</Label>
                  <Input
                    id="edit-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingProduct.cost_price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, cost_price: Number(e.target.value) || 0 })}
                    className={formErrors.cost_price ? "border-destructive" : ""}
                  />
                  {formErrors.cost_price && <p className="text-sm text-destructive">{formErrors.cost_price}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-selling">Selling Price (GHS) *</Label>
                  <Input
                    id="edit-selling"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingProduct.selling_price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, selling_price: Number(e.target.value) || 0 })}
                    className={formErrors.selling_price ? "border-destructive" : ""}
                  />
                  {formErrors.selling_price && <p className="text-sm text-destructive">{formErrors.selling_price}</p>}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditProduct} disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
