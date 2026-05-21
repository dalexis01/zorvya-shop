import { NextResponse } from "next/server";

import { logApiResponseMetrics } from "@/lib/server/api-response-metrics";
import {
  getStorefrontProductById,
  getStorefrontRecommendedProducts,
} from "@/lib/server/catalog";
import { getReviewsByProductId } from "@/lib/server/product-reviews";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext<"/api/products/[id]">) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const includeExtras = searchParams.get("includeExtras") !== "false";
  const product = await getStorefrontProductById(id);

  if (!product) {
    return NextResponse.json(
      {
        success: false,
        error: "Producto no encontrado.",
      },
      { status: 404 }
    );
  }

  if (!includeExtras) {
    const payload = {
      success: true,
      product,
      reviews: [],
      recommended: [],
    };
    logApiResponseMetrics({
      endpoint: "/api/products/[id]?includeExtras=false",
      payload,
      rowCount: 1,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    });
  }

  const [reviews, recommended] = await Promise.all([
    getReviewsByProductId(id),
    getStorefrontRecommendedProducts(product, 4),
  ]);

  const payload = {
    success: true,
    product,
    reviews,
    recommended,
  };
  logApiResponseMetrics({
    endpoint: "/api/products/[id]",
    payload,
    rowCount: 1 + reviews.length + recommended.length,
  });

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
    },
  });
}
