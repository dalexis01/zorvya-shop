import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { getCustomerPool, normalizeCustomerEmail } from "@/lib/server/customer-db";

type SecurityEventType =
  | "account-created"
  | "email-verified"
  | "password-reset-request"
  | "password-reset-success"
  | "password-reset-failed"
  | "login-success"
  | "login-failed"
  | "login-new-device";

export type RequestSecurityContext = {
  ipAddress: string | null;
  userAgent: string | null;
  deviceFingerprint: string;
};

function normalizeIpAddress(value: string | null) {
  if (!value) {
    return null;
  }

  return value.split(",")[0]?.trim() || null;
}

export function buildRequestSecurityContext(request: Request): RequestSecurityContext {
  const userAgent = request.headers.get("user-agent");
  const acceptLanguage = request.headers.get("accept-language") ?? "";
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ipAddress = normalizeIpAddress(forwardedFor ?? realIp);
  const fingerprintSource = `${userAgent ?? "unknown"}|${acceptLanguage}|${ipAddress ?? "ip-unknown"}`;
  const deviceFingerprint = createHash("sha256").update(fingerprintSource).digest("hex");

  return {
    ipAddress,
    userAgent,
    deviceFingerprint,
  };
}

export async function recordAuthSecurityEvent(input: {
  userId?: string | null;
  email: string;
  eventType: SecurityEventType;
  success?: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceFingerprint?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const pool = await getCustomerPool();

  await pool.query(
    `
      INSERT INTO auth_security_events (
        id,
        user_id,
        email,
        event_type,
        success,
        ip_address,
        user_agent,
        device_fingerprint,
        metadata_json,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW()
      )
    `,
    [
      randomUUID(),
      input.userId ?? null,
      normalizeCustomerEmail(input.email),
      input.eventType,
      input.success ?? true,
      input.ipAddress ?? null,
      input.userAgent ?? null,
      input.deviceFingerprint ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
}

export async function hasKnownLoginDevice(userId: string, deviceFingerprint: string) {
  const pool = await getCustomerPool();
  const result = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM auth_security_events
      WHERE
        user_id = $1
        AND event_type IN ('login-success', 'login-new-device')
        AND success = TRUE
        AND device_fingerprint = $2
      LIMIT 1
    `,
    [userId, deviceFingerprint]
  );

  return Boolean(result.rows[0]);
}
