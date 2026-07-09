import { useState } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@pos/shared/components/card';
import { Badge } from '@pos/shared/components/badge';
import { Label } from '@pos/shared/components/label';
import { formatCurrency } from '@pos/shared/lib/utils';
import { api } from '../lib/ipc';
import type { CartItem, Product } from '@pos/shared/types';
import QRScanner from '../components/QRScanner';
import ReceiptPreview from '../components/ReceiptPreview';
import type { ReceiptData } from '../hooks/useReceipt';

export default function Sales() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'momo' | 'card'>('cash');
  const [showScanner, setShowScanner] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [lastSaleId, setLastSaleId] = useState<string>('');

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
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + change }
            : item
        )
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
  const total = subtotal - discount;

  const completeSale = async () => {
    if (cart.length === 0) return;

    try {
      const sale = await api.sales.create({
        cashier_id: 'admin',
        total,
        discount,
        payment_method: paymentMethod,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          price: item.product.selling_price,
          cost_price: item.product.cost_price,
        })),
      });

      const settings = await api.settings.get();
      const saleData = sale as any;

      setReceiptData({
        shopName: settings.shop_name || "Mom's Shop",
        shopPhone: settings.shop_phone || '',
        shopAddress: settings.shop_address || '',
        items: cart.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.selling_price * item.quantity,
        })),
        subtotal,
        discount,
        total,
        paymentMethod,
        cashierName: 'Admin',
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
    <div className="flex h-full">
      {/* Products Section */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Point of Sale</h1>
          <p className="text-muted-foreground">Select products or scan barcode to add to cart</p>
        </div>

        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => setShowScanner(true)} variant="outline">
            <ScanBarcode className="h-4 w-4 mr-2" />
            Scan
          </Button>
        </div>

        {/* Search Results */}
        {products.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Search Results</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:shadow-md transition-shadow border-primary"
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-4 text-center">
                    <h3 className="font-medium">{product.name}</h3>
                    <p className="text-lg font-bold text-primary mt-1">
                      {formatCurrency(product.selling_price)}
                    </p>
                    <Badge variant={product.stock < 10 ? 'destructive' : 'secondary'} className="mt-2">
                      {product.stock} in stock
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Quick Product Grid */}
        <h3 className="text-sm font-medium text-muted-foreground mb-2">All Products</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <QuickProducts onSelect={addToCart} />
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-96 bg-background border-l p-6 flex flex-col">
        <div className="mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Cart
          </h2>
          <p className="text-sm text-muted-foreground">{cart.length} item(s)</p>
        </div>

        <div className="flex-1 overflow-auto space-y-3 mb-4">
          {cart.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Cart is empty</p>
              <p className="text-sm">Click products or scan barcode</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="border rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium">{item.product.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(item.product.selling_price)} each
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeFromCart(item.product.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(item.product.id, -1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <Button
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
          <div className="border-t pt-4 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <Label htmlFor="discount">Discount:</Label>
                <Input
                  id="discount"
                  type="number"
                  value={discount || ''}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-24 text-right"
                  placeholder="0"
                />
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <Label className="mb-2 block">Payment Method</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('cash')}
                  className="flex flex-col h-auto py-3"
                >
                  <Banknote className="h-5 w-5 mb-1" />
                  <span className="text-xs">Cash</span>
                </Button>
                <Button
                  variant={paymentMethod === 'momo' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('momo')}
                  className="flex flex-col h-auto py-3"
                >
                  <Smartphone className="h-5 w-5 mb-1" />
                  <span className="text-xs">MoMo</span>
                </Button>
                <Button
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('card')}
                  className="flex flex-col h-auto py-3"
                >
                  <CreditCard className="h-5 w-5 mb-1" />
                  <span className="text-xs">Card</span>
                </Button>
              </div>
            </div>

            <Button className="w-full" size="lg" onClick={completeSale}>
              <Receipt className="h-5 w-5 mr-2" />
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

  useState(() => {
    api.products.list().then((data) => setProducts(data as Product[]));
  });

  return (
    <>
      {products.map((product) => (
        <Card
          key={product.id}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onSelect(product)}
        >
          <CardContent className="p-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-muted rounded-lg mx-auto mb-3 flex items-center justify-center">
                <span className="text-2xl">📦</span>
              </div>
              <h3 className="font-medium">{product.name}</h3>
              <p className="text-lg font-bold text-primary mt-1">
                {formatCurrency(product.selling_price)}
              </p>
              <Badge variant={product.stock < 10 ? 'destructive' : 'secondary'} className="mt-2">
                {product.stock} in stock
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
