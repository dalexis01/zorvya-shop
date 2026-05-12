import { NextResponse } from "next/server";

import { getRevenueAnalytics } from "@/lib/server/admin/analytics";
import { getAllAdminOrders } from "@/lib/server/admin/orders";
import { getAllSupportMessages, getPendingSupportMessages } from "@/lib/server/admin/support";
import { getAllProducts, getLowStockProducts } from "@/lib/server/admin/products";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";
import { getAdminUsers } from "@/lib/server/admin/users";

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

    const [products, orders, supportMessages, lowStockProducts, users, revenue, allSupportMessages] =
      await Promise.all([
      getAllProducts(),
      getAllAdminOrders(),
      getPendingSupportMessages(),
      getLowStockProducts(5),
      getAdminUsers(),
      getRevenueAnalytics(),
      getAllSupportMessages(),
    ]);

    const stats = {
      totalProducts: products.length,
      activeProducts: products.filter((product) => product.isActive).length,
      lowStockProducts,
      totalOrders: orders.length,
      ordersToday: revenue.dailySeries[revenue.dailySeries.length - 1]?.orders ?? 0,
      ordersThisWeek: revenue.weeklySeries[revenue.weeklySeries.length - 1]?.orders ?? 0,
      ordersThisMonth: revenue.monthlySeries[revenue.monthlySeries.length - 1]?.orders ?? 0,
      pendingOrders: orders.filter((order) => order.isPending).length,
      completedOrders: orders.filter((order) => order.isCompleted).length,
      totalRevenue: revenue.totalRevenue,
      revenueToday: revenue.revenueToday,
      revenueThisWeek: revenue.revenueThisWeek,
      revenueThisMonth: revenue.revenueThisMonth,
      pendingSupportMessages: supportMessages.length,
      blockedUsers: users.filter((user) => user.isBlocked).length,
      cogsTotal: revenue.cogsTotal,
      grossProfit: revenue.grossProfit,
      netProfit: revenue.netProfit,
      cancelledOrders: revenue.cancelledOrders,
      cancelledValue: revenue.cancelledValue,
      trackedProductCount: revenue.trackedProductCount,
      untrackedProductCount: revenue.untrackedProductCount,
      totalUnitsSold: revenue.totalUnitsSold,
      topProducts: revenue.productPerformance.slice(0, 5),
      revenueSeries: revenue.dailySeries,
      recentOrders: revenue.recentOrders,
      recentSupportMessages: allSupportMessages.slice(0, 5),
    };

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Dashboard error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load dashboard stats",
      },
      { status: 500 }
    );
  }
}
