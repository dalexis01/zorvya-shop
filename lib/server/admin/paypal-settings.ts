import "server-only";

import { readDataFile, writeDataFile } from "@/lib/server/storage";
import type { PayPalEnvironment, PayPalSettings } from "@/lib/shop/admin-types";

const PAYPAL_SETTINGS_FILE = "paypal-settings.json";

function trimText(value: string | undefined | null) {
  return (value ?? "").trim();
}

function normalizeEnvironment(value: unknown): PayPalEnvironment {
  return value === "live" ? "live" : "sandbox";
}

function normalizePayPalApiBaseUrl(value: string, environment: PayPalEnvironment) {
  const trimmed = trimText(value);

  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.toLowerCase();

    if (hostname === "sandbox.paypal.com" || hostname === "www.sandbox.paypal.com") {
      return "https://api-m.sandbox.paypal.com";
    }

    if (hostname === "paypal.com" || hostname === "www.paypal.com") {
      return environment === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
    }

    return url.origin;
  } catch {
    return trimmed;
  }
}

function createDefaultPayPalSettingsFromEnv(): PayPalSettings {
  const clientId = trimText(process.env.PAYPAL_CLIENT_ID);
  const clientSecret = trimText(process.env.PAYPAL_CLIENT_SECRET);

  return {
    enabled: Boolean(clientId && clientSecret),
    accountDisplayName: "Cuenta principal PayPal",
    accountEmail: trimText(process.env.PAYPAL_ACCOUNT_EMAIL),
    clientId,
    clientSecret,
    environment: normalizeEnvironment(process.env.PAYPAL_ENVIRONMENT),
    apiBaseUrl: trimText(process.env.PAYPAL_API_BASE_URL),
    updatedAt: "",
  };
}

function normalizeStoredPayPalSettings(
  value: Partial<PayPalSettings> | null | undefined
): PayPalSettings {
  const fallback = createDefaultPayPalSettingsFromEnv();
  const source = value ?? {};
  const environment = normalizeEnvironment(source.environment);

  return {
    enabled: source.enabled ?? fallback.enabled,
    accountDisplayName: trimText(source.accountDisplayName) || fallback.accountDisplayName,
    accountEmail: trimText(source.accountEmail),
    clientId: trimText(source.clientId),
    clientSecret: trimText(source.clientSecret),
    environment,
    apiBaseUrl: normalizePayPalApiBaseUrl(source.apiBaseUrl ?? "", environment),
    updatedAt: trimText(source.updatedAt),
  };
}

async function readRawPayPalSettings() {
  return readDataFile<Partial<PayPalSettings> | null>(PAYPAL_SETTINGS_FILE, null);
}

export async function getPayPalSettings() {
  const rawSettings = await readRawPayPalSettings();

  if (!rawSettings) {
    return createDefaultPayPalSettingsFromEnv();
  }

  return normalizeStoredPayPalSettings(rawSettings);
}

export async function getPayPalSettingsMeta() {
  const rawSettings = await readRawPayPalSettings();
  const settings = rawSettings
    ? normalizeStoredPayPalSettings(rawSettings)
    : createDefaultPayPalSettingsFromEnv();

  return {
    settings,
    source: rawSettings ? ("admin" as const) : ("env" as const),
    configured: Boolean(settings.enabled && settings.clientId && settings.clientSecret),
  };
}

export async function updatePayPalSettings(
  updates: Partial<PayPalSettings>
) {
  const current = await getPayPalSettings();
  const next = normalizeStoredPayPalSettings({
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  await writeDataFile(PAYPAL_SETTINGS_FILE, next);
  return next;
}
