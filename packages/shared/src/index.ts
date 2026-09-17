// Components
export { Button } from "./components/button";
export type { ButtonProps } from "./components/button";

export { Input } from "./components/input";
export type { InputProps } from "./components/input";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./components/card";

export { Badge } from "./components/badge";

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/dialog";

export { Label } from "./components/label";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "./components/table";

export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs";

export { Alert, AlertTitle, AlertDescription } from "./components/alert";

export { Textarea } from "./components/textarea";

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./components/select";

export { Switch } from "./components/switch";

// Utils
export {
  cn,
  formatCurrency,
  formatDate,
  formatDateTime,
  generateId,
} from "./lib/utils";

// Types
export type {
  User,
  Category,
  Product,
  ProductWithCategory,
  Sale,
  SaleItem,
  SaleWithItems,
  Supplier,
  StockHistory,
  StockHistoryWithDetails,
  Expense,
  Customer,
  CartItem,
  DailySales,
  DailyProfit,
  PaymentMethod,
  UserRole,
} from "./types";

export type {
  User as DomainUser,
  Category as DomainCategory,
  Product as DomainProduct,
  Customer as DomainCustomer,
  Supplier as DomainSupplier,
  SaleLine,
  Sale as DomainSale,
  StockMovement,
  CreateSaleInput,
  ProductInput,
  PaymentMethod as DomainPaymentMethod,
  StockMovementType,
} from "./domain";

export {
  calculateSaleTotal,
  roundCurrency,
  validateProductInput,
  validateSaleInput,
} from "./domain";
