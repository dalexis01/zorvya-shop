import { cookies } from "next/headers";

import ShopPage from "./ShopPage";

import { getStorefrontHomepageSettings } from "@/lib/server/admin/homepage-settings";
import {
  getStorefrontProducts,
  getStorefrontSnapshotTimestamp,
} from "@/lib/server/catalog";
import { getPayPalClientId } from "@/lib/server/paypal";
import { CLIENT_THEME_COOKIE_KEY, normalizeClientTheme } from "@/lib/shop/client-theme";

export const revalidate = 300;

async function loadHomePayload() {
  const startedAt = Date.now();
  const cookieStore = await cookies();
  const initialClientTheme = normalizeClientTheme(
    cookieStore.get(CLIENT_THEME_COOKIE_KEY)?.value,
    "dark"
  );
  const [initialProducts, initialSettings, paypalClientId] = await Promise.all([
    getStorefrontProducts(),
    getStorefrontHomepageSettings(),
    getPayPalClientId(),
  ]);
  const initialRenderAt = getStorefrontSnapshotTimestamp();
  const payloadKb = Math.round(
    Buffer.byteLength(JSON.stringify(initialProducts), "utf8") / 1024
  );

  console.info(
    `[egress-metrics] source=app/page rows=${initialProducts.length} payloadKB=${payloadKb} durationMs=${Date.now() - startedAt} cache=server-render columns=id,name,price,originalPrice,stock,category,brand,image,images,rating,reviewCount,badge,inventoryLabel,deliveryLabel,hasFreeDelivery,isHeavy,showStock,displayOrder,isFeatured,isTop,colors,colorOptions,colorImageMap,variants,createdAt,updatedAt,translations`
  );

  return {
    initialProducts,
    initialSettings,
    paypalClientId,
    initialClientTheme,
    initialRenderAt,
  };
}

export default async function Page() {
  const {
    initialProducts,
    initialSettings,
    paypalClientId,
    initialClientTheme,
    initialRenderAt,
  } = await loadHomePayload();

  return (
    <ShopPage
      initialProducts={initialProducts}
      initialSettings={initialSettings}
      initialRenderAt={initialRenderAt}
      initialClientTheme={initialClientTheme}
      paypalClientId={paypalClientId}
    />
  );
}
