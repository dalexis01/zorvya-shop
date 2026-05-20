import "server-only";

import { randomUUID } from "node:crypto";

import { calculateDeliveryFee } from "@/helpers/delivery";
import { registerProductSalesFromOrder } from "@/lib/server/admin/products";
import { createCustomerNotification } from "@/lib/server/customer-notifications";
import { resolveDeliveryQuote } from "@/lib/server/delivery-quote";
import { getProductById } from "@/lib/server/admin/products";
import { buildOrderItemMediaProxyUrl } from "@/lib/server/order-media";
import {
  insertOrderIntoStore,
  loadAllOrdersFromStore,
  loadOrderByIdFromStore,
  loadOrdersByIdsFromStore,
  loadOrdersByUserIdFromStore,
  loadPaginatedUserOrdersSummaryFromStore,
  type PaginatedUserOrdersSummaryResult,
  updateOrderInStore,
} from "@/lib/server/orders-store";
import { canManageOrder, summarizeOrders } from "@/lib/shop/order-status";
import { createOrderPaymentInfo } from "@/lib/shop/payments";
import type {
  AdminManualOrderStatus,
  NormalizedOrderInput,
  OrderPaymentInfo,
  OrderIssueReport,
  OrderLineItem,
  OrderStatusLabel,
  OrderStatusHistoryEntry,
  StoredOrder,
} from "@/lib/shop/types";

function trimText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function mergeOrderPayment(
  existingPayment: OrderPaymentInfo,
  patch?: Partial<OrderPaymentInfo> | null
) {
  return createOrderPaymentInfo({
    paymentMethod: patch?.method ?? existingPayment.method,
    paypalDisplayCurrency:
      patch?.paypalDisplayCurrency ?? existingPayment.paypalDisplayCurrency,
    baseTotalSrd: patch?.baseTotalSrd ?? existingPayment.baseTotalSrd,
    feeRate: patch?.feeRate ?? existingPayment.feeRate,
    feeAmountSrd: patch?.feeAmountSrd ?? existingPayment.feeAmountSrd,
    grandTotalSrd: patch?.grandTotalSrd ?? existingPayment.grandTotalSrd,
    payableUsd:
      patch?.payableUsd === undefined ? existingPayment.payableUsd : patch.payableUsd,
    exchangeRateSrdPerUsd:
      patch?.exchangeRateSrdPerUsd === undefined
        ? existingPayment.exchangeRateSrdPerUsd
        : patch.exchangeRateSrdPerUsd,
    state: patch?.state ?? existingPayment.state,
    paypalOrderId:
      patch?.paypalOrderId === undefined ? existingPayment.paypalOrderId : patch.paypalOrderId,
    paypalAuthorizationId:
      patch?.paypalAuthorizationId === undefined
        ? existingPayment.paypalAuthorizationId
        : patch.paypalAuthorizationId,
    paypalAuthorizationStatus:
      patch?.paypalAuthorizationStatus === undefined
        ? existingPayment.paypalAuthorizationStatus
        : patch.paypalAuthorizationStatus,
    paypalCaptureId:
      patch?.paypalCaptureId === undefined
        ? existingPayment.paypalCaptureId
        : patch.paypalCaptureId,
    paypalCaptureStatus:
      patch?.paypalCaptureStatus === undefined
        ? existingPayment.paypalCaptureStatus
        : patch.paypalCaptureStatus,
    authorizedAt:
      patch?.authorizedAt === undefined ? existingPayment.authorizedAt : patch.authorizedAt,
    capturedAt: patch?.capturedAt === undefined ? existingPayment.capturedAt : patch.capturedAt,
    voidedAt: patch?.voidedAt === undefined ? existingPayment.voidedAt : patch.voidedAt,
    failureReason:
      patch?.failureReason === undefined ? existingPayment.failureReason : patch.failureReason,
  });
}

export function toClientSafeStoredOrder(order: StoredOrder): StoredOrder {
  let hasMediaProxy = false;

  const items = order.items.map((item, index) => {
    const image = typeof item.image === "string" ? item.image.trim() : "";

    if (!image || !image.startsWith("data:")) {
      return item;
    }

    hasMediaProxy = true;

    return {
      ...item,
      image: buildOrderItemMediaProxyUrl(order.id, index, order.updatedAt || order.createdAt),
    };
  });

  if (!hasMediaProxy) {
    return order;
  }

  return {
    ...order,
    items,
  };
}

export function normalizeStoredOrder(order: StoredOrder): StoredOrder {
  const subtotal =
    typeof order.subtotal === "number" && Number.isFinite(order.subtotal) ? order.subtotal : 0;
  const deliveryFee =
    typeof order.deliveryFee === "number" && Number.isFinite(order.deliveryFee)
      ? order.deliveryFee
      : 0;
  const legacyBaseTotal = roundCurrency(subtotal + deliveryFee);
  const legacyTotal =
    typeof order.total === "number" && Number.isFinite(order.total)
      ? roundCurrency(order.total)
      : legacyBaseTotal;
  const legacyPayment = createOrderPaymentInfo({
    paymentMethod: "cash",
    baseTotalSrd: legacyBaseTotal,
    feeRate: 0,
    feeAmountSrd: 0,
    grandTotalSrd: legacyTotal,
    payableUsd: null,
    exchangeRateSrdPerUsd: null,
    state: "not_applicable",
  });
  const paymentSource = order.payment ?? legacyPayment;
  const payment = createOrderPaymentInfo({
    paymentMethod: paymentSource.method === "paypal" ? "paypal" : "cash",
    paypalDisplayCurrency: paymentSource.paypalDisplayCurrency,
    baseTotalSrd:
      typeof paymentSource.baseTotalSrd === "number" && Number.isFinite(paymentSource.baseTotalSrd)
        ? paymentSource.baseTotalSrd
        : legacyBaseTotal,
    feeRate:
      typeof paymentSource.feeRate === "number" && Number.isFinite(paymentSource.feeRate)
        ? paymentSource.feeRate
        : 0,
    feeAmountSrd:
      typeof paymentSource.feeAmountSrd === "number" &&
      Number.isFinite(paymentSource.feeAmountSrd)
        ? paymentSource.feeAmountSrd
        : 0,
    grandTotalSrd:
      typeof paymentSource.grandTotalSrd === "number" &&
      Number.isFinite(paymentSource.grandTotalSrd)
        ? paymentSource.grandTotalSrd
        : legacyTotal,
    payableUsd:
      typeof paymentSource.payableUsd === "number" && Number.isFinite(paymentSource.payableUsd)
        ? paymentSource.payableUsd
        : null,
    exchangeRateSrdPerUsd:
      typeof paymentSource.exchangeRateSrdPerUsd === "number" &&
      Number.isFinite(paymentSource.exchangeRateSrdPerUsd)
        ? paymentSource.exchangeRateSrdPerUsd
        : null,
    state: paymentSource.state,
    paypalOrderId: paymentSource.paypalOrderId,
    paypalAuthorizationId: paymentSource.paypalAuthorizationId,
    paypalAuthorizationStatus: paymentSource.paypalAuthorizationStatus,
    paypalCaptureId: paymentSource.paypalCaptureId,
    paypalCaptureStatus: paymentSource.paypalCaptureStatus,
    authorizedAt: paymentSource.authorizedAt,
    capturedAt: paymentSource.capturedAt,
    voidedAt: paymentSource.voidedAt,
    failureReason: paymentSource.failureReason,
  });

  return {
    ...order,
    updatedAt: order.updatedAt || order.createdAt,
    cancelledAt: order.cancelledAt ?? null,
    cancellationReason: order.cancellationReason ?? null,
    cancelledBy: order.cancelledBy ?? null,
    cancelledByName: order.cancelledByName ?? null,
    customerEmail: order.customerEmail || "",
    requestedAgentCall: Boolean(order.requestedAgentCall),
    items: Array.isArray(order.items) ? order.items : [],
    deliveryDistanceKm:
      typeof order.deliveryDistanceKm === "number" && Number.isFinite(order.deliveryDistanceKm)
        ? order.deliveryDistanceKm
        : null,
    adminReviewedAt: order.adminReviewedAt ?? null,
    adminStatus: order.adminStatus ?? null,
    statusHistory: Array.isArray(order.statusHistory) ? order.statusHistory : [],
    issues: Array.isArray(order.issues) ? order.issues : [],
    total: payment.grandTotalSrd,
    payment,
  };
}

async function readOrders(options?: { windowDays?: number }) {
  const orders = await loadAllOrdersFromStore(options);
  return orders.map(normalizeStoredOrder);
}

function assertOrderOwner(order: StoredOrder | undefined, userId: string) {
  if (!order || order.userId !== userId) {
    throw new Error("ORDER_NOT_FOUND");
  }

  return order;
}

function assertOrderEditable(order: StoredOrder) {
  if (order.cancelledAt) {
    throw new Error("ORDER_ALREADY_CANCELLED");
  }

  if (!canManageOrder(order)) {
    throw new Error("ORDER_EDIT_WINDOW_EXPIRED");
  }
}

function assertPayPalOrderUnlocked(order: StoredOrder) {
  if (
    order.payment.method === "paypal" &&
    order.payment.state !== "voided" &&
    order.payment.state !== "not_applicable"
  ) {
    throw new Error("ORDER_PAYPAL_LOCKED");
  }
}

function mergeItems(existingItems: OrderLineItem[], newItems: OrderLineItem[]) {
  const mergedItems = [...existingItems];

  for (const newItem of newItems) {
    const existingIndex = mergedItems.findIndex((item) => {
      if (item.productId && newItem.productId) {
        return item.productId === newItem.productId;
      }

      return item.name.toLowerCase() === newItem.name.toLowerCase();
    });

    if (existingIndex === -1) {
      mergedItems.push(newItem);
      continue;
    }

    mergedItems[existingIndex] = {
      ...mergedItems[existingIndex],
      quantity: mergedItems[existingIndex].quantity + newItem.quantity,
      price: newItem.price,
      image: newItem.image || mergedItems[existingIndex].image,
    };
  }

  return mergedItems;
}

async function hasHeavyItems(items: OrderLineItem[]) {
  for (const item of items) {
    const productId = item.productId ? String(item.productId) : "";

    if (!productId) {
      continue;
    }

    const product = await getProductById(productId);

    if (product?.internal?.isHeavy) {
      return true;
    }
  }

  return false;
}

function recalculateTotals(
  order: Pick<StoredOrder, "deliveryType" | "customerAddress" | "deliveryDistanceKm">,
  items: OrderLineItem[],
  containsHeavyItems: boolean
) {
  const subtotal = Math.round(
    items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100
  ) / 100;

  if (order.deliveryType !== "delivery") {
    return {
      subtotal,
      deliveryDistanceKm: null,
      deliveryFee: 0,
      total: subtotal,
    };
  }

  const distanceKm =
    typeof order.deliveryDistanceKm === "number" && order.deliveryDistanceKm > 0
      ? order.deliveryDistanceKm
      : null;

  if (!distanceKm) {
    return {
      subtotal,
      deliveryDistanceKm: null,
      deliveryFee: 0,
      total: subtotal,
    };
  }

  const deliveryFee = calculateDeliveryFee(distanceKm, {
    subtotal,
    hasHeavy: containsHeavyItems,
  }).fee;
  const total = Math.round((subtotal + deliveryFee) * 100) / 100;

  return {
    subtotal,
    deliveryDistanceKm: distanceKm,
    deliveryFee,
    total,
  };
}

async function recalculateTotalsWithRoute(
  order: Pick<
    StoredOrder,
    "deliveryType" | "customerAddress" | "deliveryDistanceKm" | "requestedAgentCall"
  >,
  items: OrderLineItem[]
) {
  const containsHeavyItems = await hasHeavyItems(items);
  const baseTotals = recalculateTotals(order, items, containsHeavyItems);

  if (order.deliveryType !== "delivery" || baseTotals.deliveryDistanceKm) {
    return {
      ...baseTotals,
      requiresAgentReview: false,
    };
  }

  const deliveryQuote = await resolveDeliveryQuote({
    address: order.customerAddress,
    subtotal: baseTotals.subtotal,
    hasHeavy: containsHeavyItems,
  });

  if (!deliveryQuote.allowsDelivery && !deliveryQuote.requiresAgentReview) {
    throw new Error("ORDER_DELIVERY_UNAVAILABLE");
  }

  if (deliveryQuote.requiresAgentReview) {
    return {
      subtotal: baseTotals.subtotal,
      deliveryDistanceKm: null,
      deliveryFee: 0,
      total: baseTotals.subtotal,
      requiresAgentReview: true,
    };
  }

  return {
    subtotal: baseTotals.subtotal,
    deliveryDistanceKm: deliveryQuote.distanceKm,
    deliveryFee: deliveryQuote.fee,
    total: Math.round((baseTotals.subtotal + deliveryQuote.fee) * 100) / 100,
    requiresAgentReview: false,
  };
}

function buildStatusHistoryEntry(input: {
  status: OrderStatusLabel;
  changedBy: string;
  changedByName: string;
}): OrderStatusHistoryEntry {
  return {
    id: `OST-${randomUUID().slice(0, 8).toUpperCase()}`,
    status: input.status,
    changedAt: new Date().toISOString(),
    changedBy: input.changedBy,
    changedByName: input.changedByName,
  };
}

async function createOrderLifecycleNotification(input: {
  order: Pick<StoredOrder, "id" | "userId" | "deliveryType" | "pickupDate" | "pickupTime">;
  type:
    | "order_confirmed"
    | "order_processed"
    | "order_in_transit"
    | "order_delivered"
    | "order_cancelled"
    | "order_issue";
  title: string;
  message: string;
}) {
  if (!input.order.userId) {
    return;
  }

  await createCustomerNotification({
    userId: input.order.userId,
    orderId: input.order.id,
    type: input.type,
    title: input.title,
    message: input.message,
  });
}

function getOrderLifecycleNotificationPayload(order: StoredOrder, status: OrderStatusLabel) {
  if (status === "Pedido cancelado") {
    return {
      type: "order_cancelled" as const,
      title: "Pedido cancelado",
      message: `Tu pedido ${order.id} fue cancelado. Si necesitas ayuda, soporte ya puede revisar tu caso.`,
    };
  }

  if (status === "Pedido completado") {
    return {
      type: "order_delivered" as const,
      title: "Pedido entregado",
      message: `Tu pedido ${order.id} ya fue marcado como entregado. Gracias por comprar en ZorvyA Shop.`,
    };
  }

  if (status === "En delivery") {
    return {
      type: "order_in_transit" as const,
      title: "Pedido en camino",
      message: `Tu pedido ${order.id} ya va en camino. Prepara la recepcion para evitar retrasos.`,
    };
  }

  if (
    [
      "Confirmando stock",
      "Preparando pedido",
      "Pagada / Preparando",
      "Pedido listo para delivery",
      "Procesandose para delivery",
    ].includes(status)
  ) {
    return {
      type: "order_processed" as const,
      title: "Pedido procesado",
      message: `Tu pedido ${order.id} avanzo al estado "${status}". Ya lo estamos moviendo en logistica.`,
    };
  }

  if (
    [
      "Pendiente de confirmacion",
      "Pedido confirmado",
      "Pedido confirmado para recogida",
      "Pedido aceptado",
      "Orden confirmada y procesandose",
    ].includes(status)
  ) {
    return {
      type: "order_confirmed" as const,
      title: "Pedido confirmado",
      message:
        order.deliveryType === "pickup" && order.pickupDate && order.pickupTime
          ? `Tu pedido ${order.id} fue confirmado para recogida el ${order.pickupDate} a las ${order.pickupTime}.`
          : `Tu pedido ${order.id} fue confirmado y ya entro al flujo de preparacion.`,
    };
  }

  return null;
}

export async function getAllOrders(options?: { windowDays?: number }) {
  return readOrders(options);
}

export async function getOrdersByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const orders = await loadOrdersByIdsFromStore(ids);
  return orders.map(normalizeStoredOrder);
}

export async function getOrderById(orderId: string) {
  const order = await loadOrderByIdFromStore(orderId);
  return order ? normalizeStoredOrder(order) : null;
}

export async function createOrder(
  input: NormalizedOrderInput & {
    userId: string | null;
    initialAdminStatus?: AdminManualOrderStatus | null;
    paymentUpdate?: Partial<OrderPaymentInfo> | null;
  }
) {
  const now = new Date().toISOString();
  const payment = mergeOrderPayment(
    createOrderPaymentInfo({
      paymentMethod: input.paymentMethod,
      paypalDisplayCurrency: input.paypalDisplayCurrency,
      baseTotalSrd: input.subtotal + input.deliveryFee,
      feeRate: input.paymentFeeRate,
      feeAmountSrd: input.paymentFeeAmountSrd,
      grandTotalSrd: input.paymentGrandTotalSrd,
      payableUsd: input.paymentPayableUsd,
      exchangeRateSrdPerUsd: input.exchangeRateSrdPerUsd,
      state: input.paymentMethod === "paypal" ? "pending_authorization" : "not_applicable",
    }),
    input.paymentUpdate
  );

  const newOrder: StoredOrder = {
    id: `ORD-${randomUUID().slice(0, 8).toUpperCase()}`,
    userId: input.userId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    customerAddress: input.customerAddress,
    deliveryType: input.deliveryType,
    pickupDate: input.pickupDate,
    pickupTime: input.pickupTime,
    requestedAgentCall: input.requestedAgentCall,
    items: input.items,
    subtotal: input.subtotal,
    deliveryDistanceKm: input.deliveryDistanceKm,
    deliveryFee: input.deliveryFee,
    total: payment.grandTotalSrd,
    payment,
    createdAt: now,
    updatedAt: now,
    cancelledAt: null,
    cancellationReason: null,
    cancelledBy: null,
    cancelledByName: null,
    adminReviewedAt: null,
    adminStatus: input.initialAdminStatus ?? null,
    statusHistory: input.initialAdminStatus
      ? [
          buildStatusHistoryEntry({
            status: input.initialAdminStatus,
            changedBy: input.paymentMethod === "paypal" ? "paypal" : "system",
            changedByName: input.paymentMethod === "paypal" ? "PayPal" : "Sistema",
          }),
        ]
      : [],
    issues: [],
  };

  await insertOrderIntoStore(newOrder);
  await registerProductSalesFromOrder({
    soldAt: now,
    items: newOrder.items,
  });
  await createOrderLifecycleNotification({
    order: newOrder,
    type: "order_confirmed",
    title: "Pedido recibido",
    message:
      newOrder.deliveryType === "pickup"
        ? `Recibimos tu pedido ${newOrder.id}. Te avisaremos cuando la recogida quede lista.`
        : `Recibimos tu pedido ${newOrder.id}. Te iremos avisando cada cambio importante.`,
  });

  return newOrder;
}

export async function getOrdersByUserId(userId: string) {
  const orders = await loadOrdersByUserIdFromStore(userId);
  return orders.map(normalizeStoredOrder);
}

export async function getOrderSummariesByUserId(userId: string) {
  const userOrders = await getOrdersByUserId(userId);
  return summarizeOrders(userOrders);
}

export async function getPaginatedOrderSummariesByUserId(input: {
  userId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<
  PaginatedUserOrdersSummaryResult & {
    summaries: ReturnType<typeof summarizeOrders>["orders"];
  }
> {
  const page = await loadPaginatedUserOrdersSummaryFromStore(input);
  const orders = page.orders.map((order) => toClientSafeStoredOrder(normalizeStoredOrder(order)));
  const summaries = summarizeOrders(orders).orders;
  const latestSummary = !input.cursor ? summaries[0] ?? null : null;

  return {
    ...page,
    latestOrder: latestSummary,
    orders,
    summaries,
  };
}

export async function markOrderReviewed(orderId: string) {
  const previousOrder = await getOrderById(orderId);

  if (!previousOrder) {
    throw new Error("ORDER_NOT_FOUND");
  }

  if (previousOrder.adminReviewedAt) {
    return previousOrder;
  }

  const updatedOrder: StoredOrder = {
    ...previousOrder,
    adminReviewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await updateOrderInStore(updatedOrder);

  return updatedOrder;
}

export async function setAdminOrderStatus(input: {
  orderId: string;
  status: AdminManualOrderStatus;
  changedBy: string;
  changedByName: string;
  paymentUpdate?: Partial<OrderPaymentInfo> | null;
}) {
  const previousOrder = await getOrderById(input.orderId);

  if (!previousOrder) {
    throw new Error("ORDER_NOT_FOUND");
  }

  if (previousOrder.cancelledAt) {
    throw new Error("ORDER_ALREADY_CANCELLED");
  }

  const updatedOrder: StoredOrder = {
    ...previousOrder,
    adminStatus: input.status,
    adminReviewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    payment: mergeOrderPayment(previousOrder.payment, input.paymentUpdate),
    total:
      input.paymentUpdate?.grandTotalSrd !== undefined
        ? input.paymentUpdate.grandTotalSrd
        : previousOrder.total,
    statusHistory: [
      ...previousOrder.statusHistory,
      buildStatusHistoryEntry({
        status: input.status,
        changedBy: input.changedBy,
        changedByName: input.changedByName,
      }),
    ],
  };

  await updateOrderInStore(updatedOrder);

  if (previousOrder.adminStatus !== updatedOrder.adminStatus) {
    const notification = getOrderLifecycleNotificationPayload(
      updatedOrder,
      updatedOrder.adminStatus ?? "Pendiente de confirmacion"
    );

    if (notification) {
      await createOrderLifecycleNotification({
        order: updatedOrder,
        type: notification.type,
        title: notification.title,
        message: notification.message,
      });
    }
  }

  return {
    previousOrder,
    updatedOrder,
  };
}

export async function cancelOrderForUser(orderId: string, userId: string) {
  const previousOrder = assertOrderOwner(await getOrderById(orderId) ?? undefined, userId);

  assertOrderEditable(previousOrder);

  if (previousOrder.payment.method === "paypal" && previousOrder.payment.state === "captured") {
    throw new Error("ORDER_PAYPAL_ALREADY_CAPTURED");
  }

  const updatedOrder: StoredOrder = {
    ...previousOrder,
    cancelledAt: new Date().toISOString(),
    cancellationReason: null,
    cancelledBy: "customer",
    cancelledByName: previousOrder.customerName || "Cliente",
    updatedAt: new Date().toISOString(),
    payment: mergeOrderPayment(previousOrder.payment, {
      state:
        previousOrder.payment.method === "paypal" && previousOrder.payment.state === "authorized"
          ? "voided"
          : previousOrder.payment.state,
      paypalAuthorizationStatus:
        previousOrder.payment.method === "paypal" && previousOrder.payment.state === "authorized"
          ? "VOIDED"
          : previousOrder.payment.paypalAuthorizationStatus,
      voidedAt:
        previousOrder.payment.method === "paypal" && previousOrder.payment.state === "authorized"
          ? new Date().toISOString()
          : previousOrder.payment.voidedAt,
    }),
  };

  await updateOrderInStore(updatedOrder);
  await createOrderLifecycleNotification({
    order: updatedOrder,
    type: "order_cancelled",
    title: "Pedido cancelado",
    message: `Tu pedido ${updatedOrder.id} fue cancelado. Si necesitas ayuda, puedes escribirnos desde soporte.`,
  });

  return {
    previousOrder,
    updatedOrder,
  };
}

export async function addItemsToOrderForUser(
  orderId: string,
  userId: string,
  newItems: OrderLineItem[]
) {
  const previousOrder = assertOrderOwner(await getOrderById(orderId) ?? undefined, userId);

  assertOrderEditable(previousOrder);
  assertPayPalOrderUnlocked(previousOrder);

  const mergedItems = mergeItems(previousOrder.items, newItems);
  const recalculatedTotals = await recalculateTotalsWithRoute(previousOrder, mergedItems);

  const updatedOrder: StoredOrder = {
    ...previousOrder,
    items: mergedItems,
    subtotal: recalculatedTotals.subtotal,
    deliveryDistanceKm: recalculatedTotals.deliveryDistanceKm,
    deliveryFee: recalculatedTotals.deliveryFee,
    total:
      roundCurrency(recalculatedTotals.subtotal + recalculatedTotals.deliveryFee) +
      previousOrder.payment.feeAmountSrd,
    payment: mergeOrderPayment(previousOrder.payment, {
      baseTotalSrd: roundCurrency(recalculatedTotals.subtotal + recalculatedTotals.deliveryFee),
      grandTotalSrd:
        roundCurrency(recalculatedTotals.subtotal + recalculatedTotals.deliveryFee) +
        previousOrder.payment.feeAmountSrd,
    }),
    requestedAgentCall:
      previousOrder.deliveryType === "pickup"
        ? previousOrder.requestedAgentCall
        : recalculatedTotals.requiresAgentReview,
    updatedAt: new Date().toISOString(),
  };

  await updateOrderInStore(updatedOrder);
  await registerProductSalesFromOrder({
    soldAt: updatedOrder.updatedAt,
    items: newItems,
  });

  return {
    previousOrder,
    updatedOrder,
    addedItems: newItems,
  };
}

export async function cancelOrderFromAdmin(input: {
  orderId: string;
  reason: string;
  changedBy: string;
  changedByName: string;
  paymentUpdate?: Partial<OrderPaymentInfo> | null;
}) {
  const previousOrder = await getOrderById(input.orderId);

  if (!previousOrder) {
    throw new Error("ORDER_NOT_FOUND");
  }

  if (previousOrder.cancelledAt) {
    throw new Error("ORDER_ALREADY_CANCELLED");
  }

  if (previousOrder.payment.method === "paypal" && previousOrder.payment.state === "captured") {
    throw new Error("ORDER_PAYPAL_ALREADY_CAPTURED");
  }

  const cancelledAt = new Date().toISOString();
  const updatedOrder: StoredOrder = {
    ...previousOrder,
    cancelledAt,
    cancellationReason: input.reason,
    cancelledBy: "admin",
    cancelledByName: input.changedByName,
    adminStatus: null,
    adminReviewedAt: cancelledAt,
    updatedAt: cancelledAt,
    payment: mergeOrderPayment(previousOrder.payment, input.paymentUpdate),
    statusHistory: [
      ...previousOrder.statusHistory,
      buildStatusHistoryEntry({
        status: "Pedido cancelado",
        changedBy: input.changedBy,
        changedByName: input.changedByName,
      }),
    ],
  };

  await updateOrderInStore(updatedOrder);
  await createOrderLifecycleNotification({
    order: updatedOrder,
    type: "order_issue",
    title: "Problema con el pedido",
    message: `Recibimos tu reporte para el pedido ${updatedOrder.id}. Soporte revisara el caso y te respondera pronto.`,
  });

  return {
    previousOrder,
    updatedOrder,
  };
}

export async function updateOrderContactForUser(
  orderId: string,
  userId: string,
  input: {
    phone?: string;
    address?: string;
  }
) {
  const previousOrder = assertOrderOwner(await getOrderById(orderId) ?? undefined, userId);

  assertOrderEditable(previousOrder);
  assertPayPalOrderUnlocked(previousOrder);

  const nextPhone =
    typeof input.phone === "string" ? trimText(input.phone) : previousOrder.customerPhone;
  const nextAddress =
    typeof input.address === "string"
      ? trimText(input.address)
      : previousOrder.customerAddress;

  if (
    nextPhone === previousOrder.customerPhone &&
    nextAddress === previousOrder.customerAddress
  ) {
    throw new Error("ORDER_NO_CHANGES");
  }

  const recalculatedTotals = await recalculateTotalsWithRoute(
    {
      deliveryType: previousOrder.deliveryType,
      customerAddress: nextAddress,
      deliveryDistanceKm:
        nextAddress === previousOrder.customerAddress ? previousOrder.deliveryDistanceKm : null,
      requestedAgentCall: previousOrder.requestedAgentCall,
    },
    previousOrder.items
  );

  const updatedOrder: StoredOrder = {
    ...previousOrder,
    customerPhone: nextPhone,
    customerAddress: nextAddress,
    subtotal: recalculatedTotals.subtotal,
    deliveryDistanceKm: recalculatedTotals.deliveryDistanceKm,
    deliveryFee: recalculatedTotals.deliveryFee,
    total:
      roundCurrency(recalculatedTotals.subtotal + recalculatedTotals.deliveryFee) +
      previousOrder.payment.feeAmountSrd,
    payment: mergeOrderPayment(previousOrder.payment, {
      baseTotalSrd: roundCurrency(recalculatedTotals.subtotal + recalculatedTotals.deliveryFee),
      grandTotalSrd:
        roundCurrency(recalculatedTotals.subtotal + recalculatedTotals.deliveryFee) +
        previousOrder.payment.feeAmountSrd,
    }),
    requestedAgentCall:
      previousOrder.deliveryType === "pickup"
        ? previousOrder.requestedAgentCall
        : recalculatedTotals.requiresAgentReview,
    updatedAt: new Date().toISOString(),
  };

  await updateOrderInStore(updatedOrder);

  return {
    previousOrder,
    updatedOrder,
  };
}

export async function reportOrderIssueForUser(
  orderId: string,
  userId: string,
  message: string
) {
  const previousOrder = assertOrderOwner(await getOrderById(orderId) ?? undefined, userId);

  const issue: OrderIssueReport = {
    id: `ISS-${randomUUID().slice(0, 8).toUpperCase()}`,
    message: trimText(message),
    createdAt: new Date().toISOString(),
  };

  const updatedOrder: StoredOrder = {
    ...previousOrder,
    issues: [...previousOrder.issues, issue],
    updatedAt: new Date().toISOString(),
  };

  await updateOrderInStore(updatedOrder);

  return {
    previousOrder,
    updatedOrder,
    issue,
  };
}
