export async function postDebugEgressMetric(input: {
  source: string;
  route: string;
  rowsCount: number;
  payloadKb: number;
  durationMs: number;
  cacheStatus: string;
}) {
  try {
    await fetch("/api/admin/debug/egress-metrics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      keepalive: true,
      body: JSON.stringify(input),
    });
  } catch {
    return;
  }
}
