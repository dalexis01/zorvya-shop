import type {
  Locale,
  OrderLineItem,
  OrderStatusLabel,
  ProductTranslationMap,
  StoredOrder,
  StoredUser,
} from "@/lib/shop/types";

export type AdminRole = "admin" | "worker" | "support_agent";

export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: AdminRole;
  permissions: AdminPermission[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  createdBy: string;
}

export type AdminPermission =
  | "products.create"
  | "products.read"
  | "products.update"
  | "products.delete"
  | "orders.read"
  | "orders.update"
  | "orders.delete"
  | "support.read"
  | "support.respond"
  | "users.read"
  | "users.update"
  | "content.update"
  | "admin.manage_staff";

export interface AdminSessionUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  permissions: AdminPermission[];
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
}

export interface ProductMetrics {
  inventoryCost: number;
  projectedRevenue: number;
  unitMargin: number;
  marginRate: number;
  expectedProfit: number;
}

export interface ProductInternalDetails {
  costPrice: number;
  purchasePrice: number;
  shippingFee: number;
  isHeavy: boolean;
  supplierId: string;
  supplier: string;
  supplierPhone: string;
  internalCode: string;
  internalNotes: string;
  accountingImageUrl: string;
}

export interface SupplierChoice {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  isActive: boolean;
}

export interface SupplierSummary {
  dayAmount: number;
  weekAmount: number;
  totalByBlocks: number;
  totalPending: number;
  totalPaid: number;
  totalAccrued: number;
  blockCount: number;
}

export interface SupplierBlockSummary {
  blockId: string;
  blockName: string;
  blockStatus: string;
  ordersCount: number;
  amount: number;
}

export interface SupplierPaymentRecord {
  id: string;
  supplierId: string;
  amount: number;
  paymentDate: string;
  blockId: string | null;
  notes: string;
  createdAt: string;
  createdBy: string;
}

export interface SupplierListEntry extends SupplierChoice {
  notes: string;
  createdAt: string;
  updatedAt: string;
  summary: SupplierSummary;
}

export interface SupplierProfile extends SupplierListEntry {
  blockBalances: SupplierBlockSummary[];
  payments: SupplierPaymentRecord[];
}

export interface ProductAiImageCandidate {
  id: string;
  url: string;
  label: string;
}

export interface ProductAiDraft {
  id: string;
  sourceImageUrl: string;
  nameHint: string;
  brandHint: string;
  categoryHint: string;
  suggestedName: string;
  suggestedSku: string;
  suggestedInternalCode: string;
  suggestedShortDescription: string;
  suggestedLongDescription: string;
  suggestedCategory: string;
  suggestedTags: string[];
  generatedImages: ProductAiImageCandidate[];
  approvedName: string;
  approvedSku: string;
  approvedInternalCode: string;
  approvedShortDescription: string;
  approvedLongDescription: string;
  approvedCategory: string;
  approvedTags: string[];
  approvedImageIds: string[];
  linkedProductId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  publicId: string;
  displayOrder: number;
  sku: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  brand: string;
  category: string;
  tags: string[];
  price: number;
  originalPrice?: number;
  stock: number;
  rating: number;
  reviewCount: number;
  inventoryLabel: string;
  deliveryLabel: string;
  showStock: boolean;
  images: ProductImage[];
  isActive: boolean;
  isVisible: boolean;
  isFeatured: boolean;
  isTop: boolean;
  attributes: Record<string, string>;
  internal: ProductInternalDetails;
  metrics: ProductMetrics;
  createdAt: string;
  publishedAt: string | null;
  stockAddedAt: string | null;
  lastSoldAt: string | null;
  saleDates: string[];
  updatedAt: string;
  updatedBy: string;
  translations?: ProductTranslationMap;
  ai?: {
    draftId: string | null;
    sourceImageUrl?: string;
    generatedImages: ProductAiImageCandidate[];
    suggestedName?: string;
    suggestedSku?: string;
    suggestedInternalCode?: string;
    suggestedShortDescription?: string;
    suggestedLongDescription?: string;
    suggestedCategory?: string;
    suggestedTags?: string[];
  };
}

export interface HomepageBanner {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  imageUrl: string;
  buttonLabel: string;
  buttonHref: string;
  isEnabled: boolean;
  order: number;
}

export interface HomepageButtonConfig {
  id: string;
  label: string;
  target: "languages" | "support" | "account" | "cart";
  isEnabled: boolean;
  order: number;
}

export interface HomepageSectionConfig {
  id: "featured" | "top" | "promotions" | "newProducts" | "allProducts" | "ads" | "info";
  label: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  isEnabled: boolean;
  order: number;
  productIds: string[];
}

export type HomepageBlockKind = "hero" | "catalog" | "banner" | "announcement" | "info";

export type HomepageCatalogSource =
  | "featured"
  | "top"
  | "promotions"
  | "newProducts"
  | "allProducts"
  | "ads"
  | "custom";

export interface HomepageBlock {
  id: string;
  type: HomepageBlockKind;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  buttonLabel: string;
  buttonHref: string;
  isEnabled: boolean;
  order: number;
  isEditable: boolean;
  isRemovable: boolean;
  catalogSource: HomepageCatalogSource | null;
  productIds: string[];
}

export interface HomepageThemeSettings {
  primary: string;
  secondary: string;
  accent: string;
  backgroundStart: string;
  backgroundEnd: string;
  backgroundGlow: string;
  panel: string;
  panelAlt: string;
  headerSurface: string;
  searchStart: string;
  searchCenter: string;
  searchEnd: string;
  marqueeStart: string;
  marqueeCenter: string;
  marqueeEnd: string;
}

export interface HomepageTypographySettings {
  primaryFont: string;
  secondaryFont: string;
  baseFontSize: number;
  baseFontWeight: number;
}

export interface HomepageHeadingStyles {
  h1Size: number;
  h2Size: number;
  h3Size: number;
}

export interface HomepageParagraphStyles {
  size: number;
  lineHeight: number;
}

export interface HomepageButtonStyles {
  radius: number;
  textSize: number;
  fontWeight: number;
}

export type PayPalEnvironment = "sandbox" | "live";

export interface PayPalSettings {
  enabled: boolean;
  accountDisplayName: string;
  accountEmail: string;
  clientId: string;
  clientSecret: string;
  environment: PayPalEnvironment;
  apiBaseUrl: string;
  updatedAt: string;
}

export interface HomepageSearchStyles {
  radius: number;
  textSize: number;
  iconSize: number;
  height: number;
  maxWidth: number;
}

export interface HomepageHeaderStyles {
  paddingY: number;
  titleSize: number;
  taglineSize: number;
  surfaceOpacity: number;
}

export interface HomepageVisualStyles {
  typography: HomepageTypographySettings;
  headings: HomepageHeadingStyles;
  paragraphs: HomepageParagraphStyles;
  buttons: HomepageButtonStyles;
  search: HomepageSearchStyles;
  header: HomepageHeaderStyles;
}

export interface HomepageLocalizedContent {
  promoBarText: string;
  searchPlaceholder: string;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  heroPrimaryButtonLabel: string;
  heroSecondaryButtonLabel: string;
}

export interface HomepageSettings {
  brandName: string;
  brandTagline: string;
  logoImageUrl: string;
  logoText: string;
  logoSize: number;
  headerSearchEnabled: boolean;
  heroImageUrl: string;
  heroPrimaryButtonHref: string;
  heroSecondaryButtonHref: string;
  theme: HomepageThemeSettings;
  styles: HomepageVisualStyles;
  blocks: HomepageBlock[];
  banners: HomepageBanner[];
  buttonOrder: HomepageButtonConfig[];
  sectionOrder: HomepageSectionConfig[];
  localizedContent: Record<Locale, HomepageLocalizedContent>;
  updatedAt: string;
}

export interface SupportResponse {
  id: string;
  respondedBy: string;
  respondedByName: string;
  message: string;
  attachments?: string[];
  createdAt: string;
}

export type SupportMessageSource = "chatbot" | "email";

export interface SupportChatEntry {
  id: string;
  sender: "customer" | "support";
  senderName: string;
  message: string;
  attachments?: string[];
  createdAt: string;
}

export interface SupportMessage {
  id: string;
  orderId?: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  subject: string;
  message: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved";
  category: "product" | "delivery" | "payment" | "other";
  source: SupportMessageSource;
  customerToken?: string;
  chatEntries: SupportChatEntry[];
  responses: SupportResponse[];
  adminSeenAt?: string | null;
  customerSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface StatusLog {
  id: string;
  type: "order" | "product" | "user" | "content";
  targetId: string;
  action: "created" | "updated" | "deleted" | "status_changed";
  changedBy: string;
  changedByName: string;
  changes: StatusChange[];
  createdAt: string;
}

export interface StatusChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface FeaturedContent {
  id: string;
  type: "featured" | "top" | "banner";
  productIds: string[];
  position: number;
  isActive: boolean;
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface AdminOrderItemRecord extends OrderLineItem {
  linkedAdminProductId: string | null;
  href: string;
}

export interface AdminOrderRecord extends Omit<StoredOrder, "items"> {
  items: AdminOrderItemRecord[];
  status: OrderStatusLabel;
  statusDetail: string | null;
  isPending: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
  isNew: boolean;
  idTail: string;
}

export interface AdminOrdersMeta {
  newOrdersCount: number;
  totalOrdersCount: number;
  pendingOrdersCount: number;
  pickupOrdersCount: number;
  completedOrdersCount: number;
  cancelledOrdersCount: number;
}

export interface RevenueChartPoint {
  label: string;
  revenue: number;
  profit: number;
  orders: number;
}

export interface RevenueComparison {
  current: number;
  previous: number;
  changeRate: number | null;
}

export interface RevenueProductPerformance {
  key: string;
  name: string;
  linkedProductId: string | null;
  unitsSold: number;
  ordersCount: number;
  revenue: number;
  cogs: number;
  profit: number;
  averageSalePrice: number;
  marginRate: number;
  costTracked: boolean;
}

export interface DashboardOrderSnapshot {
  id: string;
  customerName: string;
  total: number;
  status: string;
  createdAt: string;
}

export interface RevenueAnalytics {
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  totalRevenue: number;
  productRevenueTotal: number;
  deliveryRevenueTotal: number;
  cogsTotal: number;
  grossProfit: number;
  netProfit: number;
  averageOrderValue: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  completedRevenue: number;
  cancelledValue: number;
  trackedProductCount: number;
  untrackedProductCount: number;
  totalUnitsSold: number;
  todayComparison: RevenueComparison;
  weekComparison: RevenueComparison;
  monthComparison: RevenueComparison;
  dailySeries: RevenueChartPoint[];
  weeklySeries: RevenueChartPoint[];
  monthlySeries: RevenueChartPoint[];
  productPerformance: RevenueProductPerformance[];
  recentOrders: DashboardOrderSnapshot[];
}

export interface AdminUserRecord extends StoredUser {
  isBlocked: boolean;
  blockedAt: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

export interface AdminUserProfile extends AdminUserRecord {
  orders: AdminOrderRecord[];
}

export interface AdminDashboardStats {
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: Product[];
  totalOrders: number;
  ordersToday: number;
  ordersThisWeek: number;
  ordersThisMonth: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  pendingSupportMessages: number;
  blockedUsers: number;
  cogsTotal: number;
  grossProfit: number;
  netProfit: number;
  cancelledOrders: number;
  cancelledValue: number;
  trackedProductCount: number;
  untrackedProductCount: number;
  totalUnitsSold: number;
  topProducts: RevenueProductPerformance[];
  revenueSeries: RevenueChartPoint[];
  recentOrders: DashboardOrderSnapshot[];
  recentSupportMessages: SupportMessage[];
}

export interface AdminSupportMeta {
  unreadCount: number;
  openCount: number;
}
