"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import BarTrendChart from "@/components/admin/BarTrendChart";
import type { RevenueAnalytics, RevenueComparison } from "@/lib/shop/admin-types";
import { formatCurrencyDollar, formatGroupedNumber, formatPercent } from "@/lib/shop/number-format";

function formatComparison(comparison: RevenueComparison) {
  if (comparison.changeRate === null) {
    return "Nuevo crecimiento";
  }

  if (comparison.changeRate === 0) {
    return "Sin cambio";
  }

  return formatPercent(comparison.changeRate, { showPlusForPositive: true });
}

function getComparisonTone(changeRate: number | null) {
  if (changeRate === null || changeRate > 0) {
    return "text-emerald-300";
  }

  if (changeRate < 0) {
    return "text-rose-300";
  }

  return "text-slate-400";
}

export default function AdminRevenuePage() {
  const [analytics, setAnalytics] = useState<RevenueAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function loadAnalytics() {
      try {
        const response = await fetch("/api/admin/revenue", { cache: "no-store" });
        const data = await response.json();

        if (isActive && data.success) {
          setAnalytics(data.analytics);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadAnalytics();

    return () => {
      isActive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-400"></div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Cargando ingresos</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="rounded-[2rem] border border-rose-900/50 bg-[#12070a] p-10 text-center text-rose-200 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        No se pudieron cargar los ingresos.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2.5rem] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_42%),linear-gradient(180deg,_#060816_0%,_#03050f_100%)] p-8 shadow-[0_24px_90px_rgba(0,0,0,0.4)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Ingresos y contabilidad</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Vista financiera operativa</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Ingresos reales, costo de productos vendidos, beneficio neto, delivery cobrado y
              rendimiento por articulo.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/orders"
              className="rounded-2xl border border-slate-700 bg-[#0d1222] px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-500"
            >
              Abrir ordenes
            </Link>
            <Link
              href="/admin/products"
              className="rounded-2xl border border-slate-700 bg-[#0d1222] px-5 py-3 text-sm font-semibold text-white transition hover:border-emerald-500"
            >
              Abrir productos
            </Link>
            <Link
              href="/admin"
              className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Volver al dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[2rem] border border-slate-800 bg-[#070b17] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Ingresos hoy</p>
              <p className="mt-4 text-4xl font-semibold text-white">{formatCurrencyDollar(analytics.revenueToday)}</p>
          <p className={`mt-3 text-sm font-medium ${getComparisonTone(analytics.todayComparison.changeRate)}`}>
            {formatComparison(analytics.todayComparison)} vs ayer
          </p>
        </div>
        <div className="rounded-[2rem] border border-slate-800 bg-[#070b17] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Ingresos semana</p>
              <p className="mt-4 text-4xl font-semibold text-white">{formatCurrencyDollar(analytics.revenueThisWeek)}</p>
          <p className={`mt-3 text-sm font-medium ${getComparisonTone(analytics.weekComparison.changeRate)}`}>
            {formatComparison(analytics.weekComparison)} vs semana previa
          </p>
        </div>
        <div className="rounded-[2rem] border border-slate-800 bg-[#070b17] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Ingresos mes</p>
              <p className="mt-4 text-4xl font-semibold text-white">{formatCurrencyDollar(analytics.revenueThisMonth)}</p>
          <p className={`mt-3 text-sm font-medium ${getComparisonTone(analytics.monthComparison.changeRate)}`}>
            {formatComparison(analytics.monthComparison)} vs mes previo
          </p>
        </div>
        <div className="rounded-[2rem] border border-slate-800 bg-[#070b17] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Ingresos totales</p>
              <p className="mt-4 text-4xl font-semibold text-white">{formatCurrencyDollar(analytics.totalRevenue)}</p>
          <p className="mt-3 text-sm font-medium text-slate-400">
                Ticket promedio {formatCurrencyDollar(analytics.averageOrderValue)}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[2rem] border border-emerald-900/40 bg-[#05110d] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">Beneficio neto</p>
              <p className="mt-4 text-4xl font-semibold text-white">{formatCurrencyDollar(analytics.netProfit)}</p>
          <p className="mt-3 text-sm text-emerald-200">Despues de costo de mercancia</p>
        </div>
        <div className="rounded-[2rem] border border-blue-900/40 bg-[#06101b] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Delivery cobrado</p>
              <p className="mt-4 text-4xl font-semibold text-white">{formatCurrencyDollar(analytics.deliveryRevenueTotal)}</p>
          <p className="mt-3 text-sm text-cyan-200">Total acumulado por entregas</p>
        </div>
        <div className="rounded-[2rem] border border-rose-900/40 bg-[#13070b] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          <p className="text-xs uppercase tracking-[0.3em] text-rose-400">Canceladas</p>
              <p className="mt-4 text-4xl font-semibold text-white">{formatGroupedNumber(analytics.cancelledOrders)}</p>
              <p className="mt-3 text-sm text-rose-200">{formatCurrencyDollar(analytics.cancelledValue)} bloqueados</p>
        </div>
        <div className="rounded-[2rem] border border-slate-800 bg-[#070b17] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Cobertura de costos</p>
          <p className="mt-4 text-4xl font-semibold text-white">{analytics.trackedProductCount}</p>
          <p className="mt-3 text-sm text-slate-400">
            {analytics.untrackedProductCount} productos vendidos sin costo cargado
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-800 bg-[#050816] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Contabilidad</p>
          <div className="mt-6 space-y-4 text-sm text-slate-300">
            <div className="flex items-center justify-between gap-4">
              <span>Venta de productos</span>
                  <strong className="text-white">{formatCurrencyDollar(analytics.productRevenueTotal)}</strong>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Delivery cobrado</span>
                  <strong className="text-white">{formatCurrencyDollar(analytics.deliveryRevenueTotal)}</strong>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Costo de productos vendidos</span>
                  <strong className="text-white">{formatCurrencyDollar(analytics.cogsTotal)}</strong>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Ganancia bruta</span>
                  <strong className="text-emerald-300">{formatCurrencyDollar(analytics.grossProfit)}</strong>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Beneficio neto</span>
                  <strong className="text-cyan-300">{formatCurrencyDollar(analytics.netProfit)}</strong>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Pedidos completados</span>
              <strong className="text-white">{analytics.completedOrders}</strong>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Unidades vendidas</span>
                  <strong className="text-white">{formatGroupedNumber(analytics.totalUnitsSold)}</strong>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-800 bg-[#050816] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] xl:col-span-2">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Ordenes recientes</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {analytics.recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-4 transition hover:border-cyan-500"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{order.id}</p>
                <p className="mt-3 text-lg font-semibold text-white">{order.customerName}</p>
                <p className="mt-2 text-sm text-slate-400">{new Date(order.createdAt).toLocaleString()}</p>
                <p className="mt-4 text-xl font-semibold text-cyan-300">{formatCurrencyDollar(order.total)}</p>
                <p className="mt-2 text-sm text-slate-300">{order.status}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <BarTrendChart
          title="Ultimos 7 dias"
          subtitle="Ingresos diarios"
          points={analytics.dailySeries}
          metric="revenue"
          accent="blue"
        />
        <BarTrendChart
          title="Ultimas 8 semanas"
          subtitle="Beneficio semanal"
          points={analytics.weeklySeries}
          metric="profit"
          accent="green"
        />
        <BarTrendChart
          title="Ultimos 6 meses"
          subtitle="Ordenes por mes"
          points={analytics.monthlySeries}
          metric="orders"
          accent="red"
        />
      </section>

      <section className="rounded-[2rem] border border-slate-800 bg-[#050816] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-3 border-b border-slate-800 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Ganancias por producto</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Rendimiento por articulo</h2>
          </div>
          <Link
            href="/admin/products"
            className="rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm font-semibold text-white transition hover:border-cyan-500"
          >
            Ver catalogo
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-slate-800 bg-[#090e1b]">
              <tr className="text-left text-xs uppercase tracking-[0.3em] text-slate-500">
                <th className="px-6 py-4">Producto</th>
                <th className="px-6 py-4">Unidades</th>
                <th className="px-6 py-4">Ingreso</th>
                <th className="px-6 py-4">Costo</th>
                <th className="px-6 py-4">Beneficio</th>
                <th className="px-6 py-4">Margen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {analytics.productPerformance.map((product) => (
                <tr key={product.key} className="bg-[#050816]">
                  <td className="px-6 py-5">
                    {product.linkedProductId ? (
                      <Link
                        href={`/admin/products/${product.linkedProductId}`}
                        className="font-semibold text-white hover:text-cyan-300"
                      >
                        {product.name}
                      </Link>
                    ) : (
                      <p className="font-semibold text-white">{product.name}</p>
                    )}
                    <p className="mt-1 text-sm text-slate-500">{product.ordersCount} orden(es)</p>
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-300">{formatGroupedNumber(product.unitsSold)}</td>
                  <td className="px-6 py-5 text-sm font-semibold text-white">
                    {formatCurrencyDollar(product.revenue)}
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-300">
                    {product.costTracked ? formatCurrencyDollar(product.cogs) : "Costo pendiente"}
                  </td>
                  <td className="px-6 py-5 text-sm font-semibold text-emerald-300">
                    {formatCurrencyDollar(product.profit)}
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-300">
                    {product.costTracked ? formatPercent(product.marginRate) : "Pendiente"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
