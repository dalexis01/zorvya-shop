import { NextResponse } from "next/server";

import { getRevenueAnalytics } from "@/lib/server/admin/analytics";
import { getAllSupportMessages, getPendingSupportMessages } from "@/lib/server/admin/support";
import { getLowStockProducts, getProductStats } from "@/lib/server/admin/products";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";
import { getDashboardOrderStats } from "@/lib/server/orders-store";
import { getBlockedUserCount } from "@/lib/server/users";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    // All queries run in parallel.
    // getDashboardOrderStats()  → 2 targeted SQL queries (counts + recent rows)  replaces 3 full-table scans
    // getProductStats()         → 1 COUNT query                                  replaces getAllProducts()
    // getRevenueAnalytics(90)   → orders limited to last 90 days                 replaces unbounded getAllAdminOrders()
    // getBlockedUserCount()     → 1 COUNT query                                  replaces getAllUsers()
    // getLowStockProducts()     → already targeted SQL
    // support messages          → filesystem only (fast)
    const [
      orderStats,
      productStats,
      revenue,
      lowStockProducts,
      blockedUsers,
      supportMessages,
      allSupportMessages,
    ] = await Promise.all([
      getDashboardOrderStats(),
      getProductStats(),
      getRevenueAnalytics(90),
      getLowStockProducts(5),
      getBlockedUserCount(),
      getPendingSupportMessages(),
      getAllSupportMessages(),
    ]);

    const stats = {
      // Product counts
      totalProducts:    productStats.total,
      activeProducts:   productStats.active,
      lowStockProducts,

      // Order counts (from aggregated SQL — no full scan)
      totalOrders:     orderStats?.totalOrders     ?? 0,
      pendingOrders:   orderStats?.pendingOrders   ?? 0,
      completedOrders: orderStats?.completedOrders ?? 0,
      ordersToday:     orderStats?.ordersToday     ?? 0,
      ordersThisWeek:  orderStats?.ordersThisWeek  ?? 0,
      ordersThisMonth: orderStats?.ordersThisMonth ?? 0,

      // Revenue (from aggregated SQL — no full scan)
      totalRevenue:    orderStats?.totalRevenue    ?? 0,
      revenueToday:    orderStats?.revenueToday    ?? 0,
      revenueThisWeek: orderStats?.revenueThisWeek ?? 0,
      revenueThisMonth:orderStats?.revenueThisMonth?? 0,
      cancelledOrders: orderStats?.cancelledOrders ?? 0,
      cancelledValue:  orderStats?.cancelledValue  ?? 0,

      // Revenue analytics (90-day window — product performance, charts, COGS)
      cogsTotal:          revenue.cogsTotal,
      grossProfit:        revenue.grossProfit,
      netProfit:          revenue.netProfit,
      trackedProductCount:revenue.trackedProductCount,
      untrackedProductCount: revenue.untrackedProductCount,
      totalUnitsSold:     revenue.totalUnitsSold,
      topProducts:        revenue.productPerformance.slice(0, 5),
      revenueSeries:      revenue.dailySeries,

      // Recent orders (from lightweight 6-row query)
      recentOrders: orderStats?.recentOrders ?? [],

      // Support
      pendingSupportMessages: supportMessages.length,
      recentSupportMessages:  allSupportMessages.slice(0, 5),

      // Users
      blockedUsers,
    };

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load dashboard stats" },
      { status: 500 }
    );
  }
}
