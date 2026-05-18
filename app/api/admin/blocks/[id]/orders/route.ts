import { NextResponse } from "next/server";

import {
  addOrderToBlock,
  getDeliveryBlockById,
} from "@/lib/server/admin/delivery-blocks-store";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteContext) {
  const auth = await requireAdminRequestUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;

  try {
    const body = (await request.json()) as { orderId?: string };
    if (!body.orderId) {
      return NextResponse.json({ success: false, error: "orderId requerido." }, { status: 400 });
    }

    const block = await getDeliveryBlockById(id);
    if (!block) return NextResponse.json({ success: false, error: "Bloque no encontrado." }, { status: 404 });

    await addOrderToBlock(id, body.orderId);

    const updated = await getDeliveryBlockById(id);
    return NextResponse.json({ success: true, block: updated });
  } catch (err) {
    console.error("[blocks/orders] POST error:", err);
    return NextResponse.json({ success: false, error: "No se pudo agregar la orden." }, { status: 500 });
  }
}
