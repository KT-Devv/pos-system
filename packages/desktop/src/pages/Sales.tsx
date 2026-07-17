import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Smartphone, Banknote, Receipt, ScanBarcode } from 'lucide-react';
import { Button } from '@pos/shared/components/button';
import { Input } from '@pos/shared/components/input';
import { Card, CardContent, CardHeader, CardTitle } from '@pos/shared/components/card';
import { Badge } from '@pos/shared/components/badge';
import { Label } from '@pos/shared/components/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@pos/shared/components/dialog';
import { formatCurrency } from '@pos/shared/lib/utils';
import type { CartItem, Product } from '@pos/shared/types';
import { api } from '@/lib/ipc';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/hooks/useSettings';
import { useCreateSale } from '@/hooks/useSales';
import QRScanner from '@/components/QRScanner';

type PaymentMethod = 'cash' | 'momo' | 'card';

export default function Sales() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const cashierId = user?.id || null;
  const lowStockThreshold = settings.lowStockThreshold;

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    settings.cashEnabled ? 'cash' : settings.momoEnabled ? 'momo' : 'card'
  );
  const [showReceipt, setShowReceipt] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [saleDetail, setSaleDetail] = useState<{
    id: string; total: number; discount: number; payment_method: string; created_at: string; cashier_name: string;
    items: Array<{ product_name: string; quantity: number; price: number }>;
  } | null>(null);
  const { createSale, creating, error: saleError } = useCreateSale();
  const barcodeRef = useRef<HTMLInputElement>(null);

  const fetchProducts = useCallback(async () => {
    setProductsError(null);
    try {
      const data = await api.products.list() as Product[];
      setProducts(data || []);
    } catch (err) {
      setProductsError(err instanceof Error ? err.message : 'Failed to load products');
      setProducts([]);
    }
    setProductsLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2' && barcodeRef.current) {
        e.preventDefault();
        barcodeRef.current.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleBarcodeSearch = async () => {
    if (!barcodeInput.trim()) return;
    setCheckoutError(null);
    try {
      const product = await api.products.getByBarcode(barcodeInput.trim()) as Product | null;
      if (product) {
        addToCart(product);
        setBarcodeInput('');
      } else {
        setCheckoutError('No product found for this barcode');
      }
    } catch {
      setCheckoutError('Barcode lookup failed');
    }
  };

  const handleCameraScan = async (code: string) => {
    setCheckoutError(null);
    try {
      const product = await api.products.getByBarcode(code) as Product | null;
      if (product) {
        addToCart(product);
      } else {
        setCheckoutError(`No product found for barcode: ${code}`);
      }
    } catch {
      setCheckoutError('Barcode lookup failed');
    }
  };

  const getAvailableStock = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    const inCart = cart.find((c) => c.product.id === productId)?.quantity || 0;
    return (product?.stock ?? 0) - inCart;
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) { setCheckoutError('This product is out of stock'); return; }
    const available = getAvailableStock(product.id);
    if (available <= 0) { setCheckoutError('Cannot add more than available stock'); return; }
    setCheckoutError(null);
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      setCart(cart.map((item) =>
        item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, change: number) => {
    setCheckoutError(null);
    setCart(cart.map((item) => {
      if (item.product.id !== productId) return item;
      const newQty = item.quantity + change;
      if (newQty <= 0) return item;
      const maxQty = products.find((p) => p.id === productId)?.stock ?? 0;
      if (newQty > maxQty) { setCheckoutError(`Only ${maxQty} units available`); return item; }
      return { ...item, quantity: newQty };
    }).filter((item) => item.quantity > 0));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.product.selling_price * item.quantity, 0);
  const clampedDiscount = Math.max(0, Math.min(discount, subtotal));
  const total = subtotal - clampedDiscount;

  const completeSale = async () => {
    if (cart.length === 0) return;
    if (!cashierId) { setCheckoutError('No cashier profile found.'); return; }
    if (total < 0) { setCheckoutError('Invalid total amount'); return; }
    setCheckoutError(null);
    const sale = await createSale(
      cashierId,
      cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        price: item.product.selling_price,
        cost_price: item.product.cost_price,
      })),
      total, clampedDiscount, paymentMethod
    );
    if (sale) {
      const saleId = (sale as { id: string }).id;
      setLastSaleId(saleId);
      await fetchProducts();
      setShowReceipt(true);
    }
  };

  const viewSaleDetail = async (saleId: string) => {
    try {
      const detail = await api.sales.getWithItems(saleId) as {
        id: string; total: number; discount: number; payment_method: string; created_at: string; cashier_name: string;
        items: Array<{ product_name: string; quantity: number; price: number }>;
      } | null;
      if (detail) { setSaleDetail(detail); setIsDetailOpen(true); }
    } catch {
      setCheckoutError('Failed to load sale details');
    }
  };

  const resetSale = () => {
    setCart([]);
    setDiscount(0);
    setPaymentMethod(settings.cashEnabled ? 'cash' : settings.momoEnabled ? 'momo' : 'card');
    setShowReceipt(false);
    setCheckoutError(null);
    setLastSaleId(null);
  };

  const displayError = checkoutError || saleError;

  if (showReceipt) {
    return (
      <div className="p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center border-b">
            <CardTitle className="text-2xl">{settings.receiptHeader || settings.shopName}</CardTitle>
            <p className="text-muted-foreground">Receipt</p>
            <p className="text-sm text-muted-foreground">{new Date().toLocaleString()}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.product.id} className="flex justify-between">
                  <span>{item.product.name} x{item.quantity}</span>
                  <span>{formatCurrency(item.product.selling_price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 space-y-1">
              <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(subtotal)}</span></div>
              {clampedDiscount > 0 && (
                <div className="flex justify-between text-green-600"><span>Discount:</span><span>-{formatCurrency(clampedDiscount)}</span></div>
              )}
              <div className="flex justify-between font-bold text-lg"><span>Total:</span><span>{formatCurrency(total)}</span></div>
            </div>
            <div className="border-t pt-2"><p className="text-sm text-muted-foreground">Payment Method: {paymentMethod.toUpperCase()}</p></div>
            <div className="text-center text-sm text-muted-foreground border-t pt-4">
              <p>{settings.receiptFooter}</p>
              {settings.receiptNote && <p>{settings.receiptNote}</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={resetSale}>New Sale</Button>
              {lastSaleId && <Button variant="outline" className="flex-1" onClick={() => viewSaleDetail(lastSaleId)}>View Details</Button>}
            </div>
          </CardContent>
        </Card>

        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Sale Details</DialogTitle>
              <DialogDescription>Sale #{saleDetail?.id?.slice(0, 8)}</DialogDescription>
            </DialogHeader>
            {saleDetail && (
              <div className="space-y-4">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Date:</span><span>{new Date(saleDetail.created_at).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Cashier:</span><span>{saleDetail.cashier_name}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Payment:</span><span>{saleDetail.payment_method.toUpperCase()}</span></div>
                <div className="border-t pt-3 space-y-2">
                  {saleDetail.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{item.product_name} x{item.quantity}</span>
                      <span>{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-3 space-y-1">
                  <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(saleDetail.items.reduce((s, i) => s + i.price * i.quantity, 0))}</span></div>
                  {saleDetail.discount > 0 && <div className="flex justify-between text-green-600"><span>Discount:</span><span>-{formatCurrency(saleDetail.discount)}</span></div>}
                  <div className="flex justify-between font-bold text-lg"><span>Total:</span><span>{formatCurrency(saleDetail.total)}</span></div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (productsLoading) return <div className="p-6"><p className="text-muted-foreground">Loading products...</p></div>;
  if (productsError) return <div className="p-6"><p className="text-red-500">{productsError}</p></div>;

  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const paymentOptions: { method: PaymentMethod; label: string; icon: typeof Banknote; enabled: boolean }[] = [
    { method: 'cash', label: 'Cash', icon: Banknote, enabled: settings.cashEnabled },
    { method: 'momo', label: 'MoMo', icon: Smartphone, enabled: settings.momoEnabled },
    { method: 'card', label: 'Card', icon: CreditCard, enabled: settings.cardEnabled },
  ];

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Point of Sale</h1>
          <p className="text-muted-foreground">Select products to add to cart</p>
        </div>
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="flex gap-2">
            <Input ref={barcodeRef} placeholder="Scan barcode (F2)" value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSearch()}
              className="w-48" />
            <Button variant="outline" onClick={handleBarcodeSearch}><ScanBarcode className="h-4 w-4 mr-1" />Lookup</Button>
            <Button variant="outline" onClick={() => setIsScannerOpen(true)}><ScanBarcode className="h-4 w-4 mr-1" />Scan</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${product.stock === 0 ? 'opacity-50' : ''}`}
              onClick={() => product.stock > 0 && addToCart(product)}
            >
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="w-16 h-16 bg-muted rounded-lg mx-auto mb-3 flex items-center justify-center">
                    <span className="text-2xl">📦</span>
                  </div>
                  <h3 className="font-medium">{product.name}</h3>
                  <p className="text-lg font-bold text-primary mt-1">{formatCurrency(product.selling_price)}</p>
                  <Badge variant={product.stock <= lowStockThreshold ? 'destructive' : 'secondary'} className="mt-2">
                    {product.stock} in stock
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="w-96 bg-background border-l p-6 flex flex-col">
        <div className="mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Cart</h2>
          <p className="text-sm text-muted-foreground">{cart.length} item(s)</p>
        </div>

        {displayError && <p className="text-sm text-red-500 mb-3">{displayError}</p>}

        <div className="flex-1 overflow-auto space-y-3 mb-4">
          {cart.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Cart is empty</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="border rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium">{item.product.name}</h4>
                    <p className="text-sm text-muted-foreground">{formatCurrency(item.product.selling_price)} each</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFromCart(item.product.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, -1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="font-bold">{formatCurrency(item.product.selling_price * item.quantity)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t pt-4 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between items-center">
                <Label htmlFor="discount">Discount:</Label>
                <Input id="discount" type="number" min={0} max={subtotal} value={discount || ''}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))} className="w-24 text-right" placeholder="0" />
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Total:</span><span>{formatCurrency(total)}</span></div>
            </div>
            <div>
              <Label className="mb-2 block">Payment Method</Label>
              <div className="grid grid-cols-3 gap-2">
                {paymentOptions.filter((p) => p.enabled).map(({ method, label, icon: Icon }) => (
                  <Button key={method} variant={paymentMethod === method ? 'default' : 'outline'}
                    onClick={() => setPaymentMethod(method)} className="flex flex-col h-auto py-3">
                    <Icon className="h-5 w-5 mb-1" /><span className="text-xs">{label}</span>
                  </Button>
                ))}
              </div>
            </div>
            <Button className="w-full" size="lg" onClick={completeSale} disabled={creating || !cashierId || total < 0}>
              <Receipt className="h-5 w-5 mr-2" />{creating ? 'Processing...' : 'Complete Sale'}
            </Button>
          </div>
        )}
      </div>
      <QRScanner open={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={handleCameraScan} />
    </div>
  );
}
