import { NextResponse } from "next/server";

import { logApiResponseMetrics } from "@/lib/server/api-response-metrics";
import { getRevenueAnalytics } from "@/lib/server/admin/analytics";
import { getAllSupportMessages, getPendingSupportMessages } from "@/lib/server/admin/support";
import { getLowStockProducts, getProductStats } from "@/lib/server/admin/products";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";
import { getDashboardOrderStats } from "@/lib/server/orders-store";
import { getBlockedUserCount } from "@/lib/server/users";

export const dynamic = "force-dynamic";

const DASHBOARD_CACHE_TTL_MS = 300_000;

let dashboardStatsCache:
  | {
      expiresAt: number;
      value: Record<string, unknown>;
    }
  | null = null;

export async function GET() {
  try {
    console.log("[api-metrics] admin dashboard route called");
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const cachedStats =
      dashboardStatsCache && dashboardStatsCache.expiresAt > Date.now()
        ? dashboardStatsCache.value
        : null;

    let stats = cachedStats;

    if (!stats) {
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

      stats = {
        totalProducts: productStats.total,
        activeProducts: productStats.active,
        lowStockProducts,
        totalOrders: orderStats?.totalOrders ?? 0,
        pendingOrders: orderStats?.pendingOrders ?? 0,
        completedOrders: orderStats?.completedOrders ?? 0,
        ordersToday: orderStats?.ordersToday ?? 0,
        ordersThisWeek: orderStats?.ordersThisWeek ?? 0,
        ordersThisMonth: orderStats?.ordersThisMonth ?? 0,
        totalRevenue: orderStats?.totalRevenue ?? 0,
        revenueToday: orderStats?.revenueToday ?? 0,
        revenueThisWeek: orderStats?.revenueThisWeek ?? 0,
        revenueThisMonth: orderStats?.revenueThisMonth ?? 0,
        cancelledOrders: orderStats?.cancelledOrders ?? 0,
        cancelledValue: orderStats?.cancelledValue ?? 0,
        cogsTotal: revenue.cogsTotal,
        grossProfit: revenue.grossProfit,
        netProfit: revenue.netProfit,
        trackedProductCount: revenue.trackedProductCount,
        untrackedProductCount: revenue.untrackedProductCount,
        totalUnitsSold: revenue.totalUnitsSold,
        topProducts: revenue.productPerformance.slice(0, 5),
        revenueSeries: revenue.dailySeries,
        recentOrders: orderStats?.recentOrders ?? [],
        pendingSupportMessages: supportMessages.length,
        recentSupportMessages: allSupportMessages.slice(0, 5),
        blockedUsers,
      };

      dashboardStatsCache = {
        expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
        value: stats,
      };
    }

    const payload = { success: true, stats };
    console.log("[api-metrics] admin dashboard payload", {
      count: 1,
      kb: Math.round(JSON.stringify(stats).length / 1024),
    });
    logApiResponseMetrics({
      endpoint: "/api/admin/dashboard",
      payload,
      rowCount: Array.isArray((stats as { recentOrders?: unknown[] }).recentOrders)
        ? ((stats as { recentOrders?: unknown[] }).recentOrders?.length ?? 0)
        : 0,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load dashboard stats" },
      { status: 500 }
    );
  }
}
