import { NextResponse } from "next/server";

import { changeAiProductSupplier } from "@/lib/server/admin/ai-products";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAdminRequestUser({
    request,
    permission: "ai_products.manage",
  });
  if (!auth.user) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as { itemId?: string; supplierId?: string };
    const itemId = String(body.itemId ?? "");
    const supplierId = String(body.supplierId ?? "");
    if (!itemId.trim() || !supplierId.trim()) {
      return NextResponse.json(
        { success: false, error: "itemId y supplierId son requeridos" },
        { status: 400 }
      );
    }

    const product = await changeAiProductSupplier(itemId, supplierId, auth.user.id);
    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error("[admin/ai-products/change-supplier] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "No se pudo cambiar proveedor" },
      { status: 500 }
    );
  }
}
