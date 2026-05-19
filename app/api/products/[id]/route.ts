import { NextResponse } from "next/server";

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
    return NextResponse.json({
      success: true,
      product,
      reviews: [],
      recommended: [],
    });
  }

  const [reviews, recommended] = await Promise.all([
    getReviewsByProductId(id),
    getStorefrontRecommendedProducts(product, 4),
  ]);

  return NextResponse.json({
    success: true,
    product,
    reviews,
    recommended,
  });
}
