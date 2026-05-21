import { NextResponse } from "next/server";

import {
  getDebugEgressMetricsSnapshot,
  recordDebugEgressMetric,
} from "@/lib/server/debug-egress-metrics";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const snapshot = await getDebugEgressMetricsSnapshot();

    return NextResponse.json({
      success: true,
      latest: snapshot.latest,
      topByCalls: snapshot.topByCalls,
      topByPayloadKb: snapshot.topByPayloadKb,
    });
  } catch (error) {
    console.error("[debug-egress] failed to read metrics:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load debug egress metrics" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const body = (await request.json()) as Partial<{
      source: string;
      route: string;
      rowsCount: number;
      payloadKb: number;
      durationMs: number;
      cacheStatus: string;
    }>;

    if (!body.source || !body.route) {
      return NextResponse.json(
        { success: false, error: "Missing source or route" },
        { status: 400 }
      );
    }

    await recordDebugEgressMetric({
      source: String(body.source),
      route: String(body.route),
      rowsCount: Number(body.rowsCount ?? 0),
      payloadKb: Number(body.payloadKb ?? 0),
      durationMs: Number(body.durationMs ?? 0),
      cacheStatus: String(body.cacheStatus ?? "client-fetch"),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[debug-egress] failed to record metric via API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record debug egress metric" },
      { status: 500 }
    );
  }
}
