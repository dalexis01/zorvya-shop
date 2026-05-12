"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import BarTrendChart from "@/components/admin/BarTrendChart";
import type { AdminDashboardStats } from "@/lib/shop/admin-types";
import { formatCurrencyDollar, formatGroupedNumber, formatPercent } from "@/lib/shop/number-format";

interface SummaryCardProps {
  href: string;
  label: string;
  value: string | number;
  helper: string;
  accent: "blue" | "green" | "red" | "neutral";
}

function SummaryCard({ href, label, value, helper, accent }: SummaryCardProps) {
  const accentClasses = {
    blue: "border-cyan-900/50 bg-[#071321] hover:border-cyan-500",
    green: "border-emerald-900/50 bg-[#07160f] hover:border-emerald-500",
    red: "border-rose-900/50 bg-[#18090d] hover:border-rose-500",
    neutral: "border-slate-800 bg-[#070b17] hover:border-slate-600",
  }[accent];

  return (
    <Link
      href={href}
      className={`group rounded-[2rem] border p-6 shadow-[0_20px_60px_rgba(0,0,0,0.32)] transition hover:-translate-y-1 ${accentClasses}`}
    >
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <p className="mt-4 text-4xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-3 text-sm text-slate-500">{helper}</p>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.35em] text-slate-500 transition group-hover:text-white">
        Abrir detalle
      </p>
    </Link>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const handleOrdersUpdated = () => {
      setRefreshKey((currentKey) => currentKey + 1);
    };

    window.addEventListener("admin-orders-updated", handleOrdersUpdated);

    return () => {
      window.removeEventListener("admin-orders-updated", handleOrdersUpdated);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadStats() {
      try {
        const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
        const data = await response.json();

        if (isActive && data.success) {
          setStats(data.stats);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadStats();

    return () => {
      isActive = false;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-400"></div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Cargando dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2.5rem] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_36%),linear-gradient(180deg,_#050816_0%,_#03050f_100%)] p-8 shadow-[0_24px_90px_rgba(0,0,0,0.42)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Centro operativo</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
              Dashboard de control ZorvyA
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Ingresos, contabilidad, ordenes, productos y soporte conectados a los datos reales
              del negocio.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              href="/admin/revenue"
              className="rounded-2xl bg-cyan-500 px-5 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Abrir ingresos
            </Link>
            <Link
              href="/admin/products/create"
              className="rounded-2xl border border-slate-700 bg-[#0d1222] px-5 py-3 text-center text-sm font-semibold text-white transition hover:border-emerald-500"
            >
              Crear producto
            </Link>
            <Link
              href="/admin/support"
              className="rounded-2xl border border-slate-700 bg-[#0d1222] px-5 py-3 text-center text-sm font-semibold text-white transition hover:border-rose-500"
            >
              Abrir soporte
            </Link>
            <Link
              href="/admin/settings"
              className="rounded-2xl border border-slate-700 bg-[#0d1222] px-5 py-3 text-center text-sm font-semibold text-white transition hover:border-violet-500"
            >
              Ajustes
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          href="/admin/products"
          label="Total productos"
          value={formatGroupedNumber(stats?.totalProducts ?? 0)}
          helper="Catalogo activo y creado"
          accent="neutral"
        />
        <SummaryCard
          href="/admin/orders"
          label="Ordenes totales"
          value={formatGroupedNumber(stats?.totalOrders ?? 0)}
          helper="Todas las ordenes reales"
          accent="blue"
        />
        <SummaryCard
          href="/admin/orders?status=pending"
          label="Ordenes pendientes"
          value={formatGroupedNumber(stats?.pendingOrders ?? 0)}
          helper="Pendientes por gestionar"
          accent="red"
        />
        <SummaryCard
          href="/admin/orders?status=completed"
          label="Ordenes completadas"
          value={formatGroupedNumber(stats?.completedOrders ?? 0)}
          helper="Finalizadas correctamente"
          accent="green"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[2rem] border border-slate-800 bg-[#050816] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Ingresos</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Contabilidad real del negocio</h2>
            </div>
            <Link
              href="/admin/revenue"
              className="rounded-2xl border border-slate-700 bg-[#0d1222] px-4 py-3 text-sm font-semibold text-white transition hover:border-cyan-500"
            >
              Ver contabilidad completa
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Link
              href="/admin/revenue"
              className="rounded-[1.75rem] bg-[#071321] p-5 transition hover:border-cyan-500"
            >
              <p className="text-sm text-slate-400">Hoy</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatCurrencyDollar(stats?.revenueToday ?? 0)}</p>
            </Link>
            <Link
              href="/admin/revenue"
              className="rounded-[1.75rem] bg-[#07160f] p-5 transition hover:border-emerald-500"
            >
              <p className="text-sm text-slate-400">Esta semana</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatCurrencyDollar(stats?.revenueThisWeek ?? 0)}</p>
            </Link>
            <Link
              href="/admin/revenue"
              className="rounded-[1.75rem] bg-[#18090d] p-5 transition hover:border-rose-500"
            >
              <p className="text-sm text-slate-400">Este mes</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatCurrencyDollar(stats?.revenueThisMonth ?? 0)}</p>
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.5rem] border border-slate-800 bg-[#070b17] p-4">
              <p className="text-sm text-slate-400">Costo vendido</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatCurrencyDollar(stats?.cogsTotal ?? 0)}</p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-800 bg-[#070b17] p-4">
              <p className="text-sm text-slate-400">Ganancia bruta</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">{formatCurrencyDollar(stats?.grossProfit ?? 0)}</p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-800 bg-[#070b17] p-4">
              <p className="text-sm text-slate-400">Beneficio neto</p>
          <p className="mt-2 text-2xl font-semibold text-cyan-300">{formatCurrencyDollar(stats?.netProfit ?? 0)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-800 bg-[#050816] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Alertas y control</p>
          <div className="mt-5 space-y-4">
            <Link
              href="/admin/products"
              className="block rounded-[1.5rem] border border-amber-900/40 bg-[#171108] p-4 transition hover:border-amber-500"
            >
              <p className="text-sm font-semibold text-white">Stock bajo</p>
              <p className="mt-2 text-sm text-slate-400">
                {formatGroupedNumber(stats?.lowStockProducts.length ?? 0)} productos requieren revision.
              </p>
            </Link>
            <Link
              href="/admin/support"
              className="block rounded-[1.5rem] border border-cyan-900/40 bg-[#071321] p-4 transition hover:border-cyan-500"
            >
              <p className="text-sm font-semibold text-white">Soporte pendiente</p>
              <p className="mt-2 text-sm text-slate-400">
                {formatGroupedNumber(stats?.pendingSupportMessages ?? 0)} mensajes por atender.
              </p>
            </Link>
            <Link
              href="/admin/revenue"
              className="block rounded-[1.5rem] border border-rose-900/40 bg-[#18090d] p-4 transition hover:border-rose-500"
            >
              <p className="text-sm font-semibold text-white">Cancelaciones</p>
              <p className="mt-2 text-sm text-slate-400">
            {formatGroupedNumber(stats?.cancelledOrders ?? 0)} ordenes, {formatCurrencyDollar(stats?.cancelledValue ?? 0)} afectados.
              </p>
            </Link>
            <Link
              href="/admin/revenue"
              className="block rounded-[1.5rem] border border-emerald-900/40 bg-[#07160f] p-4 transition hover:border-emerald-500"
            >
              <p className="text-sm font-semibold text-white">Cobertura de costos</p>
              <p className="mt-2 text-sm text-slate-400">
                {formatGroupedNumber(stats?.trackedProductCount ?? 0)} productos con costo, {formatGroupedNumber(stats?.untrackedProductCount ?? 0)} pendientes.
              </p>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <BarTrendChart
          title="Ingresos diarios"
          subtitle="Ultimos 7 dias"
          points={stats?.revenueSeries ?? []}
          metric="revenue"
          accent="blue"
        />

        <section className="rounded-[2rem] border border-slate-800 bg-[#050816] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Top rentables</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Productos con mejor beneficio</h2>
            </div>
            <Link
              href="/admin/revenue"
              className="rounded-2xl border border-slate-700 bg-[#0d1222] px-4 py-3 text-sm font-semibold text-white transition hover:border-emerald-500"
            >
              Abrir ingresos
            </Link>
          </div>

          <div className="mt-6 space-y-4">
            {(stats?.topProducts ?? []).map((product) => (
              <Link
                key={product.key}
                href={product.linkedProductId ? `/admin/products/${product.linkedProductId}` : "/admin/revenue"}
                className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-slate-800 bg-[#0a1020] px-4 py-4 transition hover:border-emerald-500"
              >
                <div>
                  <p className="text-base font-semibold text-white">{product.name}</p>
                  <p className="mt-1 text-sm text-slate-400">{formatGroupedNumber(product.unitsSold)} unidades | {formatCurrencyDollar(product.revenue)}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-emerald-300">{formatCurrencyDollar(product.profit)}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                    {product.costTracked ? `${formatPercent(product.marginRate)} margen` : "costo pendiente"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[2rem] border border-slate-800 bg-[#050816] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Ordenes recientes</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Ultimos movimientos</h2>
            </div>
            <Link
              href="/admin/orders"
              className="rounded-2xl border border-slate-700 bg-[#0d1222] px-4 py-3 text-sm font-semibold text-white transition hover:border-cyan-500"
            >
              Ver ordenes
            </Link>
          </div>
          <div className="divide-y divide-slate-800">
            {(stats?.recentOrders ?? []).map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="flex items-center justify-between gap-4 px-6 py-5 transition hover:bg-[#0a1020]"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{order.id}</p>
                  <p className="mt-1 text-sm text-slate-400">{order.customerName}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{order.status}</p>
                </div>
                <div className="text-right">
                <p className="text-lg font-semibold text-cyan-300">{formatCurrencyDollar(order.total)}</p>
                  <p className="mt-1 text-sm text-slate-500">{new Date(order.createdAt).toLocaleString()}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-800 bg-[#050816] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Soporte</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Mensajes recientes</h2>
            </div>
            <Link
              href="/admin/support"
              className="rounded-2xl border border-slate-700 bg-[#0d1222] px-4 py-3 text-sm font-semibold text-white transition hover:border-rose-500"
            >
              Abrir soporte
            </Link>
          </div>
          <div className="divide-y divide-slate-800">
            {(stats?.recentSupportMessages ?? []).map((message) => (
              <Link
                key={message.id}
                href={`/admin/support?message=${message.id}`}
                className="block px-6 py-5 transition hover:bg-[#0a1020]"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{message.subject}</p>
                    <p className="mt-1 text-sm text-slate-400">{message.customerName} | {message.customerEmail}</p>
                  </div>
                  <span className="rounded-full bg-[#18090d] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-300">
                    {message.status}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-500">{message.message}</p>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
