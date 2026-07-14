import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { cleanupAiDraftRecordsForProduct, deleteAiDraftItem, listAiPendingProducts } from "@/lib/server/admin/ai-products";
import { createStatusLog } from "@/lib/server/admin/logs";
import { deleteProduct } from "@/lib/server/admin/products";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";
import { STOREFRONT_PRODUCTS_TAG } from "@/lib/server/catalog";

export async function POST(request: Request) {
  try {
    const auth = await requireAdminRequestUser({
      request,
      permission: "ai_products.manage",
    });

    if (!auth.user) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    if (auth.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Only admins can delete AI drafts" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as { itemId?: string };
    const itemId = String(body.itemId ?? "").trim();

    if (!itemId) {
      return NextResponse.json({ success: false, error: "itemId requerido" }, { status: 400 });
    }

    const items = await listAiPendingProducts();
    const item = items.find((entry) => entry.id === itemId);

    if (!item) {
      return NextResponse.json({ success: false, error: "AI draft not found" }, { status: 404 });
    }

    if (item.productId) {
      await deleteProduct(item.productId);
      await cleanupAiDraftRecordsForProduct(item.productId);
    } else {
      await deleteAiDraftItem(itemId);
    }

    await createStatusLog({
      type: "product",
      targetId: item.productId ?? item.id,
      action: "deleted",
      changedBy: auth.user.id,
      changedByName: auth.user.name,
      changes: [
        {
          field: "ai_draft_deleted",
          oldValue: item.title,
          newValue: null,
        },
      ],
    });

    revalidateTag(STOREFRONT_PRODUCTS_TAG, { expire: 0 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/ai-products/delete] failed:", error);
    return NextResponse.json({ success: false, error: "No se pudo eliminar el producto IA" }, { status: 500 });
  }
}
