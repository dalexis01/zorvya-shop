"use client";

import { formatCurrencyDollar, formatGroupedNumber } from "@/lib/shop/number-format";
import type { RevenueChartPoint } from "@/lib/shop/admin-types";

interface BarTrendChartProps {
  title: string;
  subtitle: string;
  points: RevenueChartPoint[];
  metric: "revenue" | "profit" | "orders";
  accent: "blue" | "green" | "red";
}

function getAccentClasses(accent: BarTrendChartProps["accent"]) {
  if (accent === "green") {
    return {
      bar: "from-emerald-500 to-emerald-300",
      value: "text-emerald-300",
      title: "text-emerald-200",
    };
  }

  if (accent === "red") {
    return {
      bar: "from-rose-500 to-red-300",
      value: "text-rose-300",
      title: "text-rose-200",
    };
  }

  return {
    bar: "from-cyan-500 to-blue-400",
    value: "text-cyan-300",
    title: "text-cyan-200",
  };
}

function getPointValue(point: RevenueChartPoint, metric: BarTrendChartProps["metric"]) {
  if (metric === "orders") {
    return point.orders;
  }

  if (metric === "profit") {
    return point.profit;
  }

  return point.revenue;
}

export default function BarTrendChart({
  title,
  subtitle,
  points,
  metric,
  accent,
}: BarTrendChartProps) {
  const accentClasses = getAccentClasses(accent);
  const maxValue = Math.max(...points.map((point) => getPointValue(point, metric)), 1);

  return (
    <section className="rounded-[2rem] border border-slate-800 bg-[#050816] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className={`text-xs uppercase tracking-[0.35em] ${accentClasses.title}`}>{title}</p>
          <p className="mt-3 text-sm text-slate-400">{subtitle}</p>
        </div>
      </div>

      <div className="mt-8 flex items-end gap-3 overflow-x-auto pb-2">
        {points.map((point) => {
          const value = getPointValue(point, metric);
          const height = Math.max((value / maxValue) * 180, value > 0 ? 16 : 6);

          return (
            <div key={`${title}-${point.label}`} className="flex min-w-16 flex-1 flex-col items-center gap-3">
              <p className={`text-xs font-semibold ${accentClasses.value}`}>
                {metric === "orders" ? formatGroupedNumber(value) : formatCurrencyDollar(value)}
              </p>
              <div className="flex h-48 w-full items-end rounded-[1.5rem] bg-slate-900/80 p-2">
                <div
                  className={`w-full rounded-[1rem] bg-gradient-to-t ${accentClasses.bar} shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-transform hover:-translate-y-1`}
                  style={{ height }}
                />
              </div>
              <p className="text-center text-xs font-medium text-slate-500">{point.label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
