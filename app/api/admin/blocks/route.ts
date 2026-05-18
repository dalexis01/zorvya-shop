import { NextResponse } from "next/server";

import {
  createDeliveryBlock,
  getAssignedOrderIds,
  listDeliveryBlocks,
} from "@/lib/server/admin/delivery-blocks-store";
import { getAdminOrders } from "@/lib/server/admin/orders";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminRequestUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const blocks = await listDeliveryBlocks();
  return NextResponse.json({ success: true, blocks });
}

export async function POST(request: Request) {
  const auth = await requireAdminRequestUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  try {
    const body = (await request.json()) as { name?: string; orderIds?: string[] };

    if (!body.name?.trim()) {
      return NextResponse.json({ success: false, error: "Nombre del bloque requerido." }, { status: 400 });
    }

    const orderIds = Array.isArray(body.orderIds) ? body.orderIds.filter(Boolean) : [];

    // Compute totals from actual orders
    let totalAmount = 0;
    let totalDeliveryFee = 0;

    if (orderIds.length > 0) {
      const { orders } = await getAdminOrders({ status: "pending", deliveryType: "delivery" });
      const selectedOrders = orders.filter((o) => orderIds.includes(o.id));
      totalAmount = selectedOrders.reduce((s, o) => s + o.total, 0);
      totalDeliveryFee = selectedOrders.reduce((s, o) => s + o.deliveryFee, 0);
    }

    const block = await createDeliveryBlock({
      name: body.name.trim(),
      orderIds,
      totalAmount,
      totalDeliveryFee,
      createdBy: auth.user.id,
    });

    return NextResponse.json({ success: true, block }, { status: 201 });
  } catch (err) {
    console.error("[blocks] POST error:", err);
    return NextResponse.json({ success: false, error: "No se pudo crear el bloque." }, { status: 500 });
  }
}

export async function HEAD() {
  // Returns list of assigned order IDs to help frontend know which orders are taken
  const auth = await requireAdminRequestUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  const assigned = await getAssignedOrderIds();
  return NextResponse.json({ success: true, assignedOrderIds: Array.from(assigned) });
}
