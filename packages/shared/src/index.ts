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

export { Logo } from "./components/logo";
export type { LogoProps } from "./components/logo";

export { Avatar } from "./components/avatar";
export type { AvatarProps } from "./components/avatar";

export { SegmentedControl } from "./components/segmented-control";
export type { SegmentedControlProps, SegmentedOption } from "./components/segmented-control";

export { PageHeader } from "./components/page-header";
export type { PageHeaderProps } from "./components/page-header";

export { StatCard } from "./components/stat-card";
export type { StatCardProps } from "./components/stat-card";

export { EmptyState, Skeleton } from "./components/empty-state";
export type { EmptyStateProps } from "./components/empty-state";

// Utils
export {
  cn,
  configureMoney,
  currencyDecimals,
  currencySymbol,
  formatCompact,
  formatCurrency,
  getMoneyConfig,
  formatDate,
  formatDateTime,
  generateId,
  initials,
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

export {
  barcodeCandidates,
  barcodeFromScan,
  barcodesMatch,
  canEncodeCode128,
  code128Bars,
  code128Modules,
  CODE128_MAX_LENGTH,
  CODE128_QUIET_ZONE,
  ean13CheckDigit,
  findByBarcode,
  generateInternalBarcode,
  isValidEan13,
  normalizeBarcode,
} from "./domain/barcode";
export type { BarcodeBar } from "./domain/barcode";

export { buildReceipt, receiptReference } from "./domain/receipt";
export type { BuildReceiptInput, Receipt, ReceiptLine, ReceiptLineInput, ReceiptShop } from "./domain/receipt";

export {
  buildRevenueBuckets,
  rangeStart,
  startOfDay,
  summarizeSales,
  WEEKLY_AFTER_DAYS,
} from "./domain/reports";
export type {
  PaymentTotal,
  ReportLine,
  ReportRange,
  ReportSale,
  RevenueBucket,
  SalesSummary,
  TopProduct,
} from "./domain/reports";

export {
  COUNTRIES,
  CURRENCIES,
  currencyForCountry,
  currencyName,
  isSupportedCurrency,
} from "./domain/currencies";
export type { CountryInfo, CurrencyInfo } from "./domain/currencies";

export {
  canManageShop,
  canManageTeam,
  canRemoveMember,
  invitableRoles,
  loyaltyPointsFor,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  SHOP_NAME_MAX,
  SHOP_NAME_MIN,
  SHOP_ROLES,
  stockLevel,
  validateShopInput,
} from "./domain/shop";
export type { ShopInput, ShopRole } from "./domain/shop";
