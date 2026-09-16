import { useState, useCallback, useEffect } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  Loader2,
  Barcode,
  ScanBarcode,
  Printer,
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
import { getLowStockThreshold } from "../lib/settings";
import QRScanner from "../components/QRScanner";
import BarcodeLabel from "../components/BarcodeLabel";

interface ProductFormState {
  name: string;
  category_id: string;
  cost_price: string;
  selling_price: string;
  stock: string;
  barcode: string;
}

const EMPTY_PRODUCT_FORM: ProductFormState = {
  name: "",
  category_id: "",
  cost_price: "0.00",
  selling_price: "",
  stock: "0",
  barcode: "",
};

export default function Products() {
  const { products, categories, loading, error, addProduct, updateProduct, deleteProduct } = useProducts();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editFormState, setEditFormState] = useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const [newProduct, setNewProduct] = useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Scanner & Label Dialog States
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<"add" | "edit">("add");
  const [printProduct, setPrintProduct] = useState<any>(null);

  const categoryNames = ["All", ...categories.map((c) => c.name)];

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      (product.barcode && product.barcode.toLowerCase().includes(search.toLowerCase()));
    const productCategory = product.categories?.name || "";
    const matchesCategory = selectedCategory === "All" || productCategory === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const validateProductForm = (form: ProductFormState): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Product name is required";

    const sPrice = parseFloat(form.selling_price);
    if (isNaN(sPrice) || sPrice <= 0) errors.selling_price = "Selling price must be greater than 0";

    const cPrice = parseFloat(form.cost_price);
    if (isNaN(cPrice) || cPrice < 0) errors.cost_price = "Cost price cannot be negative";

    const stockVal = parseInt(form.stock, 10);
    if (isNaN(stockVal) || stockVal < 0) errors.stock = "Stock cannot be negative";

    return errors;
  };

  const resetAddForm = useCallback(() => {
    setNewProduct(EMPTY_PRODUCT_FORM);
    setFormErrors({});
  }, []);

  const resetEditForm = useCallback(() => {
    setEditingProduct(null);
    setEditFormState(EMPTY_PRODUCT_FORM);
    setFormErrors({});
  }, []);

  useEffect(() => {
    if (!isAddDialogOpen) resetAddForm();
  }, [isAddDialogOpen, resetAddForm]);

  useEffect(() => {
    if (!isEditDialogOpen) resetEditForm();
  }, [isEditDialogOpen, resetEditForm]);

  const handleAddProduct = async () => {
    const errors = validateProductForm(newProduct);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setSubmitting(true);
    const ok = await addProduct({
      name: newProduct.name.trim(),
      category_id: newProduct.category_id || null,
      cost_price: parseFloat(newProduct.cost_price) || 0,
      selling_price: parseFloat(newProduct.selling_price),
      stock: parseInt(newProduct.stock, 10) || 0,
      barcode: newProduct.barcode.trim() || null,
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

  const handleOpenEdit = (product: any) => {
    setEditingProduct(product);
    setEditFormState({
      name: product.name,
      category_id: product.category_id || "",
      cost_price: String(product.cost_price ?? 0),
      selling_price: String(product.selling_price ?? ""),
      stock: String(product.stock ?? 0),
      barcode: product.barcode || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleEditProduct = async () => {
    if (!editingProduct) return;
    const errors = validateProductForm(editFormState);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setSubmitting(true);
    const ok = await updateProduct(editingProduct.id, {
      name: editFormState.name.trim(),
      category_id: editFormState.category_id || null,
      cost_price: parseFloat(editFormState.cost_price) || 0,
      selling_price: parseFloat(editFormState.selling_price),
      stock: parseInt(editFormState.stock, 10) || 0,
      barcode: editFormState.barcode.trim() || null,
    });
    setSubmitting(false);
    if (ok) {
      setIsEditDialogOpen(false);
    }
  };

  const handleScanResult = (code: string) => {
    if (scannerTarget === "add") {
      setNewProduct((prev) => ({ ...prev, barcode: code }));
    } else {
      setEditFormState((prev) => ({ ...prev, barcode: code }));
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog and barcode labels</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products by name or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-48">
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
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading products...
        </div>
      ) : error ? (
        <p className="text-destructive font-medium bg-destructive/10 p-4 rounded-lg">{error}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="hover:shadow-md transition-shadow flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="h-5 w-5 text-primary shrink-0" />
                    <CardTitle className="text-lg truncate">{product.name}</CardTitle>
                  </div>
                  <Badge variant={product.stock <= getLowStockThreshold() ? "destructive" : "secondary"}>
                    {product.stock} in stock
                  </Badge>
                </div>
                {product.barcode && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 font-mono bg-muted/60 px-2 py-0.5 rounded w-fit">
                    <Barcode className="h-3 w-3" />
                    {product.barcode}
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category:</span>
                    <span className="font-medium">{product.categories?.name || "Uncategorized"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost Price:</span>
                    <span>{formatCurrency(product.cost_price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Selling Price:</span>
                    <span className="font-bold text-primary">{formatCurrency(product.selling_price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profit Margin:</span>
                    <span className="text-green-600 font-medium">
                      {formatCurrency(product.selling_price - product.cost_price)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleOpenEdit(product)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    title="Print Barcode Label"
                    onClick={() => setPrintProduct({ name: product.name, barcode: product.barcode, price: product.selling_price })}
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteProduct(product.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
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
              Add a new product to your stock catalog.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="add-name">Product Name *</Label>
              <Input
                id="add-name"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                placeholder="Enter product name"
                aria-invalid={!!formErrors.name}
              />
              {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
            </div>

            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={newProduct.category_id}
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
                  value={newProduct.cost_price}
                  onChange={(e) => setNewProduct({ ...newProduct, cost_price: e.target.value })}
                  placeholder="0.00"
                  aria-invalid={!!formErrors.cost_price}
                />
                {formErrors.cost_price && <p className="text-xs text-destructive">{formErrors.cost_price}</p>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="add-selling">Selling Price (GHS) *</Label>
                <Input
                  id="add-selling"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newProduct.selling_price}
                  onChange={(e) => setNewProduct({ ...newProduct, selling_price: e.target.value })}
                  placeholder="0.00"
                  aria-invalid={!!formErrors.selling_price}
                />
                {formErrors.selling_price && <p className="text-xs text-destructive">{formErrors.selling_price}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="add-stock">Initial Stock</Label>
                <Input
                  id="add-stock"
                  type="number"
                  min="0"
                  value={newProduct.stock}
                  onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                  placeholder="0"
                  aria-invalid={!!formErrors.stock}
                />
                {formErrors.stock && <p className="text-xs text-destructive">{formErrors.stock}</p>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="add-barcode">Barcode (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="add-barcode"
                    value={newProduct.barcode}
                    onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
                    placeholder="Barcode string"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Scan Barcode"
                    onClick={() => { setScannerTarget("add"); setScannerOpen(true); }}
                  >
                    <ScanBarcode className="h-4 w-4" />
                  </Button>
                </div>
              </div>
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
            <DialogDescription>Update product details and pricing.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Product Name *</Label>
              <Input
                id="edit-name"
                value={editFormState.name}
                onChange={(e) => setEditFormState({ ...editFormState, name: e.target.value })}
                aria-invalid={!!formErrors.name}
              />
              {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
            </div>

            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={editFormState.category_id}
                onValueChange={(v) => setEditFormState({ ...editFormState, category_id: v })}
              >
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
                  value={editFormState.cost_price}
                  onChange={(e) => setEditFormState({ ...editFormState, cost_price: e.target.value })}
                  aria-invalid={!!formErrors.cost_price}
                />
                {formErrors.cost_price && <p className="text-xs text-destructive">{formErrors.cost_price}</p>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-selling">Selling Price (GHS) *</Label>
                <Input
                  id="edit-selling"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editFormState.selling_price}
                  onChange={(e) => setEditFormState({ ...editFormState, selling_price: e.target.value })}
                  aria-invalid={!!formErrors.selling_price}
                />
                {formErrors.selling_price && <p className="text-xs text-destructive">{formErrors.selling_price}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-stock">Stock</Label>
                <Input
                  id="edit-stock"
                  type="number"
                  min="0"
                  value={editFormState.stock}
                  onChange={(e) => setEditFormState({ ...editFormState, stock: e.target.value })}
                  aria-invalid={!!formErrors.stock}
                />
                {formErrors.stock && <p className="text-xs text-destructive">{formErrors.stock}</p>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-barcode">Barcode</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-barcode"
                    value={editFormState.barcode}
                    onChange={(e) => setEditFormState({ ...editFormState, barcode: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Scan Barcode"
                    onClick={() => { setScannerTarget("edit"); setScannerOpen(true); }}
                  >
                    <ScanBarcode className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditProduct} disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR & Barcode Scanner Dialog */}
      <QRScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanResult}
      />

      {/* Printable Barcode Label Dialog */}
      <BarcodeLabel
        open={!!printProduct}
        onClose={() => setPrintProduct(null)}
        product={printProduct}
      />
    </div>
  );
}
