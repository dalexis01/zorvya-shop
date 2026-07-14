import { NextResponse } from "next/server";

import { createStatusLog } from "@/lib/server/admin/logs";
import { rejectAiProduct } from "@/lib/server/admin/ai-products";
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
    const body = (await request.json()) as { itemId?: string; reason?: string };
    const itemId = String(body.itemId ?? "");
    if (!itemId.trim()) {
      return NextResponse.json({ success: false, error: "itemId requerido" }, { status: 400 });
    }

    const product = await rejectAiProduct(
      itemId,
      auth.user.id,
      typeof body.reason === "string" ? body.reason : undefined
    );
    await createStatusLog({
      type: "product",
      targetId: product.id,
      action: "status_changed",
      changedBy: auth.user.id,
      changedByName: auth.user.name,
      changes: [{ field: "reviewStatus", oldValue: "pending", newValue: "rejected" }],
    });

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error("[admin/ai-products/reject] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "No se pudo rechazar" },
      { status: 500 }
    );
  }
}
