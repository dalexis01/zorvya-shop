import "server-only";

import { randomUUID } from "node:crypto";

import { getPayPalSettings } from "@/lib/server/admin/paypal-settings";

type PayPalTokenCache = {
  accessToken: string;
  expiresAt: number;
  cacheKey: string;
} | null;

let tokenCache: PayPalTokenCache = null;

async function getPayPalCredentials() {
  const settings = await getPayPalSettings();
  const clientId = settings.clientId.trim();
  const clientSecret = settings.clientSecret.trim();
  const baseUrl =
    settings.apiBaseUrl.trim() ||
    (settings.environment === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com");

  return {
    clientId,
    clientSecret,
    baseUrl,
    configured: Boolean(settings.enabled && clientId && clientSecret),
  };
}

function roundUsd(value: number) {
  return Math.round(value * 100) / 100;
}

export async function getPayPalClientId() {
  const credentials = await getPayPalCredentials();
  return credentials.configured ? credentials.clientId : null;
}

export async function isPayPalConfigured() {
  const credentials = await getPayPalCredentials();
  return credentials.configured;
}

export class PayPalConfigurationError extends Error {
  constructor() {
    super("PAYPAL_NOT_CONFIGURED");
  }
}

export class PayPalApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function getPayPalAccessToken() {
  const { clientId, clientSecret, configured, baseUrl } = await getPayPalCredentials();
  const cacheKey = `${baseUrl}::${clientId}`;

  if (tokenCache && tokenCache.cacheKey === cacheKey && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  if (!configured) {
    throw new PayPalConfigurationError();
  }

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        access_token?: string;
        expires_in?: number;
        error_description?: string;
        error?: string;
      }
    | null;

  if (!response.ok || !payload?.access_token) {
    throw new PayPalApiError(
      payload?.error_description || payload?.error || "No se pudo autenticar con PayPal.",
      response.status,
      payload
    );
  }

  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 300) * 1000,
    cacheKey,
  };

  return payload.access_token;
}

async function paypalRequest<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {}
) {
  const { baseUrl } = await getPayPalCredentials();
  const token = await getPayPalAccessToken();
  const headers = new Headers(init.headers ?? {});

  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  if (init.idempotencyKey) {
    headers.set("PayPal-Request-Id", init.idempotencyKey);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    const paypalMessage =
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message?: unknown }).message ?? "")
        : "";

    throw new PayPalApiError(
      paypalMessage || "PayPal devolvio un error al procesar la solicitud.",
      response.status,
      payload
    );
  }

  return payload as T;
}

export async function createPayPalCheckoutOrder(input: {
  amountUsd: number;
  description: string;
}) {
  const roundedAmount = roundUsd(input.amountUsd);

  return paypalRequest<{
    id: string;
    status: string;
  }>("/v2/checkout/orders", {
    method: "POST",
    idempotencyKey: `pp-create-${randomUUID()}`,
    body: JSON.stringify({
      intent: "AUTHORIZE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: roundedAmount.toFixed(2),
          },
          description: input.description,
        },
      ],
    }),
  });
}

export async function authorizePayPalOrder(orderId: string) {
  return paypalRequest<{
    id: string;
    status: string;
    purchase_units?: Array<{
      payments?: {
        authorizations?: Array<{
          id?: string;
          status?: string;
        }>;
      };
    }>;
  }>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`, {
    method: "POST",
    idempotencyKey: `pp-authorize-${orderId}-${randomUUID()}`,
    body: JSON.stringify({}),
  });
}

export async function capturePayPalAuthorization(input: {
  authorizationId: string;
  invoiceId: string;
  noteToPayer?: string;
}) {
  return paypalRequest<{
    id: string;
    status: string;
  }>(
    `/v2/payments/authorizations/${encodeURIComponent(input.authorizationId)}/capture`,
    {
      method: "POST",
      idempotencyKey: `pp-capture-${input.authorizationId}-${randomUUID()}`,
      body: JSON.stringify({
        invoice_id: input.invoiceId,
        note_to_payer: input.noteToPayer,
        final_capture: true,
      }),
    }
  );
}

export async function voidPayPalAuthorization(authorizationId: string) {
  return paypalRequest<unknown>(
    `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`,
    {
      method: "POST",
      idempotencyKey: `pp-void-${authorizationId}-${randomUUID()}`,
      body: JSON.stringify({}),
    }
  );
}

export function extractPayPalAuthorization(input: {
  purchase_units?: Array<{
    payments?: {
      authorizations?: Array<{
        id?: string;
        status?: string;
        amount?: { currency_code?: string; value?: string };
      }>;
    };
  }>;
}) {
  const firstAuthorization = input.purchase_units
    ?.flatMap((unit) => unit.payments?.authorizations ?? [])
    .find((authorization) => typeof authorization.id === "string");

  const authorizedUsd =
    firstAuthorization?.amount?.currency_code === "USD"
      ? parseFloat(firstAuthorization.amount.value ?? "0")
      : null;

  return {
    id: firstAuthorization?.id ?? null,
    status: firstAuthorization?.status ?? null,
    authorizedUsd: Number.isFinite(authorizedUsd) ? authorizedUsd : null,
  };
}
