import { NextResponse } from "next/server";

import {
  getStorefrontProductById,
  getStorefrontRecommendedProducts,
} from "@/lib/server/catalog";
import { getReviewsByProductId } from "@/lib/server/product-reviews";

export const revalidate = 60;

export async function GET(_request: Request, context: RouteContext<"/api/products/[id]">) {
  const { id } = await context.params;
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
