import "server-only";

import { getProductsForOrderLookup } from "@/lib/server/admin/products";
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

type ProductLookup = { id: string; name: string };

function buildProductNameMap(products: ProductLookup[]) {
  const map = new Map<string, ProductLookup>();
  for (const product of products) {
    map.set(normalizeText(product.name), product);
  }
  return map;
}

function resolveOrderItems(
  order: StoredOrder,
  productsByName: Map<string, ProductLookup>
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
  productsByName: Map<string, ProductLookup>,
  autoMode = false
): AdminOrderRecord {
  const status = getOrderStatus(order, { autoMode });

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
  autoMode?: boolean;
}) {
  const autoMode = options?.autoMode ?? false;
  const [{ orders, hasMore, nextCursor }, products] = await Promise.all([
    loadPaginatedAdminOrdersFromStore({
      status: options?.status,
      deliveryType: options?.deliveryType,
      search: options?.search,
      last4: options?.last4,
      cursor: options?.cursor,
      limit: options?.limit,
      autoMode,
    }),
    getProductsForOrderLookup(),
  ]);

  const productsByName = buildProductNameMap(products);
  return {
    orders: orders.map((order) => toAdminOrderRecord(order, productsByName, autoMode)),
    hasMore,
    nextCursor,
  };
}

export async function getAllAdminOrders() {
  const [orders, products] = await Promise.all([getAllOrders(), getProductsForOrderLookup()]);
  const productsByName = buildProductNameMap(products);
  return orders.map((order) => toAdminOrderRecord(order, productsByName));
}

export async function getAdminOrderById(orderId: string) {
  const [order, products] = await Promise.all([getOrderById(orderId), getProductsForOrderLookup()]);

  if (!order) {
    return null;
  }

  return toAdminOrderRecord(order, buildProductNameMap(products));
}

export async function getAdminOrdersMeta(): Promise<AdminOrdersMeta> {
  return loadAdminOrdersMetaFromStore();
}
