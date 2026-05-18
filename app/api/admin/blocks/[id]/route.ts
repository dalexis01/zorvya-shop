import { NextResponse } from "next/server";

import {
  deleteDeliveryBlock,
  getDeliveryBlockById,
  reorderBlockOrders,
  updateDeliveryBlock,
  type BlockStatus,
} from "@/lib/server/admin/delivery-blocks-store";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const auth = await requireAdminRequestUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  const block = await getDeliveryBlockById(id);
  if (!block) return NextResponse.json({ success: false, error: "Bloque no encontrado." }, { status: 404 });

  return NextResponse.json({ success: true, block });
}

export async function PUT(request: Request, ctx: RouteContext) {
  const auth = await requireAdminRequestUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;

  try {
    const body = (await request.json()) as {
      name?: string;
      status?: BlockStatus;
      notes?: string | null;
      orderedIds?: string[];
    };

    if (body.orderedIds) {
      await reorderBlockOrders(id, body.orderedIds);
    }

    const block = await updateDeliveryBlock(id, {
      name: body.name,
      status: body.status,
      notes: body.notes,
    });

    if (!block) return NextResponse.json({ success: false, error: "Bloque no encontrado." }, { status: 404 });
    return NextResponse.json({ success: true, block });
  } catch (err) {
    console.error("[blocks] PUT error:", err);
    return NextResponse.json({ success: false, error: "No se pudo actualizar el bloque." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const auth = await requireAdminRequestUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;

  try {
    await deleteDeliveryBlock(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[blocks] DELETE error:", err);
    return NextResponse.json({ success: false, error: "No se pudo eliminar el bloque." }, { status: 500 });
  }
}
