import { NextResponse } from "next/server";

import { createAiProductDraft } from "@/lib/server/admin/ai-products";
import type { Product } from "@/lib/shop/admin-types";
import { isValidAiAdminSecret } from "@/lib/server/admin/ai-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function asTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNullableNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asStringMap(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      String(entryValue ?? ""),
    ])
  );
}

export async function POST(request: Request) {
  const auth = isValidAiAdminSecret(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    console.log("[ai-products/create-draft] payload recibido", body);
    const generatedImagesSource = Array.isArray(body.generatedImages)
      ? body.generatedImages
      : Array.isArray(body.generated_images)
        ? body.generated_images
        : [];
    const mergedAttributes = {
      ...(asStringMap(body.attributes) ?? {}),
      ...(asTrimmedString(body.subcategory) || asTrimmedString(body.sub_category)
        ? { subcategory: asTrimmedString(body.subcategory) ?? asTrimmedString(body.sub_category) ?? "" }
        : {}),
      ...(asTrimmedString(body.model) ? { model: asTrimmedString(body.model) ?? "" } : {}),
      ...(asTrimmedString(body.color) ? { color: asTrimmedString(body.color) ?? "" } : {}),
      ...(asTrimmedString(body.material) ? { material: asTrimmedString(body.material) ?? "" } : {}),
    };

    const normalizedReviewStatus: Product["reviewStatus"] | undefined =
      body.review_status === "pending" ||
      body.review_status === "needs_review" ||
      body.review_status === "approved" ||
      body.review_status === "rejected"
        ? body.review_status
        : body.reviewStatus === "pending" ||
            body.reviewStatus === "needs_review" ||
            body.reviewStatus === "approved" ||
            body.reviewStatus === "rejected"
          ? body.reviewStatus
          : undefined;

    const normalizedDraftPayload = {
      batchId: asTrimmedString(body.batchId),
      batchName: asTrimmedString(body.batchName),
      batchSource: asTrimmedString(body.batchSource),
      batchMetadata:
        body.batchMetadata && typeof body.batchMetadata === "object" && !Array.isArray(body.batchMetadata)
          ? (body.batchMetadata as Record<string, unknown>)
          : undefined,
      supplierId: asTrimmedString(body.supplierId),
      title: String(body.title ?? "").trim(),
      description: asTrimmedString(body.description),
      category: asTrimmedString(body.category),
      tags: Array.isArray(body.tags) ? body.tags.map((tag) => String(tag)).filter(Boolean) : undefined,
      priceSrd: asNullableNumber(body.priceSrd ?? body.price_srd) ?? 0,
      costUsd: asNullableNumber(body.costUsd ?? body.cost_usd) ?? 0,
      stock: asNullableNumber(body.stock) ?? 0,
      stockCode: asTrimmedString(body.stockCode ?? body.stock_code),
      brand: asTrimmedString(body.brand),
      sku: asTrimmedString(body.sku ?? body.model),
      publicImageUrl:
        asTrimmedString(body.publicImageUrl ?? body.public_image_url) ??
        (generatedImagesSource[0] &&
        typeof generatedImagesSource[0] === "object" &&
        generatedImagesSource[0] !== null
          ? asTrimmedString((generatedImagesSource[0] as Record<string, unknown>).url)
          : undefined),
      originalTelegramImageUrl:
        asTrimmedString(
          body.originalTelegramImageUrl ??
            body.original_image_url ??
            body.accounting_original_image_url
        ),
      originalSlackImageUrl: asTrimmedString(body.originalSlackImageUrl),
      originalSource: "telegram" as const,
      confidenceScore: asNullableNumber(
        body.aiConfidenceScore ?? body.ai_confidence_score ?? body.confidence
      ) ?? null,
      attributes: mergedAttributes,
      inventoryLabel: asTrimmedString(body.inventoryLabel),
      deliveryLabel: asTrimmedString(body.deliveryLabel),
      longDescription: asTrimmedString(body.longDescription),
      shortDescription: asTrimmedString(body.shortDescription ?? body.short_description),
      supplierName: asTrimmedString(body.supplierName ?? body.supplier_name),
      supplierNameDetected: asTrimmedString(body.supplierNameDetected ?? body.supplier_name),
      telegramMessageId: asTrimmedString(body.telegramMessageId),
      telegramChatId: asTrimmedString(body.telegramChatId),
      status: asTrimmedString(body.status),
      reviewStatus: normalizedReviewStatus,
      generatedImages: generatedImagesSource
        .map((image, index) => {
            const record = image && typeof image === "object" ? (image as Record<string, unknown>) : {};
            return {
              id: typeof record.id === "string" ? record.id : `generated-${index + 1}`,
              url: String(record.url ?? ""),
              label: typeof record.label === "string" ? record.label : "Imagen generada",
            };
          }).filter((image) => image.url.trim())
        ,
      seoTitle: asTrimmedString(body.seoTitle ?? body.seo_title),
      seoDescription: asTrimmedString(body.seoDescription ?? body.seo_description),
      specifications: asStringMap(body.specifications) ?? {},
      processingTimeMs: asNullableNumber(body.processingTimeMs) ?? undefined,
    };

    if (!normalizedDraftPayload.title) {
      return NextResponse.json(
        { success: false, error: "title es obligatorio" },
        { status: 400 }
      );
    }

    console.log("[ai-products/create-draft] objeto final", normalizedDraftPayload);

    const result = await createAiProductDraft(normalizedDraftPayload);

    return NextResponse.json({
      success: true,
      product_id: result.productId,
      status: "draft",
      ...result,
    });
  } catch (error) {
    console.error("[ai-products/create-draft] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "No se pudo crear draft IA" },
      { status: 500 }
    );
  }
}
