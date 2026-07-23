import { useState, useEffect } from "react";
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
} from "lucide-react";
import { Button } from "@pos/shared/components/button";
import { Input } from "@pos/shared/components/input";
import { Card, CardContent, CardHeader, CardTitle } from "@pos/shared/components/card";
import { Badge } from "@pos/shared/components/badge";
import { Label } from "@pos/shared/components/label";
import { formatCurrency } from "@pos/shared/lib/utils";
import type { CartItem, Product } from "@pos/shared/types";
import { supabase } from "../lib/supabase";
import { useCreateSale } from "../hooks/useSales";
import { useAuth } from "../contexts/AuthContext";

type PaymentMethod = "cash" | "momo" | "card";

export default function Sales() {
  const { profile } = useAuth();
  const cashierId = profile?.id || null;
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [showReceipt, setShowReceipt] = useState(false);
  const { createSale, creating } = useCreateSale();

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .order("name");
      setProducts(data || []);
      setProductsLoading(false);
    };
    fetchProducts();
  }, []);

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase())
  );

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
    if (!cashierId) {
      alert("No cashier user found. Please add a user in the database first.");
      return;
    }

    const sale = await createSale(
      cashierId,
      cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        price: item.product.selling_price,
        cost_price: item.product.cost_price,
      })),
      total,
      discount,
      paymentMethod
    );

    if (sale) {
      setShowReceipt(true);
    }
  };

  const resetSale = () => {
    setCart([]);
    setDiscount(0);
    setPaymentMethod("cash");
    setShowReceipt(false);
  };

  if (showReceipt) {
    return (
      <div className="p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center border-b">
            <CardTitle className="text-2xl">Mom's Shop</CardTitle>
            <p className="text-muted-foreground">Receipt</p>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleString()}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.product.id} className="flex justify-between">
                  <span>
                    {item.product.name} x{item.quantity}
                  </span>
                  <span>{formatCurrency(item.product.selling_price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 space-y-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount:</span>
                  <span>-{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
            <div className="border-t pt-2">
              <p className="text-sm text-muted-foreground">
                Payment Method: {paymentMethod.toUpperCase()}
              </p>
            </div>
            <div className="text-center text-sm text-muted-foreground border-t pt-4">
              <p>Thank you for your purchase!</p>
              <p>See you again soon!</p>
            </div>
            <Button className="w-full" onClick={resetSale}>
              New Sale
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (productsLoading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading products...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Point of Sale</h1>
          <p className="text-muted-foreground">Select products to add to cart</p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => addToCart(product)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
                  e.preventDefault();
                  addToCart(product);
                }
              }}
              aria-label={`Add ${product.name} to cart`}
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
                  <Badge variant={product.stock < 10 ? "destructive" : "secondary"} className="mt-2">
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
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Cart
          </h2>
          <p className="text-sm text-muted-foreground">
            {cart.length} item(s)
          </p>
        </div>

        <div className="flex-1 overflow-auto space-y-3 mb-4">
          {cart.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Cart is empty</p>
              <p className="text-sm">Click products to add</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="border rounded-lg p-3"
              >
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
                    aria-label={`Remove ${item.product.name} from cart`}
                    type="button"
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
                      aria-label={`Decrease quantity for ${item.product.name}`}
                      type="button"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-medium">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(item.product.id, 1)}
                      aria-label={`Increase quantity for ${item.product.name}`}
                      type="button"
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
                  value={discount === 0 ? "" : discount}
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

            <div>
              <Label className="mb-2 block">Payment Method</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={paymentMethod === "cash" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("cash")}
                  className="flex flex-col h-auto py-3"
                >
                  <Banknote className="h-5 w-5 mb-1" />
                  <span className="text-xs">Cash</span>
                </Button>
                <Button
                  variant={paymentMethod === "momo" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("momo")}
                  className="flex flex-col h-auto py-3"
                >
                  <Smartphone className="h-5 w-5 mb-1" />
                  <span className="text-xs">MoMo</span>
                </Button>
                <Button
                  variant={paymentMethod === "card" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("card")}
                  className="flex flex-col h-auto py-3"
                >
                  <CreditCard className="h-5 w-5 mb-1" />
                  <span className="text-xs">Card</span>
                </Button>
              </div>
            </div>

            <Button className="w-full" size="lg" onClick={completeSale} disabled={creating || !cashierId}>
              <Receipt className="h-5 w-5 mr-2" />
              {creating ? "Processing..." : "Complete Sale"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
