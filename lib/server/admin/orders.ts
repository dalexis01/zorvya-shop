import "server-only";

import { getAllProducts } from "@/lib/server/admin/products";
import { getAllOrders, getOrderById } from "@/lib/server/orders";
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

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function getOrderIdTail(orderId: string) {
  return orderId.slice(-4).toUpperCase();
}

function buildProductNameMap(products: Awaited<ReturnType<typeof getAllProducts>>) {
  const map = new Map<string, Awaited<ReturnType<typeof getAllProducts>>[number]>();
  for (const product of products) {
    map.set(normalizeText(product.name), product);
  }
  return map;
}

function resolveOrderItems(
  order: StoredOrder,
  productsByName: Map<string, Awaited<ReturnType<typeof getAllProducts>>[number]>
) {
  return order.items.map<AdminOrderItemRecord>((item, index) => {
    const matchedProduct = productsByName.get(normalizeText(item.name));

    return {
      ...item,
      linkedAdminProductId: matchedProduct?.id ?? null,
      href: matchedProduct
        ? `/admin/products/${matchedProduct.id}`
        : `/admin/orders/${order.id}#item-${index}`,
    };
  });
}

function toAdminOrderRecord(
  order: StoredOrder,
  productsByName: Map<string, Awaited<ReturnType<typeof getAllProducts>>[number]>
): AdminOrderRecord {
  const status = getOrderStatus(order);

  return {
    ...order,
    items: resolveOrderItems(order, productsByName),
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
}) {
  const [{ orders, hasMore, nextCursor }, products] = await Promise.all([
    loadPaginatedAdminOrdersFromStore({
      status: options?.status,
      deliveryType: options?.deliveryType,
      search: options?.search,
      last4: options?.last4,
      cursor: options?.cursor,
      limit: options?.limit,
    }),
    getAllProducts(),
  ]);

  const productsByName = buildProductNameMap(products);
  return {
    orders: orders.map((order) => toAdminOrderRecord(order, productsByName)),
    hasMore,
    nextCursor,
  };
}

export async function getAllAdminOrders() {
  const [orders, products] = await Promise.all([getAllOrders(), getAllProducts()]);
  const productsByName = buildProductNameMap(products);
  return orders.map((order) => toAdminOrderRecord(order, productsByName));
}

export async function getAdminOrderById(orderId: string) {
  const [order, products] = await Promise.all([getOrderById(orderId), getAllProducts()]);

  if (!order) {
    return null;
  }

  return toAdminOrderRecord(order, buildProductNameMap(products));
}

export async function getAdminOrdersMeta(): Promise<AdminOrdersMeta> {
  return loadAdminOrdersMetaFromStore();
}
