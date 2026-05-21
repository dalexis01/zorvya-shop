import { NextResponse } from "next/server";

import { logApiResponseMetrics } from "@/lib/server/api-response-metrics";
import { getAdminOrdersMeta } from "@/lib/server/admin/orders";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const dynamic = "force-dynamic";

const ORDERS_META_TTL_MS = 60_000;

let ordersMetaCache:
  | {
      expiresAt: number;
      value: Awaited<ReturnType<typeof getAdminOrdersMeta>>;
    }
  | null = null;

export async function GET() {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const meta =
      ordersMetaCache && ordersMetaCache.expiresAt > Date.now()
        ? ordersMetaCache.value
        : await getAdminOrdersMeta();

    if (!ordersMetaCache || ordersMetaCache.value !== meta) {
      ordersMetaCache = {
        expiresAt: Date.now() + ORDERS_META_TTL_MS,
        value: meta,
      };
    }

    const payload = {
      success: true,
      meta,
    };
    logApiResponseMetrics({
      endpoint: "/api/admin/orders/meta",
      payload,
      rowCount: 1,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("Failed to get admin orders meta:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to get orders meta",
      },
      { status: 500 }
    );
  }
}
