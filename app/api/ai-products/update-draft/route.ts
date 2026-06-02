import { NextResponse } from "next/server";

import { isValidAiAdminSecret } from "@/lib/server/admin/ai-secret";
import { updateAiProductDraft } from "@/lib/server/admin/ai-products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const auth = isValidAiAdminSecret(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const itemId = String(body.itemId ?? "");

    if (!itemId.trim()) {
      return NextResponse.json({ success: false, error: "itemId requerido" }, { status: 400 });
    }

    const product = await updateAiProductDraft(itemId, {
      supplierId:
        typeof body.supplierId === "string" ? body.supplierId : body.supplierId === null ? null : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      category: typeof body.category === "string" ? body.category : undefined,
      tags: Array.isArray(body.tags) ? body.tags.map((tag) => String(tag)) : undefined,
      priceSrd: body.priceSrd === undefined ? undefined : Number(body.priceSrd),
      costUsd: body.costUsd === undefined ? undefined : Number(body.costUsd),
      stock: body.stock === undefined ? undefined : Number(body.stock),
      stockCode: typeof body.stockCode === "string" ? body.stockCode : undefined,
      publicImageUrl:
        typeof body.publicImageUrl === "string" ? body.publicImageUrl : undefined,
      originalTelegramImageUrl:
        typeof body.originalTelegramImageUrl === "string"
          ? body.originalTelegramImageUrl
          : undefined,
      originalSlackImageUrl:
        typeof body.originalSlackImageUrl === "string"
          ? body.originalSlackImageUrl
          : undefined,
      confidenceScore:
        body.aiConfidenceScore === undefined
          ? undefined
          : body.aiConfidenceScore === null
            ? null
            : Number(body.aiConfidenceScore),
      brand: typeof body.brand === "string" ? body.brand : undefined,
      sku: typeof body.sku === "string" ? body.sku : undefined,
      inventoryLabel:
        typeof body.inventoryLabel === "string" ? body.inventoryLabel : undefined,
      deliveryLabel:
        typeof body.deliveryLabel === "string" ? body.deliveryLabel : undefined,
      generatedImages: Array.isArray(body.generatedImages)
        ? body.generatedImages.map((image, index) => {
            const record = image && typeof image === "object" ? (image as Record<string, unknown>) : {};
            return {
              id: typeof record.id === "string" ? record.id : `generated-${index + 1}`,
              url: String(record.url ?? ""),
              label: typeof record.label === "string" ? record.label : "Imagen generada",
            };
          })
        : undefined,
      seoTitle: typeof body.seoTitle === "string" ? body.seoTitle : undefined,
      seoDescription:
        typeof body.seoDescription === "string" ? body.seoDescription : undefined,
      specifications:
        body.specifications && typeof body.specifications === "object"
          ? Object.fromEntries(
              Object.entries(body.specifications as Record<string, unknown>).map(([key, value]) => [
                key,
                String(value),
              ])
            )
          : undefined,
      attributes:
        body.attributes && typeof body.attributes === "object"
          ? Object.fromEntries(
              Object.entries(body.attributes as Record<string, unknown>).map(([key, value]) => [
                key,
                String(value),
              ])
            )
          : undefined,
    });

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error("[ai-products/update-draft] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "No se pudo actualizar draft IA",
      },
      { status: 500 }
    );
  }
}
