import "server-only";

import { readDataFile, writeDataFile } from "@/lib/server/storage";

const FILE = "orders-settings.json";

export interface OrdersAdminSettings {
  autoMode: boolean;
}

const DEFAULTS: OrdersAdminSettings = { autoMode: false };

export async function getOrdersAdminSettings(): Promise<OrdersAdminSettings> {
  const raw = await readDataFile<OrdersAdminSettings | null>(FILE, null);
  if (!raw || typeof raw !== "object") return { ...DEFAULTS };
  return { autoMode: Boolean((raw as OrdersAdminSettings).autoMode ?? DEFAULTS.autoMode) };
}

export async function updateOrdersAdminSettings(
  patch: Partial<OrdersAdminSettings>
): Promise<OrdersAdminSettings> {
  const current = await getOrdersAdminSettings();
  const next: OrdersAdminSettings = { ...current, ...patch };
  await writeDataFile(FILE, next);
  return next;
}
