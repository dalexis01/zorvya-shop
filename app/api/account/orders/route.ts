import { NextResponse } from "next/server";

import { getPaginatedOrderSummariesByUserId } from "@/lib/server/orders";
import { getCurrentUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "No autorizado.",
      },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limitValue = Number(searchParams.get("limit") ?? "");
  const limit = Number.isFinite(limitValue) && limitValue > 0 ? limitValue : undefined;
  const result = await getPaginatedOrderSummariesByUserId({
    userId: user.id,
    cursor,
    limit,
  });

  return NextResponse.json({
    success: true,
    latestOrder: result.latestOrder,
    orders: result.summaries,
    hasMore: result.hasMore,
    nextCursor: result.nextCursor,
  });
}
