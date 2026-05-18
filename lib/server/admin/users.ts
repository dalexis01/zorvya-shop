import "server-only";

import { getCustomerPool } from "@/lib/server/customer-db";
import { getProductsForOrderLookup } from "@/lib/server/admin/products";
import { loadOrdersByUserIdFromStore } from "@/lib/server/orders-store";
import { updateUserBlockedState } from "@/lib/server/users";
import {
  getOrderStatus,
  getOrderStatusDetail,
  isOrderCompletedStatus,
} from "@/lib/shop/order-status";
import type { AdminOrderRecord, AdminUserProfile, AdminUserRecord } from "@/lib/shop/admin-types";
import type { StoredOrder } from "@/lib/shop/types";

type UserWithStats = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  phone: string | null;
  address: string | null;
  is_blocked: boolean;
  blocked_at: string | null;
  accepted_terms_at: string | null;
  accepted_terms_version: string | null;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
  order_count: string;
  total_spent: string;
  last_order_at: string | null;
};

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function rowToAdminUserRecord(row: UserWithStats): AdminUserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    phone: row.phone ?? "",
    address: row.address ?? "",
    isBlocked: Boolean(row.is_blocked),
    blockedAt: row.blocked_at ?? null,
    acceptedTermsAt: row.accepted_terms_at ?? null,
    acceptedTermsVersion: row.accepted_terms_version ?? null,
    emailVerifiedAt: row.email_verified_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    orderCount: Number(row.order_count),
    totalSpent: toMoney(Number(row.total_spent)),
    lastOrderAt: row.last_order_at ?? null,
  };
}

function ordersToAdminRecords(
  orders: StoredOrder[],
  productsByName: Map<string, { id: string; name: string }>
): AdminOrderRecord[] {
  return orders.map((order) => {
    const status = getOrderStatus(order);
    const items = order.items.map((item, index) => {
      const matched = productsByName.get(item.name.trim().toLowerCase());
      return {
        ...item,
        linkedAdminProductId: matched?.id ?? null,
        href: matched
          ? `/admin/products/${matched.id}`
          : `/admin/orders/${order.id}#item-${index}`,
      };
    });
    return {
      ...order,
      items,
      status,
      statusDetail: getOrderStatusDetail(order),
      isPending: !order.cancelledAt && !isOrderCompletedStatus(status),
      isCompleted: isOrderCompletedStatus(status),
      isCancelled: Boolean(order.cancelledAt),
      isNew: !order.adminReviewedAt,
      idTail: order.id.slice(-4).toUpperCase(),
    };
  });
}

// Single SQL JOIN — replaces getAllUsers() + getAllOrders() (2 full table scans).
export async function getAdminUsers(options?: { search?: string }): Promise<AdminUserRecord[]> {
  const pool = await getCustomerPool();
  const search = options?.search?.trim().toLowerCase() ?? "";

  const params: unknown[] = [];
  let searchClause = "";

  if (search) {
    params.push(`%${search}%`);
    const p = params.length;
    searchClause = `AND (LOWER(u.name) LIKE $${p} OR LOWER(u.email) LIKE $${p} OR COALESCE(u.phone,'') LIKE $${p} OR LOWER(COALESCE(u.address,'')) LIKE $${p})`;
  }

  const result = await pool.query<UserWithStats>(
    `SELECT
       u.id, u.name, u.email, u.password_hash, u.phone, u.address,
       u.is_blocked, u.blocked_at,
       u.accepted_terms_at, u.accepted_terms_version,
       u.email_verified_at, u.created_at, u.updated_at,
       COUNT(o.id)::text                                                           AS order_count,
       COALESCE(SUM(o.total) FILTER (WHERE o.cancelled_at IS NULL), 0)::text      AS total_spent,
       MAX(o.created_at)                                                           AS last_order_at
     FROM users u
     LEFT JOIN orders o ON o.user_id = u.id
     WHERE 1=1 ${searchClause}
     GROUP BY u.id
     ORDER BY u.created_at DESC, u.id DESC`,
    params
  );

  return result.rows.map(rowToAdminUserRecord);
}

// Replaces 3 full-table scans with 2 targeted queries by userId.
export async function getAdminUserProfile(userId: string): Promise<AdminUserProfile | null> {
  const pool = await getCustomerPool();

  const [userResult, userOrders, products] = await Promise.all([
    pool.query<UserWithStats>(
      `SELECT
         u.id, u.name, u.email, u.password_hash, u.phone, u.address,
         u.is_blocked, u.blocked_at,
         u.accepted_terms_at, u.accepted_terms_version,
         u.email_verified_at, u.created_at, u.updated_at,
         COUNT(o.id)::text                                                           AS order_count,
         COALESCE(SUM(o.total) FILTER (WHERE o.cancelled_at IS NULL), 0)::text      AS total_spent,
         MAX(o.created_at)                                                           AS last_order_at
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [userId]
    ),
    loadOrdersByUserIdFromStore(userId),
    getProductsForOrderLookup(),
  ]);

  if (!userResult.rows[0]) return null;

  const profile = rowToAdminUserRecord(userResult.rows[0]);
  const productsByName = new Map(products.map((p) => [p.name.trim().toLowerCase(), p]));
  const orders = ordersToAdminRecords(userOrders, productsByName);

  return { ...profile, orders };
}

export async function setAdminUserBlockedState(userId: string, isBlocked: boolean) {
  return updateUserBlockedState(userId, isBlocked);
}
