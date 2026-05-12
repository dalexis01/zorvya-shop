import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/session";
import {
  calculateReviewMetrics,
  createProductReview,
  getReviewsByProductId,
} from "@/lib/server/product-reviews";

function trimText(value: string | undefined) {
  return (value ?? "").trim();
}

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/products/[id]/reviews">) {
  const { id } = await context.params;
  const reviews = await getReviewsByProductId(id);
  const { rating, reviewCount } = calculateReviewMetrics(reviews);

  return NextResponse.json({
    success: true,
    reviews,
    rating,
    reviewCount,
  });
}

export async function POST(request: Request, context: RouteContext<"/api/products/[id]/reviews">) {
  const { id } = await context.params;

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const currentUser = await getCurrentUser();
    const customerName = trimText(
      typeof payload.name === "string" ? payload.name : currentUser?.name
    );
    const customerEmail = trimText(
      typeof payload.email === "string" ? payload.email : currentUser?.email
    ).toLowerCase();
    const comment = trimText(typeof payload.comment === "string" ? payload.comment : "").slice(0, 1000);
    const rating = Number(payload.rating);

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        {
          success: false,
          error: "Debe elegir una puntuacion valida.",
        },
        { status: 400 }
      );
    }

    const review = await createProductReview({
      productId: id,
      userId: currentUser?.id ?? null,
      customerName,
      customerEmail,
      rating,
      comment,
    });
    const reviews = await getReviewsByProductId(id);
    const metrics = calculateReviewMetrics(reviews);

    return NextResponse.json(
      {
        success: true,
        review,
        ...metrics,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "No se pudo enviar el comentario.",
      },
      { status: 500 }
    );
  }
}
