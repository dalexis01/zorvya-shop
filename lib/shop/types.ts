export type Locale = "es" | "nl" | "en" | "pt";
export type ProductIdentifier = string | number;

export type DeliveryType = "delivery" | "pickup";
export type PaymentMethod = "cash" | "paypal";
export type PayPalDisplayCurrency = "SRD" | "USD";

export type OrderStatusLabel = string;
export type AdminManualOrderStatus =
  | "Pendiente de confirmacion"
  | "Confirmando stock"
  | "Preparando pedido"
  | "Pagada / Preparando"
  | "Pedido aceptado"
  | "Pedido listo para delivery"
  | "En delivery"
  | "Pedido completado"
  | "Pedido confirmado";
export type OrderCancellationSource = "customer" | "admin";
export type OrderPaymentState =
  | "not_applicable"
  | "pending_authorization"
  | "authorized"
  | "captured"
  | "voided"
  | "failed";

export interface OrderLineItem {
  productId?: ProductIdentifier;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  selectedVariantId?: string;
  selectedVariantName?: string;
  selectedColor?: string;
}

export interface CatalogProductOption {
  id: ProductIdentifier;
  name: string;
  price: number;
  image: string;
  category: string;
  tags?: string[];
  brand?: string;
  rating?: number;
  reviewCount?: number;
}

export interface StorefrontProductVariant {
  id: string;
  name: string;
  price: number;
  color: string;
  details: string;
  imageUrl: string;
}

export interface StorefrontProductColorOption {
  id: string;
  name: string;
  imageUrl: string;
}

export interface ProductLocaleContent {
  name?: string;
  shortDescription?: string;
  longDescription?: string;
  category?: string;
  tags?: string[];
  inventoryLabel?: string;
  deliveryLabel?: string;
  badge?: string;
}

export type ProductTranslationMap = Partial<Record<Locale, ProductLocaleContent>>;

export interface StorefrontProduct {
  id: ProductIdentifier;
  sku: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  brand: string;
  category: string;
  tags: string[];
  price: number;
  originalPrice?: number;
  image: string;
  images: string[];
  rating: number;
  reviewCount: number;
  badge: string;
  inventoryLabel: string;
  deliveryLabel: string;
  hasFreeDelivery: boolean;
  isHeavy: boolean;
  stock: number;
  showStock: boolean;
  displayOrder: number;
  isFeatured: boolean;
  isTop: boolean;
  colors: string[];
  colorOptions?: StorefrontProductColorOption[];
  colorImageMap?: Record<string, string>;
  variants: StorefrontProductVariant[];
  createdAt?: string;
  updatedAt?: string;
  translations?: ProductTranslationMap;
}

export interface ProductReview {
  id: string;
  productId: string;
  userId: string | null;
  customerName: string;
  customerEmail: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface OrderIssueReport {
  id: string;
  message: string;
  createdAt: string;
}

export interface OrderStatusHistoryEntry {
  id: string;
  status: OrderStatusLabel;
  changedAt: string;
  changedBy: string;
  changedByName: string;
}

export interface CheckoutCustomerData {
  name: string;
  phone: string;
  email: string;
  address: string;
  deliveryType: DeliveryType;
  pickupDate?: Date;
  pickupTime?: string;
  requestedAgentCall: boolean;
  containsHeavyItems?: boolean;
  deliveryDistanceKm?: number;
  deliveryFee?: number;
  paymentMethod: PaymentMethod;
  paypalDisplayCurrency?: PayPalDisplayCurrency | null;
  paymentFeeRate?: number;
  paymentFeeAmountSrd?: number;
  paymentGrandTotalSrd?: number;
  paymentPayableUsd?: number | null;
  exchangeRateSrdPerUsd?: number | null;
}

export interface OrderPaymentInfo {
  method: PaymentMethod;
  paypalDisplayCurrency: PayPalDisplayCurrency | null;
  exchangeRateSrdPerUsd: number | null;
  feeRate: number;
  feeAmountSrd: number;
  baseTotalSrd: number;
  grandTotalSrd: number;
  payableUsd: number | null;
  paypalOrderId: string | null;
  paypalAuthorizationId: string | null;
  paypalAuthorizationStatus: string | null;
  paypalCaptureId: string | null;
  paypalCaptureStatus: string | null;
  state: OrderPaymentState;
  authorizedAt: string | null;
  capturedAt: string | null;
  voidedAt: string | null;
  failureReason: string | null;
}

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  phone: string;
  address: string;
  isBlocked?: boolean;
  blockedAt?: string | null;
  acceptedTermsAt?: string | null;
  acceptedTermsVersion?: string | null;
  emailVerifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
}

export interface StoredSession {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface StoredOrder {
  id: string;
  userId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  deliveryType: DeliveryType;
  pickupDate: string | null;
  pickupTime: string | null;
  requestedAgentCall: boolean;
  items: OrderLineItem[];
  subtotal: number;
  deliveryDistanceKm: number | null;
  deliveryFee: number;
  total: number;
  payment: OrderPaymentInfo;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  cancelledBy: OrderCancellationSource | null;
  cancelledByName: string | null;
  adminReviewedAt: string | null;
  adminStatus: AdminManualOrderStatus | null;
  statusHistory: OrderStatusHistoryEntry[];
  issues: OrderIssueReport[];
}

export interface OrderSummary extends StoredOrder {
  status: OrderStatusLabel;
  statusDetail: string | null;
  isLatest: boolean;
  canCancel: boolean;
  canAddItems: boolean;
  canEditAddress: boolean;
  canEditPhone: boolean;
  canReportIssue: boolean;
  pickupAddress: string | null;
}

export type CustomerNotificationType =
  | "order_confirmed"
  | "order_processed"
  | "order_in_transit"
  | "order_delivered"
  | "order_cancelled"
  | "order_issue"
  | "support_reply";

export interface CustomerNotification {
  id: string;
  userId: string;
  orderId: string | null;
  type: CustomerNotificationType;
  title: string;
  message: string;
  status: "active" | "archived";
  readAt: string | null;
  createdAt: string;
}

export interface CustomerNotificationOrderSummary {
  id: string;
  status: OrderStatusLabel;
  statusDetail: string | null;
  createdAt: string;
  total: number;
  address: string;
  deliveryType: DeliveryType;
  pickupDate: string | null;
  pickupTime: string | null;
  lastMessage: string | null;
  statusHistory: OrderStatusHistoryEntry[];
}

export interface NormalizedOrderInput {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  deliveryType: DeliveryType;
  pickupDate: string | null;
  pickupTime: string | null;
  requestedAgentCall: boolean;
  items: OrderLineItem[];
  subtotal: number;
  deliveryDistanceKm: number | null;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  paypalDisplayCurrency: PayPalDisplayCurrency | null;
  paymentFeeRate: number;
  paymentFeeAmountSrd: number;
  paymentGrandTotalSrd: number;
  paymentPayableUsd: number | null;
  exchangeRateSrdPerUsd: number | null;
}
