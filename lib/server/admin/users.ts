import "server-only";

import { getAllAdminOrders } from "@/lib/server/admin/orders";
import { getAllOrders } from "@/lib/server/orders";
import { getAllUsers, updateUserBlockedState } from "@/lib/server/users";
import type { AdminUserProfile, AdminUserRecord } from "@/lib/shop/admin-types";
import type { StoredOrder } from "@/lib/shop/types";

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function buildAdminUserRecord(user: Awaited<ReturnType<typeof getAllUsers>>[number], orders: StoredOrder[]): AdminUserRecord {
  const userOrders = orders.filter((order) => order.userId === user.id);
  const totalSpent = toMoney(
    userOrders
      .filter((order) => !order.cancelledAt)
      .reduce((sum, order) => sum + order.total, 0)
  );
  const lastOrder = userOrders
    .slice()
    .sort((left, right) => {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    })[0];

  return {
    ...user,
    isBlocked: Boolean(user.isBlocked),
    blockedAt: user.blockedAt ?? null,
    orderCount: userOrders.length,
    totalSpent,
    lastOrderAt: lastOrder?.createdAt ?? null,
  };
}

export async function getAdminUsers(options?: { search?: string }) {
  const [users, orders] = await Promise.all([getAllUsers(), getAllOrders()]);

  const normalizedSearch = options?.search?.trim().toLowerCase() ?? "";

  return users
    .map((user) => buildAdminUserRecord(user, orders))
    .filter((user) => {
      if (!normalizedSearch) {
        return true;
      }

      return [user.name, user.email, user.phone, user.address]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    })
    .sort((left, right) => {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
}

export async function getAdminUserProfile(userId: string): Promise<AdminUserProfile | null> {
  const [users, orders, adminOrders] = await Promise.all([
    getAllUsers(),
    getAllOrders(),
    getAllAdminOrders(),
  ]);
  const user = users.find((item) => item.id === userId);

  if (!user) {
    return null;
  }

  const profile = buildAdminUserRecord(user, orders);

  return {
    ...profile,
    orders: adminOrders.filter((order) => order.userId === userId),
  };
}

export async function setAdminUserBlockedState(userId: string, isBlocked: boolean) {
  return updateUserBlockedState(userId, isBlocked);
}
