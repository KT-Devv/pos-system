import { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Smartphone,
  Banknote,
  Receipt,
  ScanBarcode,
} from 'lucide-react';
import { Button } from '@pos/shared/components/button';
import { Input } from '@pos/shared/components/input';
import { Card, CardContent } from '@pos/shared/components/card';
import { Badge } from '@pos/shared/components/badge';
import { Label } from '@pos/shared/components/label';
import { formatCurrency, cn } from '@pos/shared/lib/utils';
import { api } from '../lib/ipc';
import type { CartItem, Product } from '@pos/shared/types';
import QRScanner from '../components/QRScanner';
import ReceiptPreview from '../components/ReceiptPreview';
import type { ReceiptData } from '../hooks/useReceipt';
import { useAuth } from '../contexts/AuthContext';

export default function Sales() {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'momo' | 'card'>('cash');
  const [showScanner, setShowScanner] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [_lastSaleId, setLastSaleId] = useState<string>('');
  const handleSearch = async (value: string) => {
    setSearch(value);
    if (value.trim()) {
      const results = await api.products.list(value);
      setProducts(results as Product[]);
    } else {
      setProducts([]);
    }
  };

  const handleScan = async (code: string) => {
    const product = await api.products.getByBarcode(code);
    if (product) {
      addToCart(product as Product);
    } else {
      alert(`No product found with code: ${code}`);
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert('This product is out of stock');
      return;
    }
    const inCart = cart.find((item) => item.product.id === product.id)?.quantity || 0;
    if (inCart >= product.stock) {
      alert('Cannot add more than available stock');
      return;
    }
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
    setSearch('');
    setProducts([]);
  };

  const updateQuantity = (productId: string, change: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.product.id !== productId) return item;
          const newQty = item.quantity + change;
          if (newQty <= 0) return item;
          if (newQty > item.product.stock) {
            alert(`Only ${item.product.stock} units available`);
            return item;
          }
          return { ...item, quantity: newQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.selling_price * item.quantity,
    0
  );
  const clampedDiscount = Math.max(0, Math.min(discount, subtotal));
  const total = subtotal - clampedDiscount;

  const completeSale = async () => {
    if (cart.length === 0 || !user) return;

    try {
      const sale = await api.sales.create({
        cashier_id: user.id,
        total,
        discount: clampedDiscount,
        payment_method: paymentMethod,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          price: item.product.selling_price,
          cost_price: item.product.cost_price,
        })),
      });

      const settings = await api.settings.get() as Record<string, string>;
      const saleData = sale as { id: string };

      setReceiptData({
        shopName: settings.shop_name || "Mom's Shop",
        shopPhone: settings.shop_phone || '',
        shopAddress: settings.shop_address || '',
        receiptHeader: settings.receipt_header,
        receiptFooter: settings.receipt_footer,
        receiptNote: settings.receipt_note,
        currency: settings.currency || 'GHS',
        items: cart.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.selling_price * item.quantity,
        })),
        subtotal,
        discount: clampedDiscount,
        total,
        paymentMethod,
        cashierName: user.name,
        date: new Date().toLocaleString(),
        saleId: saleData.id,
      });
      setLastSaleId(saleData.id);
      setShowReceipt(true);
    } catch (error) {
      console.error('Sale failed:', error);
      alert('Failed to complete sale. Please try again.');
    }
  };

  const resetSale = () => {
    setCart([]);
    setDiscount(0);
    setPaymentMethod('cash');
    setShowReceipt(false);
    setReceiptData(null);
  };

  return (
    <div className="flex h-full animate-in fade-in duration-500 relative">
      {/* Products Section */}
      <div className="flex-1 p-8 overflow-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 mb-2">Point of Sale</h1>
          <p className="text-muted-foreground">Select products or scan barcode to add to cart</p>
        </div>

        <div className="flex gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-12 h-14 text-lg bg-black/20 border-white/10 focus-visible:ring-primary/50 rounded-xl shadow-inner"
            />
          </div>
          <Button onClick={() => setShowScanner(true)} variant="outline" className="h-14 px-6 rounded-xl border-white/10 hover:bg-white/10 hover:text-white transition-all">
            <ScanBarcode className="h-5 w-5 mr-2" />
            Scan
          </Button>
        </div>

        {/* Search Results */}
        {products.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              Search Results
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="glass-card cursor-pointer rounded-2xl overflow-hidden group border-primary/40 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                  role="button"
                  tabIndex={0}
                  aria-label={`Add ${product.name} to cart`}
                  onClick={() => addToCart(product)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                      e.preventDefault();
                      addToCart(product);
                    }
                  }}
                >
                  <div className="p-5 text-center">
                    <h3 className="font-semibold text-white mb-2">{product.name}</h3>
                    <p className="text-xl font-bold text-primary mb-3">
                      {formatCurrency(product.selling_price)}
                    </p>
                    <Badge variant={product.stock < 10 ? 'destructive' : 'outline'} className={cn("mt-2", product.stock >= 10 && "bg-white/5 border-white/10 text-muted-foreground")}>
                      {product.stock} in stock
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Product Grid */}
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">All Products</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <QuickProducts onSelect={addToCart} />
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-[400px] glass-panel border-l-0 border-r-0 border-y-0 md:border-l border-white/10 p-6 flex flex-col relative z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.2)]">
        <div className="mb-6 pb-4 border-b border-white/10">
          <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
            <div className="p-2 rounded-lg bg-primary/20 text-primary">
              <ShoppingCart className="h-6 w-6" />
            </div>
            Current Order
          </h2>
          <p className="text-sm text-muted-foreground mt-2">{cart.length} item(s) in cart</p>
        </div>

        <div className="flex-1 overflow-auto space-y-3 mb-6 pr-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground opacity-50">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <ShoppingCart className="h-10 w-10" />
              </div>
              <p className="text-lg font-medium">Cart is empty</p>
              <p className="text-sm">Click products or scan barcode</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="bg-black/20 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 pr-4">
                    <h4 className="font-semibold text-white leading-tight mb-1">{item.product.name}</h4>
                    <p className="text-sm text-primary font-medium">
                      {formatCurrency(item.product.selling_price)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    aria-label={`Remove ${item.product.name} from cart`}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeFromCart(item.product.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      aria-label={`Decrease quantity of ${item.product.name}`}
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(item.product.id, -1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <Button
                      type="button"
                      aria-label={`Increase quantity of ${item.product.name}`}
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(item.product.id, 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="font-bold">
                    {formatCurrency(item.product.selling_price * item.quantity)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Summary */}
        {cart.length > 0 && (
          <div className="border-t border-white/10 pt-6 space-y-5">
            <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/5">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span className="text-white">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <Label htmlFor="discount" className="text-muted-foreground">Discount:</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">GHS</span>
                  <Input
                    id="discount"
                    type="number"
                    value={discount || ''}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-28 text-right pl-8 bg-black/40 border-white/10 focus-visible:ring-primary/50"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center text-xl font-bold border-t border-white/10 pt-3 mt-3">
                <span className="text-white">Total:</span>
                <span className="text-primary text-2xl">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-white uppercase tracking-wider">Payment Method</Label>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('cash')}
                  className={cn(
                    "flex flex-col h-auto py-4 transition-all border-white/10 group shadow-lg",
                    paymentMethod === 'cash' 
                      ? "bg-primary text-white border-primary shadow-[0_0_15px_rgba(99,102,241,0.3)]" 
                      : "bg-black/20 text-muted-foreground hover:bg-white/5 hover:text-white hover:border-white/20"
                  )}
                >
                  <Banknote className={cn("h-6 w-6 mb-2 transition-transform", paymentMethod === 'cash' ? "scale-110" : "group-hover:scale-110")} />
                  <span className="text-xs font-semibold tracking-wide">Cash</span>
                </Button>
                <Button
                  variant={paymentMethod === 'momo' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('momo')}
                  className={cn(
                    "flex flex-col h-auto py-4 transition-all border-white/10 group shadow-lg",
                    paymentMethod === 'momo' 
                      ? "bg-[#d82d8b] text-white border-[#d82d8b] shadow-[0_0_15px_rgba(216,45,139,0.3)]" 
                      : "bg-black/20 text-muted-foreground hover:bg-white/5 hover:text-white hover:border-white/20"
                  )}
                >
                  <Smartphone className={cn("h-6 w-6 mb-2 transition-transform", paymentMethod === 'momo' ? "scale-110" : "group-hover:scale-110")} />
                  <span className="text-xs font-semibold tracking-wide">MoMo</span>
                </Button>
                <Button
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('card')}
                  className={cn(
                    "flex flex-col h-auto py-4 transition-all border-white/10 group shadow-lg",
                    paymentMethod === 'card' 
                      ? "bg-info text-white border-info shadow-[0_0_15px_rgba(59,130,246,0.3)]" 
                      : "bg-black/20 text-muted-foreground hover:bg-white/5 hover:text-white hover:border-white/20"
                  )}
                >
                  <CreditCard className={cn("h-6 w-6 mb-2 transition-transform", paymentMethod === 'card' ? "scale-110" : "group-hover:scale-110")} />
                  <span className="text-xs font-semibold tracking-wide">Card</span>
                </Button>
              </div>
            </div>

            <Button 
              className="w-full h-14 text-lg font-bold shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.4)] transition-all bg-gradient-to-r from-primary to-purple-600 border-0" 
              onClick={completeSale}
            >
              <Receipt className="h-5 w-5 mr-2 animate-pulse" />
              Complete Sale
            </Button>
          </div>
        )}
      </div>

      {/* QR Scanner Modal */}
      <QRScanner open={showScanner} onClose={() => setShowScanner(false)} onScan={handleScan} />

      {/* Receipt Preview Modal */}
      <ReceiptPreview
        open={showReceipt}
        onClose={resetSale}
        data={receiptData}
      />
    </div>
  );
}

// Quick Products Component (loads all products for grid view)
function QuickProducts({ onSelect }: { onSelect: (product: Product) => void }) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    api.products.list().then((data: Product[]) => setProducts(data));
  }, []);

  return (
    <>
      {products.map((product) => (
        <div
          key={product.id}
          className="glass-card cursor-pointer rounded-2xl overflow-hidden group border-white/5 hover:border-primary/40 shadow-lg"
          role="button"
          tabIndex={0}
          aria-label={`Add ${product.name} to cart`}
          onClick={() => onSelect(product)}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
              e.preventDefault();
              onSelect(product);
            }
          }}
        >
          <div className="p-5">
            <div className="text-center">
              <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-xl mx-auto mb-4 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <span className="text-2xl group-hover:scale-110 transition-transform">📦</span>
              </div>
              <h3 className="font-semibold text-white mb-1 line-clamp-1">{product.name}</h3>
              <p className="text-primary font-bold">{formatCurrency(product.selling_price)}</p>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
