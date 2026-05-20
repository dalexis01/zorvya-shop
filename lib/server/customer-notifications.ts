import "server-only";

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  AdminManualOrderStatus,
  CustomerNotification,
  CustomerNotificationOrderSummary,
  DeliveryType,
  OrderLineItem,
  OrderStatusHistoryEntry,
  StoredOrder,
} from "@/lib/shop/types";
import { formatPickupLabel, PICKUP_ADDRESS } from "@/lib/shop/checkout";
import { getDeliveryEstimateDetails } from "@/lib/shop/delivery-estimates";
import { getOrderStatus, getOrderStatusDetail } from "@/lib/shop/order-status";
import { getCustomerPool } from "@/lib/server/customer-db";

const CUSTOMER_NOTIFICATIONS_SCHEMA_FILE = path.join(
  process.cwd(),
  "db",
  "migrations",
  "007_customer_notifications.sql"
);

type CustomerNotificationRow = {
  id: string;
  user_id: string;
  order_id: string | null;
  type: CustomerNotification["type"];
  title: string;
  message: string;
  status: CustomerNotification["status"];
  read_at: Date | string | null;
  created_at: Date | string;
};

type PendingOrderRow = {
  id: string;
  customer_address: string;
  delivery_type: DeliveryType;
  pickup_date: string | null;
  pickup_time: string | null;
  total: number | string;
  delivery_distance_km: number | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  cancelled_at: Date | string | null;
  cancellation_reason: string | null;
  cancelled_by: "customer" | "admin" | null;
  admin_status: string | null;
  status_history_json: OrderStatusHistoryEntry[] | null;
  items_json: OrderLineItem[] | null;
};

let customerNotificationsSchemaReadyPromise: Promise<void> | null = null;

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function rowToCustomerNotification(row: CustomerNotificationRow): CustomerNotification {
  return {
    id: row.id,
    userId: row.user_id,
    orderId: row.order_id,
    type: row.type,
    title: row.title,
    message: row.message,
    status: row.status,
    readAt: toIsoString(row.read_at),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
  };
}

async function ensureCustomerNotificationsSchema() {
  const pool = await getCustomerPool();
  const sql = await readFile(CUSTOMER_NOTIFICATIONS_SCHEMA_FILE, "utf8");
  await pool.query(sql);
}

async function getNotificationsPool() {
  const pool = await getCustomerPool();

  if (!customerNotificationsSchemaReadyPromise) {
    customerNotificationsSchemaReadyPromise = ensureCustomerNotificationsSchema().catch((error) => {
      customerNotificationsSchemaReadyPromise = null;
      throw error;
    });
  }

  await customerNotificationsSchemaReadyPromise;
  return pool;
}

function buildPendingOrderSummary(
  row: PendingOrderRow,
  latestMessage: string | null,
  locale: "es" | "nl" | "en" | "pt"
): CustomerNotificationOrderSummary {
  const normalizedOrder: Pick<
    StoredOrder,
    | "cancelledAt"
    | "cancellationReason"
    | "cancelledBy"
    | "deliveryType"
    | "pickupDate"
    | "pickupTime"
    | "total"
    | "adminStatus"
    | "createdAt"
  > = {
    cancelledAt: toIsoString(row.cancelled_at),
    cancellationReason: row.cancellation_reason,
    cancelledBy: row.cancelled_by,
    deliveryType: row.delivery_type,
    pickupDate: row.pickup_date,
    pickupTime: row.pickup_time,
    total: toNumber(row.total),
    adminStatus: row.admin_status as AdminManualOrderStatus | null,
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
  };

  const deliveryEstimate =
    row.delivery_type === "pickup"
      ? formatCustomerNotificationPickupLabel({
          pickupDate: row.pickup_date,
          pickupTime: row.pickup_time,
        })
      : getDeliveryEstimateDetails({
          distanceKm:
            row.delivery_distance_km === null ? null : toNumber(row.delivery_distance_km),
          locale,
          baseDate: normalizedOrder.createdAt,
        })?.dateText ?? null;

  return {
    id: row.id,
    status: getOrderStatus(normalizedOrder),
    statusDetail: getOrderStatusDetail(normalizedOrder),
    createdAt: normalizedOrder.createdAt,
    total: normalizedOrder.total,
    address:
      row.delivery_type === "pickup"
        ? PICKUP_ADDRESS
        : row.customer_address,
    deliveryType: row.delivery_type,
    pickupDate: row.pickup_date,
    pickupTime: row.pickup_time,
    lastMessage: latestMessage,
    statusHistory: Array.isArray(row.status_history_json) ? row.status_history_json : [],
    itemImages: Array.isArray(row.items_json)
      ? row.items_json
          .map((item) => (typeof item.image === "string" ? item.image.trim() : ""))
          .filter(Boolean)
          .slice(0, 4)
      : [],
    estimatedDateText: deliveryEstimate,
  };
}

export function isCustomerNotificationPendingStatus(status: string) {
  return ![
    "Pedido completado",
    "Pedido cancelado",
  ].includes(status);
}

export function getCustomerTimelineStep(status: string) {
  if (status === "Pedido completado") {
    return 3;
  }

  if (status === "En delivery") {
    return 2;
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
    return 1;
  }

  return 0;
}

export async function createCustomerNotification(input: {
  userId: string;
  orderId?: string | null;
  type: CustomerNotification["type"];
  title: string;
  message: string;
  status?: CustomerNotification["status"];
}) {
  const pool = await getNotificationsPool();
  const notification: CustomerNotification = {
    id: `NTF-${randomUUID().slice(0, 10).toUpperCase()}`,
    userId: input.userId,
    orderId: input.orderId ?? null,
    type: input.type,
    title: input.title.trim(),
    message: input.message.trim(),
    status: input.status ?? "active",
    readAt: null,
    createdAt: new Date().toISOString(),
  };

  await pool.query(
    `
      INSERT INTO customer_notifications (
        id,
        user_id,
        order_id,
        type,
        title,
        message,
        status,
        read_at,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, NULL, $8::timestamptz
      )
    `,
    [
      notification.id,
      notification.userId,
      notification.orderId,
      notification.type,
      notification.title,
      notification.message,
      notification.status,
      notification.createdAt,
    ]
  );

  return notification;
}

export async function listCustomerNotificationsByUserId(input: {
  userId: string;
  limit?: number;
  unreadOnly?: boolean;
}) {
  const pool = await getNotificationsPool();
  const limit = Math.max(1, Math.min(24, Math.trunc(input.limit ?? 10)));
  const params: Array<string | number> = [input.userId];
  const conditions = ["user_id = $1", "status = 'active'"];

  if (input.unreadOnly) {
    conditions.push("read_at IS NULL");
  }

  params.push(limit);

  const result = await pool.query<CustomerNotificationRow>(
    `
      SELECT
        id,
        user_id,
        order_id,
        type,
        title,
        message,
        status,
        read_at,
        created_at
      FROM customer_notifications
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT $${params.length}
    `,
    params
  );

  return result.rows.map(rowToCustomerNotification);
}

export async function markCustomerNotificationsRead(input: {
  userId: string;
  ids?: string[];
}) {
  const pool = await getNotificationsPool();
  const ids =
    input.ids?.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()) ??
    [];

  if (ids.length > 0) {
    await pool.query(
      `
        UPDATE customer_notifications
        SET read_at = COALESCE(read_at, NOW())
        WHERE user_id = $1
          AND id = ANY($2)
      `,
      [input.userId, ids]
    );
    return;
  }

  await pool.query(
    `
      UPDATE customer_notifications
      SET read_at = COALESCE(read_at, NOW())
      WHERE user_id = $1
        AND status = 'active'
        AND read_at IS NULL
    `,
    [input.userId]
  );
}

export async function getCustomerNotificationsPanelData(
  userId: string,
  locale: "es" | "nl" | "en" | "pt"
) {
  const pool = await getNotificationsPool();
  const [notificationsResult, pendingOrdersResult] = await Promise.all([
    pool.query<CustomerNotificationRow>(
      `
        SELECT
          id,
          user_id,
          order_id,
          type,
          title,
          message,
          status,
          read_at,
          created_at
        FROM customer_notifications
        WHERE user_id = $1
          AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 12
      `,
      [userId]
    ),
    pool.query<PendingOrderRow>(
      `
        SELECT
          id,
          customer_address,
          delivery_type,
          pickup_date,
          pickup_time,
          total,
          delivery_distance_km,
          created_at,
          updated_at,
          cancelled_at,
          cancellation_reason,
          cancelled_by,
          admin_status,
          status_history_json,
          items_json
        FROM orders
        WHERE user_id = $1
          AND cancelled_at IS NULL
          AND (admin_status IS NULL OR admin_status <> 'Pedido completado')
        ORDER BY created_at DESC
        LIMIT 8
      `,
      [userId]
    ),
  ]);

  const notifications = notificationsResult.rows.map(rowToCustomerNotification);
  const latestMessageByOrderId = new Map<string, string>();

  for (const notification of notifications) {
    if (!notification.orderId || latestMessageByOrderId.has(notification.orderId)) {
      continue;
    }

    latestMessageByOrderId.set(notification.orderId, notification.message);
  }

  const pendingOrders = pendingOrdersResult.rows
    .map((row) => buildPendingOrderSummary(row, latestMessageByOrderId.get(row.id) ?? null, locale))
    .filter((order) => isCustomerNotificationPendingStatus(order.status));

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.readAt).length,
    pendingOrders,
    hasVisibleBell: notifications.length > 0 || pendingOrders.length > 0,
  };
}

export function formatCustomerNotificationPickupLabel(order: Pick<CustomerNotificationOrderSummary, "pickupDate" | "pickupTime">) {
  if (!order.pickupDate || !order.pickupTime) {
    return null;
  }

  return formatPickupLabel(order.pickupDate, order.pickupTime);
}
