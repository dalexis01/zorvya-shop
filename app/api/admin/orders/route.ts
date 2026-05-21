import { NextResponse } from "next/server";

import { logApiResponseMetrics } from "@/lib/server/api-response-metrics";
import { getAdminOrders } from "@/lib/server/admin/orders";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";
import type { DeliveryType } from "@/lib/shop/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") ?? "all") as
      | "all"
      | "pending"
      | "completed"
      | "cancelled";
    const deliveryType = (searchParams.get("deliveryType") ?? "all") as
      | DeliveryType
      | "all";
    const search = searchParams.get("search") ?? undefined;
    const last4 = searchParams.get("last4") ?? undefined;
    const cursor = searchParams.get("cursor");
    const limitValue = Number(searchParams.get("limit") ?? "");
    const limit = Number.isFinite(limitValue) && limitValue > 0 ? limitValue : undefined;
    const autoMode = searchParams.get("autoMode") === "true";
    const noWindow = searchParams.get("noWindow") === "true";

    // Default: last 24 h only. Removed when search is active or user explicitly requests older orders.
    const windowHours = (search || last4 || noWindow) ? undefined : 24;

    const result = await getAdminOrders({
      status,
      deliveryType,
      search,
      last4,
      cursor,
      limit,
      autoMode,
      windowHours,
    });

    const payload = {
      success: true,
      orders: result.orders,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    };
    logApiResponseMetrics({
      endpoint: "/api/admin/orders",
      payload,
      rowCount: result.orders.length,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("Failed to get admin orders:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to get orders",
      },
      { status: 500 }
    );
  }
}
