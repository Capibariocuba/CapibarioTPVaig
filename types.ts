
export enum View {
  POS = 'POS',
  DASHBOARD = 'DASHBOARD',
  INVENTORY = 'INVENTORY',
  CLIENTS = 'CLIENTS',
  CONFIGURATION = 'CONFIGURATION',
  LEDGER = 'LEDGER'
}

export enum Currency {
  CUP = 'CUP',
  USD = 'USD',
  EUR = 'EUR',
  MLC = 'MLC'
}

export enum Role {
  ADMIN = 'ADMIN',
  ACCOUNTANT = 'CONTADOR',
  DEPENDENT = 'VENDEDOR'
}

export type PaymentMethodType = 'CASH' | 'TRANSFER' | 'CARD' | 'CRYPTO' | 'TROPIPAY' | 'QVAPAY' | 'CREDIT';

export interface PaymentMethodConfig {
  id: PaymentMethodType;
  label: string;
  enabled: boolean;
  showInTicket: boolean;
}

export interface CurrencyConfig {
  code: string;
  symbol: string;
  rate: number;
  allowedPaymentMethods: PaymentMethodType[];
  isBase?: boolean;
}

export interface PrinterConfig {
  name: string;
  paperSize: '57mm' | '80mm';
}

export interface ScannerConfig {
  name: string;
  enabled: boolean;
}

export type LicenseTier = 'GOLD' | 'SAPPHIRE' | 'PLATINUM';

export interface LicenseData {
  key: string;
  hwid: string;
  expiryDate: string;
  clientName: string;
  allowedModules: string[];
  signature: string;
  status: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'BLOCKED';
  tier: LicenseTier;
}

export interface SecurityConfig {
  hwid: string;
  lastSystemTime: string;
  installationDate: string;
}

export interface POSStoreTerminal {
  id: string;
  name: string;
  warehouseId: string;
}

export interface GoogleAccountStub {
  email: string;
  connected: boolean;
}

export interface PeripheralsSettings {
  printerMode: 'NONE' | 'BROWSER' | 'ESCPOS';
  barcodeScannerMode: 'NONE' | 'HID';
}

export interface BusinessConfig {
  name: string;
  showName: boolean;
  logo?: string;
  abbreviation: string;
  identifier: string;
  ticketSequence: number;
  address: string;
  showAddress: boolean;
  taxId: string;
  showTaxId: boolean;
  phone: string;
  showPhone: boolean;
  email: string;
  showEmail: boolean;
  primaryCurrency: string;
  footerMessage: string;
  showFooter: boolean;
  licenseStatus: string;
  activeModules: string[];
  paymentMethods: PaymentMethodConfig[];
  printerConfig: PrinterConfig;
  scannerConfig: ScannerConfig;
  license?: LicenseData;
  security: SecurityConfig;
  lastUpdated?: string;
  googleAccount?: GoogleAccountStub;
  posTerminals?: POSStoreTerminal[];
  peripherals?: PeripheralsSettings;
}

export interface User {
  id: string;
  name: string;
  pin: string;
  role: Role;
}

export interface LedgerEntry {
  id: string;
  timestamp: string;
  type: string;
  direction: 'IN' | 'OUT';
  amount: number;
  currency: string;
  paymentMethod: PaymentMethodType;
  userId: string;
  userName: string;
  description: string;
  txId?: string;
}

export interface Coupon {
  id: string;
  code: string;
  name?: string;
  description: string;
  type: 'FIXED' | 'PERCENTAGE';
  value: number;
  startDate: string;
  endDate: string;
  usageLimit: number;
  currentUsages: number;
  targetType: 'GENERAL' | 'GROUP' | 'CLIENT';
  targetId?: string;
  minInvoiceAmount?: number;
  maxInvoiceAmount?: number;
  productIds?: string[];
  isSuspended?: boolean;
  imageData?: string;
}

export interface BogoOffer {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  status: 'ACTIVE' | 'SUSPENDED';
  buyProductId: string;
  buyQty: number;
  getProductId: string;
  getQty: number;
  rewardType: 'FREE' | 'FIXED_PRICE' | 'PERCENT_DISCOUNT';
  rewardValue: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  id: string;
  name: string;
  type: 'BOGO_FREE' | 'BOGO_DISCOUNT';
  productId: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  isActive: boolean;
}

export interface Batch {
  id: string;
  quantity: number;
  cost: number;
  receivedDate: string;
  expiryDate?: string;
  warehouseId?: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
  sku: string;
  image?: string;
  expiryDate?: string;
  color?: string;
}

export interface PricingRule {
  id: string;
  targetId: 'PARENT' | string; // 'PARENT' o el ID de una variante
  minQuantity: number;
  maxQuantity: number;
  newPrice: number;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  type: 'CREATED' | 'UPDATED' | 'DELETED' | 'STOCK_ADJUST' | 'VARIANT_ADDED' | 'VARIANT_REMOVED' | 'RULE_ADDED' | 'RULE_REMOVED' | 'VARIANT_UPDATED' | 'RULE_UPDATED';
  userName: string;
  details: string;
  entityType?: 'PRODUCT' | 'VARIANT' | 'PRICE_RULE';
  entityId?: string;
  details_raw?: {
    before?: any;
    after?: any;
  };
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Product {
  id: string;
  warehouseId: string;
  name: string;
  categories: string[];
  price: number;
  cost: number;
  sku: string; // SKU o Barcode
  stock: number;
  minStockAlert: number;
  image?: string;
  expiryDate?: string;
  isService?: boolean;
  variants: ProductVariant[];
  pricingRules: PricingRule[];
  history: AuditLog[];
  batches?: Batch[];
  hidden?: boolean;
}

export interface PurchaseHistoryItem {
  id: string;
  saleId: string;
  timestamp: string;
  total: number;
  currency: string;
  itemsCount: number;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  ci?: string;
  birthday?: string;
  email?: string;
  balance: number; // Deprecated but kept for compatibility
  creditBalance: number; 
  photo?: string;
  groupId: string;
  purchaseHistory: PurchaseHistoryItem[];
  usageHistory?: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface ClientGroup {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface PaymentDetail {
  method: PaymentMethodType;
  amount: number;
  currency: string;
}

export interface Ticket {
  id: string;
  items: any[];
  subtotal: number;
  discount: number;
  total: number;
  payments: PaymentDetail[];
  currency: string;
  note?: string;
  appliedCouponId?: string;
  clientId?: string;
  sellerName?: string;
  clientRemainingCredit?: number;
  timestamp: string;
}

export interface Sale extends Ticket {
  shiftId: string;
  date: string;
}

export interface Shift {
  id: string;
  openedAt: string;
  openedBy: string;
  startCash: Record<string, number>;
  closedAt?: string;
  closedBy?: string;
  actualCash?: Record<string, number>; // Monto contado físicamente al cierre
}

export interface StoreContextType {
  view: View;
  setView: (view: View) => void;
  currentUser: User | null;
  login: (pin: string) => Promise<boolean>;
  validatePin: (pin: string) => Promise<User | null>;
  logout: () => void;
  users: User[];
  addUser: (user: User) => Promise<void>;
  updateUserPin: (userId: string, newPin: string) => Promise<void>;
  deleteUser: (id: string) => void;
  businessConfig: BusinessConfig;
  updateBusinessConfig: (config: BusinessConfig) => void;
  currencies: CurrencyConfig[];
  addCurrency: (currency: CurrencyConfig) => void;
  updateCurrency: (currency: CurrencyConfig) => void;
  deleteCurrency: (code: string) => void;
  warehouses: Warehouse[];
  addWarehouse: (warehouse: Warehouse) => void;
  updateWarehouse: (warehouse: Warehouse) => void;
  deleteWarehouse: (id: string) => void;
  categories: Category[];
  addCategory: (name: string, color?: string) => void;
  updateCategory: (category: Category) => void;
  deleteCategory: (id: string) => void;
  coupons: Coupon[];
  addCoupon: (coupon: Coupon) => void;
  updateCoupon: (coupon: Coupon) => void;
  deleteCoupon: (id: string) => void;
  bogoOffers: BogoOffer[];
  addBogoOffer: (offer: BogoOffer) => void;
  updateBogoOffer: (offer: BogoOffer) => void;
  deleteBogoOffer: (id: string) => void;
  offers: Offer[];
  addOffer: (offer: Offer) => void;
  deleteOffer: (id: string) => void;
  ledger: LedgerEntry[];
  executeLedgerTransaction: (entry: Partial<LedgerEntry>) => boolean;
  products: Product[];
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  cart: any[];
  addToCart: (product: any, variantId?: string) => void;
  removeFromCart: (cartId: string) => void;
  updateQuantity: (cartId: string, delta: number) => void;
  clearCart: () => void;
  processSale: (saleData: any) => Ticket | null;
  rates: Record<string, number>;
  posCurrency: string;
  setPosCurrency: (code: string) => void;
  activeShift: Shift | null;
  openShift: (cash: Record<string, number>) => void;
  closeShift: (cash: Record<string, number>, closedBy: string) => void;
  getCurrentCash: () => Record<string, number>;
  getLedgerBalance: (currency: string, method: string) => number;
  updateRate: (code: string, rate: number, tax?: number) => void;
  clients: Client[];
  addClient: (client: Client) => void;
  updateClient: (client: Client) => void;
  deleteClient: (id: string) => void;
  addClientCredit: (clientId: string, amount: number, reason?: string) => void;
  deductClientCredit: (clientId: string, amount: number, reason?: string) => boolean;
  clientGroups: ClientGroup[];
  addClientGroup: (name: string) => void;
  updateClientGroup: (id: string, name: string) => void;
  deleteClientGroup: (id: string) => void;
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;
  sales: Sale[];
  isLicenseValid: boolean;
  timeManipulationDetected: boolean;
  checkModuleAccess: (moduleId: string) => boolean;
  applyLicenseKey: (key: string) => Promise<boolean>;
  isItemLocked: (limitKey: any, index: number) => boolean;
  notification: { message: string, type: 'error' | 'success' } | null;
  clearNotification: () => void;
  notify: (message: string, type?: 'error' | 'success') => void;
  activePosTerminalId: string | null;
  setActivePosTerminalId: (id: string | null) => void;
}
