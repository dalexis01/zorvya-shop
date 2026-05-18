import "server-only";

import { getAllAdminOrders } from "@/lib/server/admin/orders";
import { getAllProducts } from "@/lib/server/admin/products";
import type {
  AdminOrderRecord,
  DashboardOrderSnapshot,
  Product,
  RevenueAnalytics,
  RevenueChartPoint,
  RevenueComparison,
  RevenueProductPerformance,
} from "@/lib/shop/admin-types";

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const offset = day === 0 ? 6 : day - 1;
  const result = startOfDay(date);
  result.setDate(result.getDate() - offset);
  return result;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function addWeeks(date: Date, amount: number) {
  return addDays(date, amount * 7);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function buildRevenueComparison(current: number, previous: number): RevenueComparison {
  if (previous === 0) {
    return {
      current: toMoney(current),
      previous: toMoney(previous),
      changeRate: current === 0 ? 0 : null,
    };
  }

  return {
    current: toMoney(current),
    previous: toMoney(previous),
    changeRate: toMoney(((current - previous) / previous) * 100),
  };
}

function createProductLookup(products: Product[]) {
  const byId = new Map(products.map((product) => [product.id, product]));
  const byName = new Map(products.map((product) => [normalizeText(product.name), product]));

  return {
    byId,
    byName,
  };
}

function getTrackedUnitCost(product: Product | undefined) {
  if (!product) {
    return null;
  }

  if (product.internal.costPrice > 0) {
    return product.internal.costPrice;
  }

  if (product.internal.purchasePrice > 0) {
    return product.internal.purchasePrice;
  }

  return null;
}

function resolveOrderItemProduct(
  item: AdminOrderRecord["items"][number],
  lookup: ReturnType<typeof createProductLookup>
) {
  if (item.linkedAdminProductId) {
    const matchedById = lookup.byId.get(item.linkedAdminProductId);

    if (matchedById) {
      return matchedById;
    }
  }

  return lookup.byName.get(normalizeText(item.name));
}

function calculateOrderCogs(
  order: AdminOrderRecord,
  lookup: ReturnType<typeof createProductLookup>
) {
  return toMoney(
    order.items.reduce((sum, item) => {
      const matchedProduct = resolveOrderItemProduct(item, lookup);
      const unitCost = getTrackedUnitCost(matchedProduct);

      if (unitCost === null) {
        return sum;
      }

      return sum + unitCost * item.quantity;
    }, 0)
  );
}

function buildChartPoint(
  label: string,
  orders: AdminOrderRecord[],
  lookup: ReturnType<typeof createProductLookup>
): RevenueChartPoint {
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);
  const profit = orders.reduce((sum, order) => sum + (order.total - calculateOrderCogs(order, lookup)), 0);

  return {
    label,
    revenue: toMoney(revenue),
    profit: toMoney(profit),
    orders: orders.length,
  };
}

function buildRecentOrders(orders: AdminOrderRecord[]): DashboardOrderSnapshot[] {
  return orders.slice(0, 6).map((order) => ({
    id: order.id,
    customerName: order.customerName,
    total: order.total,
    status: order.status,
    createdAt: order.createdAt,
  }));
}

export async function getRevenueAnalytics(windowDays = 90): Promise<RevenueAnalytics> {
  // windowDays limits the orders loaded (default: last 90 days).
  // getAllProducts uses the 5-min cache — no extra scan when called alongside the dashboard.
  const [orders, products] = await Promise.all([
    getAllAdminOrders({ windowDays }),
    getAllProducts(),
  ]);
  const lookup = createProductLookup(products);
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = addDays(todayStart, -1);
  const weekStart = startOfWeek(now);
  const previousWeekStart = addWeeks(weekStart, -1);
  const monthStart = startOfMonth(now);
  const previousMonthStart = addMonths(monthStart, -1);

  const validOrders = orders.filter((order) => !order.isCancelled);
  const completedOrders = validOrders.filter((order) => order.isCompleted);
  const ordersToday = validOrders.filter((order) => new Date(order.createdAt) >= todayStart);
  const ordersYesterday = validOrders.filter((order) => {
    const createdAt = new Date(order.createdAt);
    return createdAt >= yesterdayStart && createdAt < todayStart;
  });
  const ordersThisWeek = validOrders.filter((order) => new Date(order.createdAt) >= weekStart);
  const ordersPreviousWeek = validOrders.filter((order) => {
    const createdAt = new Date(order.createdAt);
    return createdAt >= previousWeekStart && createdAt < weekStart;
  });
  const ordersThisMonth = validOrders.filter((order) => new Date(order.createdAt) >= monthStart);
  const ordersPreviousMonth = validOrders.filter((order) => {
    const createdAt = new Date(order.createdAt);
    return createdAt >= previousMonthStart && createdAt < monthStart;
  });

  const performance = new Map<string, RevenueProductPerformance>();

  for (const order of validOrders) {
    for (const item of order.items) {
      const matchedProduct = resolveOrderItemProduct(item, lookup);
      const unitCost = getTrackedUnitCost(matchedProduct);
      const revenue = item.price * item.quantity;
      const cogs = unitCost === null ? 0 : unitCost * item.quantity;
      const key = matchedProduct?.id ?? `item:${normalizeText(item.name)}`;
      const current = performance.get(key);

      performance.set(key, {
        key,
        name: matchedProduct?.name ?? item.name,
        linkedProductId: matchedProduct?.id ?? null,
        unitsSold: (current?.unitsSold ?? 0) + item.quantity,
        ordersCount: (current?.ordersCount ?? 0) + 1,
        revenue: toMoney((current?.revenue ?? 0) + revenue),
        cogs: toMoney((current?.cogs ?? 0) + cogs),
        profit: toMoney((current?.profit ?? 0) + (revenue - cogs)),
        averageSalePrice: 0,
        marginRate: 0,
        costTracked: Boolean(current?.costTracked) || unitCost !== null,
      });
    }
  }

  const productPerformance = [...performance.values()]
    .map((entry) => {
      const averageSalePrice = entry.unitsSold > 0 ? entry.revenue / entry.unitsSold : 0;
      const marginRate = entry.revenue > 0 ? ((entry.revenue - entry.cogs) / entry.revenue) * 100 : 0;

      return {
        ...entry,
        averageSalePrice: toMoney(averageSalePrice),
        marginRate: toMoney(marginRate),
      };
    })
    .sort((left, right) => right.profit - left.profit);

  const revenueToday = toMoney(ordersToday.reduce((sum, order) => sum + order.total, 0));
  const revenueThisWeek = toMoney(ordersThisWeek.reduce((sum, order) => sum + order.total, 0));
  const revenueThisMonth = toMoney(ordersThisMonth.reduce((sum, order) => sum + order.total, 0));
  const totalRevenue = toMoney(validOrders.reduce((sum, order) => sum + order.total, 0));
  const productRevenueTotal = toMoney(validOrders.reduce((sum, order) => sum + order.subtotal, 0));
  const deliveryRevenueTotal = toMoney(validOrders.reduce((sum, order) => sum + order.deliveryFee, 0));
  const cogsTotal = toMoney(productPerformance.reduce((sum, product) => sum + product.cogs, 0));
  const grossProfit = toMoney(totalRevenue - cogsTotal);
  const netProfit = grossProfit;
  const averageOrderValue = validOrders.length > 0 ? toMoney(totalRevenue / validOrders.length) : 0;
  const completedRevenue = toMoney(completedOrders.reduce((sum, order) => sum + order.total, 0));
  const cancelledValue = toMoney(
    orders.filter((order) => order.isCancelled).reduce((sum, order) => sum + order.total, 0)
  );
  const trackedProductCount = productPerformance.filter((product) => product.costTracked).length;
  const untrackedProductCount = productPerformance.filter((product) => !product.costTracked).length;
  const totalUnitsSold = productPerformance.reduce((sum, product) => sum + product.unitsSold, 0);

  const dailySeries = Array.from({ length: 7 }, (_, index) => {
    const periodStart = addDays(todayStart, index - 6);
    const periodEnd = addDays(periodStart, 1);
    const periodOrders = validOrders.filter((order) => {
      const createdAt = new Date(order.createdAt);
      return createdAt >= periodStart && createdAt < periodEnd;
    });

    return buildChartPoint(
      periodStart.toLocaleDateString(undefined, { weekday: "short" }),
      periodOrders,
      lookup
    );
  });

  const weeklySeries = Array.from({ length: 8 }, (_, index) => {
    const periodStart = addWeeks(weekStart, index - 7);
    const periodEnd = addWeeks(periodStart, 1);
    const periodOrders = validOrders.filter((order) => {
      const createdAt = new Date(order.createdAt);
      return createdAt >= periodStart && createdAt < periodEnd;
    });

    return buildChartPoint(
      `Sem ${periodStart.toLocaleDateString(undefined, { day: "2-digit", month: "short" })}`,
      periodOrders,
      lookup
    );
  });

  const monthlySeries = Array.from({ length: 6 }, (_, index) => {
    const periodStart = addMonths(monthStart, index - 5);
    const periodEnd = addMonths(periodStart, 1);
    const periodOrders = validOrders.filter((order) => {
      const createdAt = new Date(order.createdAt);
      return createdAt >= periodStart && createdAt < periodEnd;
    });

    return buildChartPoint(
      periodStart.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      periodOrders,
      lookup
    );
  });

  return {
    revenueToday,
    revenueThisWeek,
    revenueThisMonth,
    totalRevenue,
    productRevenueTotal,
    deliveryRevenueTotal,
    cogsTotal,
    grossProfit,
    netProfit,
    averageOrderValue,
    totalOrders: orders.length,
    pendingOrders: orders.filter((order) => order.isPending).length,
    completedOrders: orders.filter((order) => order.isCompleted).length,
    cancelledOrders: orders.filter((order) => order.isCancelled).length,
    completedRevenue,
    cancelledValue,
    trackedProductCount,
    untrackedProductCount,
    totalUnitsSold,
    todayComparison: buildRevenueComparison(
      revenueToday,
      ordersYesterday.reduce((sum, order) => sum + order.total, 0)
    ),
    weekComparison: buildRevenueComparison(
      revenueThisWeek,
      ordersPreviousWeek.reduce((sum, order) => sum + order.total, 0)
    ),
    monthComparison: buildRevenueComparison(
      revenueThisMonth,
      ordersPreviousMonth.reduce((sum, order) => sum + order.total, 0)
    ),
    dailySeries,
    weeklySeries,
    monthlySeries,
    productPerformance,
    recentOrders: buildRecentOrders(
      [...orders].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      )
    ),
  };
}
