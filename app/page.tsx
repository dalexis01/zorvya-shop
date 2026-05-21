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

export default async function Page() {
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
