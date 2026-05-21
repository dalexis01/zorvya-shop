import "server-only";

type ResponseMetricEntry = {
  minuteKey: string;
  calls: number;
  rows: number;
  bytes: number;
};

const globalMetrics = globalThis as typeof globalThis & {
  __zorvyaApiResponseMetrics?: Map<string, ResponseMetricEntry>;
};

function getMetricsStore() {
  if (!globalMetrics.__zorvyaApiResponseMetrics) {
    globalMetrics.__zorvyaApiResponseMetrics = new Map<string, ResponseMetricEntry>();
  }

  return globalMetrics.__zorvyaApiResponseMetrics;
}

function toApproxBytes(payload: unknown) {
  try {
    return Buffer.byteLength(JSON.stringify(payload), "utf8");
  } catch {
    return 0;
  }
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${bytes} B`;
}

export function logApiResponseMetrics(input: {
  endpoint: string;
  payload: unknown;
  rowCount?: number;
}) {
  const store = getMetricsStore();
  const minuteKey = new Date().toISOString().slice(0, 16);
  const key = `${input.endpoint}:${minuteKey}`;
  const bytes = toApproxBytes(input.payload);
  const nextEntry = store.get(key) ?? {
    minuteKey,
    calls: 0,
    rows: 0,
    bytes: 0,
  };

  nextEntry.calls += 1;
  nextEntry.rows += Math.max(0, input.rowCount ?? 0);
  nextEntry.bytes += bytes;
  store.set(key, nextEntry);

  console.info(
    `[api-metrics] ${input.endpoint} call=${nextEntry.calls}/min rows=${input.rowCount ?? 0} payload=${formatBytes(bytes)} aggregate=${formatBytes(nextEntry.bytes)} minute=${minuteKey}`
  );
}

