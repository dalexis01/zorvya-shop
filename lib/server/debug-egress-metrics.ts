import "server-only";

import { Pool } from "pg";

type DebugEgressMetricInput = {
  source: string;
  route: string;
  rowsCount: number;
  payloadKb: number;
  durationMs: number;
  cacheStatus: string;
};

export type DebugEgressMetricRow = {
  id: number;
  source: string;
  route: string;
  rowsCount: number;
  payloadKb: number;
  durationMs: number;
  cacheStatus: string;
  createdAt: string;
};

export type DebugEgressMetricAggregate = {
  source: string;
  calls: number;
  totalKb: number;
  averageKb: number;
};

const DEBUG_EGRESS_METRICS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS debug_egress_metrics (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  route TEXT NOT NULL,
  rows_count INTEGER NOT NULL DEFAULT 0,
  payload_kb INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  cache_status TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debug_egress_metrics_created_at
  ON debug_egress_metrics (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_debug_egress_metrics_source_created_at
  ON debug_egress_metrics (source, created_at DESC);

ALTER TABLE debug_egress_metrics ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE debug_egress_metrics FROM anon;
REVOKE ALL ON TABLE debug_egress_metrics FROM authenticated;
`;

let metricsPool: Pool | null = null;
let metricsSchemaReadyPromise: Promise<void> | null = null;

function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DB_URL ||
    ""
  ).trim();
}

function isConfigured() {
  const value = getConnectionString();
  return Boolean(value) && !value.includes("[YOUR-PASSWORD]");
}

function shouldUseSsl(connectionString: string) {
  if (process.env.PGSSL === "disable") {
    return false;
  }

  return connectionString.includes("supabase") || process.env.NODE_ENV === "production";
}

async function getMetricsPool() {
  const connectionString = getConnectionString();

  if (!isConfigured()) {
    throw new Error("DEBUG_EGRESS_DB_NOT_CONFIGURED");
  }

  if (!metricsPool) {
    metricsPool = new Pool({
      connectionString,
      max: 2,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 20_000,
      ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    });
  }

  if (!metricsSchemaReadyPromise) {
    metricsSchemaReadyPromise = metricsPool.query(DEBUG_EGRESS_METRICS_SCHEMA_SQL).then(() => {
      return;
    }).catch((error) => {
      metricsSchemaReadyPromise = null;
      throw error;
    });
  }

  await metricsSchemaReadyPromise;
  return metricsPool;
}

export async function recordDebugEgressMetric(input: DebugEgressMetricInput) {
  if (!isConfigured()) {
    return;
  }

  try {
    const pool = await getMetricsPool();
    await pool.query(
      `
        INSERT INTO debug_egress_metrics (
          source,
          route,
          rows_count,
          payload_kb,
          duration_ms,
          cache_status
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        input.source,
        input.route,
        Math.max(0, Math.round(input.rowsCount)),
        Math.max(0, Math.round(input.payloadKb)),
        Math.max(0, Math.round(input.durationMs)),
        input.cacheStatus,
      ]
    );
  } catch (error) {
    console.error("[debug-egress] failed to record metric:", error);
  }
}

export async function getDebugEgressMetricsSnapshot() {
  const pool = await getMetricsPool();

  const [latestResult, topCallsResult, topPayloadResult] = await Promise.all([
    pool.query<{
      id: string;
      source: string;
      route: string;
      rows_count: number;
      payload_kb: number;
      duration_ms: number;
      cache_status: string;
      created_at: string;
    }>(
      `
        SELECT
          id,
          source,
          route,
          rows_count,
          payload_kb,
          duration_ms,
          cache_status,
          created_at
        FROM debug_egress_metrics
        ORDER BY created_at DESC
        LIMIT 100
      `
    ),
    pool.query<{
      source: string;
      calls: string;
      total_kb: string;
      average_kb: string;
    }>(
      `
        SELECT
          source,
          COUNT(*)::text AS calls,
          COALESCE(SUM(payload_kb), 0)::text AS total_kb,
          COALESCE(ROUND(AVG(payload_kb)::numeric, 1), 0)::text AS average_kb
        FROM debug_egress_metrics
        GROUP BY source
        ORDER BY COUNT(*) DESC, SUM(payload_kb) DESC
        LIMIT 20
      `
    ),
    pool.query<{
      source: string;
      calls: string;
      total_kb: string;
      average_kb: string;
    }>(
      `
        SELECT
          source,
          COUNT(*)::text AS calls,
          COALESCE(SUM(payload_kb), 0)::text AS total_kb,
          COALESCE(ROUND(AVG(payload_kb)::numeric, 1), 0)::text AS average_kb
        FROM debug_egress_metrics
        GROUP BY source
        ORDER BY SUM(payload_kb) DESC, COUNT(*) DESC
        LIMIT 20
      `
    ),
  ]);

  const mapAggregate = (row: {
    source: string;
    calls: string;
    total_kb: string;
    average_kb: string;
  }): DebugEgressMetricAggregate => ({
    source: row.source,
    calls: Number(row.calls ?? 0),
    totalKb: Number(row.total_kb ?? 0),
    averageKb: Number(row.average_kb ?? 0),
  });

  return {
    latest: latestResult.rows.map((row) => ({
      id: Number(row.id),
      source: row.source,
      route: row.route,
      rowsCount: Number(row.rows_count ?? 0),
      payloadKb: Number(row.payload_kb ?? 0),
      durationMs: Number(row.duration_ms ?? 0),
      cacheStatus: row.cache_status,
      createdAt: row.created_at,
    })),
    topByCalls: topCallsResult.rows.map(mapAggregate),
    topByPayloadKb: topPayloadResult.rows.map(mapAggregate),
  };
}

export { DEBUG_EGRESS_METRICS_SCHEMA_SQL };
