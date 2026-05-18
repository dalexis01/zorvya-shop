import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import ProductDetailClient from "@/components/storefront/ProductDetailClient";
import { getStorefrontProductById } from "@/lib/server/catalog";
import { CLIENT_THEME_COOKIE_KEY, normalizeClientTheme } from "@/lib/shop/client-theme";

export const revalidate = 60;

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const initialClientTheme = normalizeClientTheme(
    cookieStore.get(CLIENT_THEME_COOKIE_KEY)?.value,
    "dark"
  );
  const product = await getStorefrontProductById(id);

  if (!product) {
    notFound();
  }

  return (
    <ProductDetailClient
      initialProduct={product}
      initialReviews={[]}
      initialRecommended={[]}
      sessionUser={null}
      initialClientTheme={initialClientTheme}
    />
  );
}
