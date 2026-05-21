"use client";

import { useEffect, useState } from "react";

type DebugMetric = {
  id: number;
  source: string;
  route: string;
  rowsCount: number;
  payloadKb: number;
  durationMs: number;
  cacheStatus: string;
  createdAt: string;
};

type DebugAggregate = {
  source: string;
  calls: number;
  totalKb: number;
  averageKb: number;
};

type DebugResponse = {
  success?: boolean;
  latest?: DebugMetric[];
  topByCalls?: DebugAggregate[];
  topByPayloadKb?: DebugAggregate[];
  error?: string;
};

export default function AdminDebugEgressPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [latest, setLatest] = useState<DebugMetric[]>([]);
  const [topByCalls, setTopByCalls] = useState<DebugAggregate[]>([]);
  const [topByPayloadKb, setTopByPayloadKb] = useState<DebugAggregate[]>([]);

  useEffect(() => {
    let active = true;

    async function loadMetrics() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/admin/debug/egress-metrics", {
          cache: "no-store",
        });
        const data = (await response.json()) as DebugResponse;

        if (!active) {
          return;
        }

        if (!response.ok || !data.success) {
          setError(data.error || "No se pudieron cargar las metricas.");
          return;
        }

        setLatest(data.latest ?? []);
        setTopByCalls(data.topByCalls ?? []);
        setTopByPayloadKb(data.topByPayloadKb ?? []);
      } catch {
        if (active) {
          setError("No se pudieron cargar las metricas.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadMetrics();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_38%),linear-gradient(180deg,_#050816_0%,_#03050f_100%)] p-8 shadow-[0_24px_90px_rgba(0,0,0,0.4)]">
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Debug</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Egress Metrics</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Ultimas lecturas registradas directamente en Supabase para encontrar que parte del
          proyecto sigue consumiendo bandwidth.
        </p>
      </section>

      {error ? (
        <div className="rounded-[1.5rem] border border-rose-500/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[2rem] border border-slate-800 bg-[#050816] px-8 py-16 text-center text-sm uppercase tracking-[0.3em] text-slate-500">
          Cargando metricas
        </div>
      ) : (
        <>
          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-[2rem] border border-slate-800 bg-[#050816] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <h2 className="text-lg font-semibold text-white">Top sources por llamadas</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-[0.24em] text-slate-500">
                    <tr>
                      <th className="pb-3">Source</th>
                      <th className="pb-3">Calls</th>
                      <th className="pb-3">KB total</th>
                      <th className="pb-3">KB prom.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {topByCalls.map((entry) => (
                      <tr key={`calls-${entry.source}`}>
                        <td className="py-3 font-medium text-white">{entry.source}</td>
                        <td className="py-3 text-slate-300">{entry.calls}</td>
                        <td className="py-3 text-slate-300">{entry.totalKb}</td>
                        <td className="py-3 text-slate-300">{entry.averageKb}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-800 bg-[#050816] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <h2 className="text-lg font-semibold text-white">Top sources por KB total</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-[0.24em] text-slate-500">
                    <tr>
                      <th className="pb-3">Source</th>
                      <th className="pb-3">Calls</th>
                      <th className="pb-3">KB total</th>
                      <th className="pb-3">KB prom.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {topByPayloadKb.map((entry) => (
                      <tr key={`kb-${entry.source}`}>
                        <td className="py-3 font-medium text-white">{entry.source}</td>
                        <td className="py-3 text-slate-300">{entry.calls}</td>
                        <td className="py-3 text-slate-300">{entry.totalKb}</td>
                        <td className="py-3 text-slate-300">{entry.averageKb}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-800 bg-[#050816] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <h2 className="text-lg font-semibold text-white">Ultimas 100 metricas</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  <tr>
                    <th className="pb-3">Fecha</th>
                    <th className="pb-3">Source</th>
                    <th className="pb-3">Route</th>
                    <th className="pb-3">Rows</th>
                    <th className="pb-3">KB</th>
                    <th className="pb-3">Ms</th>
                    <th className="pb-3">Cache</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {latest.map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-3 text-slate-400">
                        {new Date(entry.createdAt).toLocaleString("es-ES")}
                      </td>
                      <td className="py-3 font-medium text-white">{entry.source}</td>
                      <td className="py-3 text-slate-300">{entry.route}</td>
                      <td className="py-3 text-slate-300">{entry.rowsCount}</td>
                      <td className="py-3 text-slate-300">{entry.payloadKb}</td>
                      <td className="py-3 text-slate-300">{entry.durationMs}</td>
                      <td className="py-3 text-slate-300">{entry.cacheStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
