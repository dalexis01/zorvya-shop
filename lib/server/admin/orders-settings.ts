import "server-only";

import {
  RUNTIME_SETTING_KEYS,
  getAdminRuntimeSetting,
  setAdminRuntimeSetting,
} from "@/lib/server/admin/runtime-db";

export interface OrdersAdminSettings {
  autoMode: boolean;
}

const DEFAULTS: OrdersAdminSettings = { autoMode: false };

export async function getOrdersAdminSettings(): Promise<OrdersAdminSettings> {
  const raw = await getAdminRuntimeSetting<OrdersAdminSettings | null>(
    RUNTIME_SETTING_KEYS.orders,
    null
  );

  if (!raw || typeof raw !== "object") {
    return { ...DEFAULTS };
  }

  return {
    autoMode: Boolean((raw as OrdersAdminSettings).autoMode ?? DEFAULTS.autoMode),
  };
}

export async function updateOrdersAdminSettings(
  patch: Partial<OrdersAdminSettings>
): Promise<OrdersAdminSettings> {
  const current = await getOrdersAdminSettings();
  const next: OrdersAdminSettings = { ...current, ...patch };
  await setAdminRuntimeSetting(RUNTIME_SETTING_KEYS.orders, next);
  return next;
}
