import "server-only";

import { randomUUID } from "node:crypto";

import { getProductById, updateProduct } from "@/lib/server/admin/products";
import { getAdminRuntimePool } from "@/lib/server/admin/runtime-db";
import type { ProductReview } from "@/lib/shop/types";

type ProductReviewRow = {
  id: string;
  product_id: string;
  user_id: string | null;
  customer_name: string;
  customer_email: string;
  rating: number;
  comment: string;
  created_at: string;
};

function trimText(value: string | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeReview(review: ProductReview): ProductReview {
  return {
    ...review,
    customerName: trimText(review.customerName) || "Cliente",
    customerEmail: trimText(review.customerEmail).toLowerCase(),
    comment: trimText(review.comment),
    rating: Math.max(1, Math.min(5, Number(review.rating) || 5)),
    createdAt: review.createdAt || new Date().toISOString(),
  };
}

function mapReviewRow(row: ProductReviewRow): ProductReview {
  return normalizeReview({
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    rating: Number(row.rating) || 5,
    comment: row.comment,
    createdAt: row.created_at,
  });
}

export function calculateReviewMetrics(
  reviews: ProductReview[],
  fallbackRating: number = 0
) {
  const reviewCount = reviews.length;
  const rating =
    reviewCount > 0
      ? Math.round(
          (reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount) * 10
        ) / 10
      : fallbackRating;

  return {
    rating,
    reviewCount,
  };
}

async function syncProductReviewMetrics(productId: string) {
  const product = await getProductById(productId);

  if (!product) {
    return;
  }

  const reviews = await getReviewsByProductId(productId);
  const { rating, reviewCount } = calculateReviewMetrics(reviews, product.rating);

  await updateProduct(
    productId,
    {
      rating,
      reviewCount,
    },
    "reviews-system"
  );
}

export async function getReviewsByProductId(productId: string) {
  const pool = await getAdminRuntimePool();
  const result = await pool.query<ProductReviewRow>(
    `
      SELECT
        id,
        product_id,
        user_id,
        customer_name,
        customer_email,
        rating,
        comment,
        created_at::text
      FROM admin_product_reviews
      WHERE product_id = $1
      ORDER BY created_at DESC
    `,
    [productId]
  );

  return result.rows.map(mapReviewRow);
}

export async function createProductReview(input: {
  productId: string;
  userId: string | null;
  customerName: string;
  customerEmail: string;
  rating: number;
  comment: string;
}) {
  const pool = await getAdminRuntimePool();
  const newReview = normalizeReview({
    id: randomUUID(),
    productId: input.productId,
    userId: input.userId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    rating: input.rating,
    comment: input.comment,
    createdAt: new Date().toISOString(),
  });

  await pool.query(
    `
      INSERT INTO admin_product_reviews (
        id,
        product_id,
        user_id,
        customer_name,
        customer_email,
        rating,
        comment,
        created_at
      ) VALUES (
        $1, $2, $3, $4, LOWER($5), $6, $7, $8::timestamptz
      )
    `,
    [
      newReview.id,
      newReview.productId,
      newReview.userId,
      newReview.customerName,
      newReview.customerEmail,
      newReview.rating,
      newReview.comment,
      newReview.createdAt,
    ]
  );

  await syncProductReviewMetrics(input.productId);

  return newReview;
}
