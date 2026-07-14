import { NextResponse } from "next/server";

import {
  getDeliveryBlockById,
  removeOrderFromBlock,
} from "@/lib/server/admin/delivery-blocks-store";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; orderId: string }> };

export async function DELETE(request: Request, ctx: RouteContext) {
  const auth = await requireAdminRequestUser({
    request,
    permission: "blocks.manage",
  });
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const { id, orderId } = await ctx.params;

  try {
    await removeOrderFromBlock(id, orderId);
    const block = await getDeliveryBlockById(id);
    return NextResponse.json({ success: true, block });
  } catch (err) {
    console.error("[blocks/orders/[orderId]] DELETE error:", err);
    return NextResponse.json({ success: false, error: "No se pudo quitar la orden." }, { status: 500 });
  }
}
