import { formatPickupLabel, PICKUP_ADDRESS } from "@/lib/shop/checkout";
import { formatCurrencySrd } from "@/lib/shop/number-format";
import type {
  AdminManualOrderStatus,
  OrderSummary,
  OrderStatusLabel,
  StoredOrder,
} from "@/lib/shop/types";

export const ORDER_EDIT_WINDOW_MS = 5 * 60 * 60 * 1000;
export const ADMIN_ORDER_STATUS_OPTIONS: AdminManualOrderStatus[] = [
  "Pendiente de confirmacion",
  "Confirmando stock",
  "Preparando pedido",
  "Pagada / Preparando",
  "Pedido aceptado",
  "Pedido listo para delivery",
  "En delivery",
  "Pedido completado",
  "Pedido confirmado",
];

function getPickupStatusDetail(order: Pick<StoredOrder, "pickupDate" | "pickupTime" | "total">) {
  if (!order.pickupDate || !order.pickupTime) {
    return `Su pedido ha sido confirmado. Direccion de recogida: ${PICKUP_ADDRESS}. Total a pagar: ${formatCurrencySrd(order.total)}.`;
  }

  return `Su pedido ha sido confirmado, recuerde ir a la direccion indicada en la fecha y hora seleccionadas y llevar la cantidad correspondiente a pagar. Direccion de recogida: ${PICKUP_ADDRESS}. Fecha y hora: ${formatPickupLabel(order.pickupDate, order.pickupTime)}. Total a pagar: ${formatCurrencySrd(order.total)}.`;
}

const DELIVERY_PROCESSING_WINDOW_MS = 12 * 60 * 60 * 1000;
const DELIVERY_COMPLETION_WINDOW_MS = 24 * 60 * 60 * 1000;

export function getOrderStatus(
  order: Pick<StoredOrder, "cancelledAt" | "createdAt" | "deliveryType" | "adminStatus">,
  options?: { autoMode?: boolean }
): OrderStatusLabel {
  if (order.cancelledAt) {
    return "Pedido cancelado";
  }

  if (order.adminStatus) {
    return order.adminStatus;
  }

  if (order.deliveryType === "pickup") {
    return "Pedido confirmado para recogida";
  }

  if (options?.autoMode) {
    const elapsedMs = Date.now() - new Date(order.createdAt).getTime();
    if (elapsedMs < DELIVERY_PROCESSING_WINDOW_MS) return "Orden confirmada y procesandose";
    if (elapsedMs < DELIVERY_COMPLETION_WINDOW_MS) return "Procesandose para delivery";
    return "Pedido completado";
  }

  return "Pendiente de confirmacion";
}

export function getOrderStatusDetail(
  order: Pick<
    StoredOrder,
    | "cancelledAt"
    | "cancellationReason"
    | "cancelledBy"
    | "deliveryType"
    | "pickupDate"
    | "pickupTime"
    | "total"
    | "adminStatus"
  >
) {
  if (order.cancelledAt) {
    if (order.cancellationReason) {
      return `Pedido cancelado. Motivo: ${order.cancellationReason}`;
    }

    if (order.cancelledBy === "admin") {
      return "El pedido fue cancelado por administracion.";
    }

    return "El pedido fue cancelado por el cliente.";
  }

  if (order.deliveryType === "pickup") {
    return getPickupStatusDetail(order);
  }

  if (order.adminStatus) {
    return null;
  }

  return null;
}

export function isOrderCompletedStatus(status: OrderStatusLabel) {
  return status === "Pedido completado";
}

export function canManageOrder(
  order: Pick<StoredOrder, "createdAt" | "cancelledAt">,
  now = Date.now()
) {
  if (order.cancelledAt) {
    return false;
  }

  return now - new Date(order.createdAt).getTime() < ORDER_EDIT_WINDOW_MS;
}

export function toOrderSummary(order: StoredOrder, isLatest: boolean): OrderSummary {
  const canManage = canManageOrder(order);
  const isAuthorizedPayPal =
    order.payment.method === "paypal" && order.payment.state === "authorized";
  const isPayPalCaptured = order.payment.method === "paypal" && order.payment.state === "captured";

  return {
    ...order,
    status: getOrderStatus(order),
    statusDetail: getOrderStatusDetail(order),
    isLatest,
    canCancel: canManage && !isPayPalCaptured,
    canAddItems: canManage && !isAuthorizedPayPal && !isPayPalCaptured,
    canEditAddress: canManage && !isAuthorizedPayPal && !isPayPalCaptured,
    canEditPhone: canManage,
    canReportIssue: true,
    pickupAddress: order.deliveryType === "pickup" ? PICKUP_ADDRESS : null,
  };
}

export function summarizeOrders(orders: StoredOrder[]) {
  const sortedOrders = [...orders].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  const latestOrderId = sortedOrders[0]?.id ?? null;
  const summaries = sortedOrders.map((order) =>
    toOrderSummary(order, order.id === latestOrderId)
  );

  return {
    latestOrder: summaries[0] ?? null,
    orders: summaries,
  };
}
