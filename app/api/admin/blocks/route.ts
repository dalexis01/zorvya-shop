import { NextResponse } from "next/server";

import {
  createDeliveryBlock,
  ensurePendingOrdersAssignedToBlocks,
  listDeliveryBlocks,
  MAX_ORDERS_PER_BLOCK,
  type BlockStatus,
} from "@/lib/server/admin/delivery-blocks-store";
import { getAdminOrdersByIds } from "@/lib/server/admin/orders";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminRequestUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const assignment = await ensurePendingOrdersAssignedToBlocks();
  const blocks = await listDeliveryBlocks();
  const orderIds = Array.from(
    new Set(
      blocks.flatMap((block) => (block.orders ?? []).map((slot) => slot.orderId))
    )
  );
  const orderRecords = orderIds.length > 0 ? await getAdminOrdersByIds(orderIds) : [];
  return NextResponse.json({ success: true, blocks, orderRecords, assignment });
}

export async function POST(request: Request) {
  const auth = await requireAdminRequestUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

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
        { status: 400 }
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

    return NextResponse.json({ success: true, block }, { status: 201 });
  } catch (err) {
    console.error("[blocks] POST error:", err);
    if (err instanceof Error && err.message.startsWith("BLOCK_LIMIT_EXCEEDED:")) {
      return NextResponse.json(
        { success: false, error: `Un bloque puede tener maximo ${MAX_ORDERS_PER_BLOCK} pedidos.` },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: false, error: "No se pudo crear el bloque." }, { status: 500 });
  }
}
