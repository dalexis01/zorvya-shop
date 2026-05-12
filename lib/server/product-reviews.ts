import "server-only";

import { randomUUID } from "node:crypto";

import { getProductById, updateProduct } from "@/lib/server/admin/products";
import { readDataFile, writeDataFile } from "@/lib/server/storage";
import type { ProductReview } from "@/lib/shop/types";

const PRODUCT_REVIEWS_FILE = "product-reviews.json";

function trimText(value: string | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeReview(review: ProductReview): ProductReview {
  return {
    ...review,
    customerName: trimText(review.customerName) || "Cliente",
    customerEmail: trimText(review.customerEmail),
    comment: trimText(review.comment),
    rating: Math.max(1, Math.min(5, Number(review.rating) || 5)),
    createdAt: review.createdAt || new Date().toISOString(),
  };
}

async function readReviews() {
  const reviews = await readDataFile<ProductReview[]>(PRODUCT_REVIEWS_FILE, []);
  return reviews.map(normalizeReview);
}

async function writeReviews(reviews: ProductReview[]) {
  await writeDataFile(PRODUCT_REVIEWS_FILE, reviews.map(normalizeReview));
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
  const reviews = await readReviews();
  return reviews
    .filter((review) => review.productId === productId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export async function createProductReview(input: {
  productId: string;
  userId: string | null;
  customerName: string;
  customerEmail: string;
  rating: number;
  comment: string;
}) {
  const reviews = await readReviews();
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

  reviews.push(newReview);
  await writeReviews(reviews);
  await syncProductReviewMetrics(input.productId);

  return newReview;
}
