import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { publishAiProduct } from "@/lib/server/admin/ai-products";
import { createStatusLog } from "@/lib/server/admin/logs";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";
import { STOREFRONT_PRODUCTS_TAG } from "@/lib/server/catalog";

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
    const body = (await request.json()) as { itemId?: string };
    const itemId = String(body.itemId ?? "");
    if (!itemId.trim()) {
      return NextResponse.json({ success: false, error: "itemId requerido" }, { status: 400 });
    }

    const product = await publishAiProduct(itemId, auth.user.id);
    await createStatusLog({
      type: "product",
      targetId: product.id,
      action: "status_changed",
      changedBy: auth.user.id,
      changedByName: auth.user.name,
      changes: [{ field: "reviewStatus", oldValue: "pending", newValue: "approved" }],
    });
    revalidateTag(STOREFRONT_PRODUCTS_TAG, { expire: 0 });

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error("[admin/ai-products/publish] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "No se pudo publicar" },
      { status: 500 }
    );
  }
}
