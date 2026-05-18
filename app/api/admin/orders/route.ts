import { NextResponse } from "next/server";

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
    const result = await getAdminOrders({
      status,
      deliveryType,
      search,
      last4,
      cursor,
      limit,
      autoMode,
    });

    // Debug log for blocks tab — helps diagnose why orders may not appear in route blocks
    if (status === "pending" && deliveryType === "delivery") {
      const eligible = result.orders.filter(
        (o) => o.deliveryType === "delivery" && !o.isCancelled && !o.isCompleted
      );
      console.info(
        `[admin/orders] blocks tab: ${result.orders.length} loaded, ${eligible.length} route-eligible` +
        (result.orders.length !== eligible.length
          ? ` (${result.orders.length - eligible.length} excluded: ${
              result.orders
                .filter((o) => !(o.deliveryType === "delivery" && !o.isCancelled && !o.isCompleted))
                .map((o) => `${o.idTail}:type=${o.deliveryType},completed=${o.isCompleted},cancelled=${o.isCancelled}`)
                .join(", ")
            })`
          : "")
      );
    }

    return NextResponse.json({
      success: true,
      orders: result.orders,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
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
