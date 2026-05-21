import { NextResponse } from "next/server";

import { logApiResponseMetrics } from "@/lib/server/api-response-metrics";
import {
  createDeliveryBlock,
  listDeliveryBlocks,
  MAX_ORDERS_PER_BLOCK,
  type BlockStatus,
} from "@/lib/server/admin/delivery-blocks-store";
import { getAdminOrdersByIds } from "@/lib/server/admin/orders";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  console.log("[api-metrics] admin blocks route called");
  const auth = await requireAdminRequestUser();
  if (!auth.user) {
    return NextResponse.json(
      { success: false, error: auth.error },
      {
        status: auth.status,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "x-api-metrics-debug": "true",
        },
      }
    );
  }

  const blocks = await listDeliveryBlocks();

  // Only fetch order records for active blocks (not completed/cancelled) to reduce DB load
  const activeBlocks = blocks.filter((b) => b.status !== "completed" && b.status !== "cancelled");
  const orderIds = Array.from(
    new Set(activeBlocks.flatMap((block) => (block.orders ?? []).map((slot) => slot.orderId)))
  );
  const orderRecords = orderIds.length > 0 ? await getAdminOrdersByIds(orderIds) : [];
  const payload = { success: true, blocks, orderRecords };
  console.log("[api-metrics] admin blocks payload", {
    count: (blocks?.length ?? 0) + (orderRecords?.length ?? 0),
    kb: Math.round(JSON.stringify({ blocks, orderRecords }).length / 1024),
  });
  logApiResponseMetrics({
    endpoint: "/api/admin/blocks",
    payload,
    rowCount: blocks.length + orderRecords.length,
  });

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "x-api-metrics-debug": "true",
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminRequestUser();
  if (!auth.user) {
    return NextResponse.json(
      { success: false, error: auth.error },
      {
        status: auth.status,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "x-api-metrics-debug": "true",
        },
      }
    );
  }

  try {
    const body = (await request.json()) as { name?: string; orderIds?: string[]; initialStatus?: BlockStatus };

    if (!body.name?.trim()) {
      return NextResponse.json({ success: false, error: "Nombre del bloque requerido." }, { status: 400 });
    }

    const orderIds = Array.isArray(body.orderIds) ? body.orderIds.filter(Boolean) : [];

    if (orderIds.length > MAX_ORDERS_PER_BLOCK) {
      return NextResponse.json(
        {
          success: false,
          error: `Un bloque puede tener máximo ${MAX_ORDERS_PER_BLOCK} pedidos. Tienes ${orderIds.length} seleccionados.`,
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "x-api-metrics-debug": "true",
          },
        }
      );
    }

    // Compute totals using direct ID lookup — no pagination limit.
    let totalAmount = 0;
    let totalDeliveryFee = 0;

    if (orderIds.length > 0) {
      const selectedOrders = await getAdminOrdersByIds(orderIds);
      totalAmount      = selectedOrders.reduce((s, o) => s + o.total,       0);
      totalDeliveryFee = selectedOrders.reduce((s, o) => s + o.deliveryFee, 0);
    }

    const block = await createDeliveryBlock({
      name: body.name.trim(),
      orderIds,
      totalAmount,
      totalDeliveryFee,
      createdBy: auth.user.id,
      initialStatus: body.initialStatus,
    });

    return NextResponse.json(
      { success: true, block },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "x-api-metrics-debug": "true",
        },
      }
    );
  } catch (err) {
    console.error("[blocks] POST error:", err);
    if (err instanceof Error && err.message.startsWith("BLOCK_LIMIT_EXCEEDED:")) {
      return NextResponse.json(
        { success: false, error: `Un bloque puede tener maximo ${MAX_ORDERS_PER_BLOCK} pedidos.` },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "x-api-metrics-debug": "true",
          },
        }
      );
    }
    return NextResponse.json(
      { success: false, error: "No se pudo crear el bloque." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "x-api-metrics-debug": "true",
        },
      }
    );
  }
}
