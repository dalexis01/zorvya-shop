import "server-only";

import { getAllOrders, getOrderById, getOrdersByIds } from "@/lib/server/orders";
import {
  loadAdminOrdersMetaFromStore,
  loadPaginatedAdminOrdersFromStore,
} from "@/lib/server/orders-store";
import {
  getOrderStatus,
  getOrderStatusDetail,
  isOrderCompletedStatus,
} from "@/lib/shop/order-status";
import type {
  AdminOrderItemRecord,
  AdminOrderRecord,
  AdminOrdersMeta,
} from "@/lib/shop/admin-types";
import type { DeliveryType, StoredOrder } from "@/lib/shop/types";

function getOrderIdTail(orderId: string) {
  return orderId.slice(-4).toUpperCase();
}

function resolveOrderItems(
  order: StoredOrder
) {
  return order.items.map<AdminOrderItemRecord>((item, index) => {
    const linkedAdminProductId =
      item.productId !== undefined &&
      item.productId !== null &&
      String(item.productId).trim().length > 0
        ? String(item.productId)
        : null;

    return {
      ...item,
      linkedAdminProductId,
      href: linkedAdminProductId
        ? `/admin/products/${linkedAdminProductId}`
        : `/admin/orders/${order.id}#item-${index}`,
    };
  });
}

function toAdminOrderRecord(
  order: StoredOrder,
  autoMode = false
): AdminOrderRecord {
  const status = getOrderStatus(order, { autoMode });

  return {
    ...order,
    items: resolveOrderItems(order),
    status,
    statusDetail: getOrderStatusDetail(order),
    isPending: !order.cancelledAt && !isOrderCompletedStatus(status),
    isCompleted: isOrderCompletedStatus(status),
    isCancelled: Boolean(order.cancelledAt),
    isNew: !order.adminReviewedAt,
    idTail: getOrderIdTail(order.id),
  };
}

export async function getAdminOrders(options?: {
  status?: "all" | "pending" | "completed" | "cancelled";
  deliveryType?: DeliveryType | "all";
  search?: string;
  last4?: string;
  cursor?: string | null;
  limit?: number;
  autoMode?: boolean;
  windowHours?: number;
}) {
  const autoMode = options?.autoMode ?? false;
  const { orders, hasMore, nextCursor } = await loadPaginatedAdminOrdersFromStore({
    status: options?.status,
    deliveryType: options?.deliveryType,
    search: options?.search,
    last4: options?.last4,
    cursor: options?.cursor,
    limit: options?.limit,
    autoMode,
    windowHours: options?.windowHours,
  });
  return {
    orders: orders.map((order) => toAdminOrderRecord(order, autoMode)),
    hasMore,
    nextCursor,
  };
}

export async function getAllAdminOrders(options?: { windowDays?: number }) {
  const orders = await getAllOrders(options);
  return orders.map((order) => toAdminOrderRecord(order));
}

export async function getAdminOrderById(orderId: string) {
  const order = await getOrderById(orderId);

  if (!order) {
    return null;
  }

  return toAdminOrderRecord(order);
}

export async function getAdminOrdersMeta(): Promise<AdminOrdersMeta> {
  return loadAdminOrdersMetaFromStore();
}

// Loads specific orders by their IDs — no pagination limit.
// Used by block creation and autoroute to get accurate data regardless of order count.
export async function getAdminOrdersByIds(ids: string[]): Promise<AdminOrderRecord[]> {
  if (ids.length === 0) return [];
  const orders = await getOrdersByIds(ids);
  return orders.map((order) => toAdminOrderRecord(order));
}
