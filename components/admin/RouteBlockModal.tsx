"use client";

import Link from "next/link";
import { useState } from "react";

import { formatCurrencySrd, formatKilometers } from "@/lib/shop/number-format";
import { ADMIN_ORDER_STATUS_OPTIONS } from "@/lib/shop/order-status";
import type { AdminOrderRouteBlock, AdminOrderRouteStop } from "@/lib/shop/admin-order-routing";
import type { AdminOrderRecord } from "@/lib/shop/admin-types";

import GoogleMapsEmbed from "@/components/admin/GoogleMapsEmbed";

const STORE_ADDRESS_EMBED = "Anton Drachtenweg 146, Paramaribo, Suriname";
const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function formatTime(minutes: number) {
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h}h ${m}min` : `~${h}h`;
}

// ─── order detail panel ───────────────────────────────────────────────────────
function OrderDetailPanel({ order, onClose }: { order: AdminOrderRecord; onClose: () => void }) {
  return (
    <div className="rounded-[1.5rem] border border-cyan-500/30 bg-[#050d1f] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Detalle del pedido</p>
          <p className="mt-1 text-base font-semibold text-white">{order.id}</p>
        </div>
        <button type="button" onClick={onClose}
          className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-400 hover:border-cyan-500 hover:text-white">
          Cerrar
        </button>
      </div>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Cliente</p>
          <p className="mt-1 font-semibold text-white">{order.customerName}</p>
          <p className="text-slate-400">{order.customerPhone}</p>
          <p className="text-slate-400">{order.customerEmail}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Direccion</p>
          <p className="mt-1 text-slate-300">{order.customerAddress}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Productos</p>
        {order.items.map((item, i) => (
          <div key={`${order.id}-${i}`}
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#0a1020] px-3 py-2 text-sm">
            <span className="text-slate-300">{item.quantity}x {item.name}</span>
            <span className="font-semibold text-white">{formatCurrencySrd(item.price * item.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#0a1020] px-3 py-2 text-sm">
        <span className="text-slate-400">
          Subtotal <span className="font-semibold text-white">{formatCurrencySrd(order.subtotal)}</span>
          {" · "}
          Delivery <span className="font-semibold text-white">{formatCurrencySrd(order.deliveryFee)}</span>
        </span>
        <span className="font-bold text-cyan-300">{formatCurrencySrd(order.total)}</span>
      </div>
      <div className="mt-3 flex justify-end">
        <Link href={`/admin/orders/${order.id}`} target="_blank"
          className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-cyan-500 hover:text-white">
          Abrir pagina completa
        </Link>
      </div>
    </div>
  );
}

// ─── stop row ────────────────────────────────────────────────────────────────
function StopRow({ stop, isFirst, isLast, isExpanded, onMoveUp, onMoveDown, onToggleExpand }: {
  stop: AdminOrderRouteStop;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleExpand: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-800 bg-[#0a1020]">
      <div className="flex items-start gap-3 p-4">
        <div className="flex shrink-0 flex-col items-center gap-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500 text-xs font-bold text-slate-950">
            {String(stop.stopNumber).padStart(2, "0")}
          </div>
          <button type="button" disabled={isFirst} onClick={onMoveUp} aria-label="Mover arriba"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 text-slate-400 transition hover:border-cyan-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-30">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button type="button" disabled={isLast} onClick={onMoveDown} aria-label="Mover abajo"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 text-slate-400 transition hover:border-cyan-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-30">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <button type="button" onClick={onToggleExpand}
                className="text-left text-base font-semibold text-white hover:text-cyan-300">
                {stop.order.customerName}
              </button>
              <p className="mt-0.5 text-sm text-slate-400">{stop.addressLabel}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{stop.order.customerAddress}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold text-white">{formatCurrencySrd(stop.order.total)}</p>
              <p className="text-xs text-slate-400">
                {stop.packages} {stop.packages === 1 ? "paquete" : "paquetes"} · {stop.order.items.length} lineas
              </p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-700 bg-[#050816] px-2 py-0.5 text-xs text-slate-400">
              Tramo {formatKilometers(stop.estimatedLegKm)}
            </span>
            <span className="rounded-full border border-slate-700 bg-[#050816] px-2 py-0.5 text-xs text-slate-400">
              Acum {formatKilometers(stop.cumulativeKm)}
            </span>
            <button type="button" onClick={onToggleExpand}
              className="rounded-full border border-slate-700 bg-[#050816] px-2 py-0.5 text-xs text-cyan-400 transition hover:border-cyan-500 hover:text-cyan-300">
              {isExpanded ? "Ocultar pedido" : "Ver pedido"}
            </button>
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="border-t border-slate-800 px-4 pb-4 pt-3">
          <OrderDetailPanel order={stop.order} onClose={onToggleExpand} />
        </div>
      )}
    </div>
  );
}


// ─── modal ────────────────────────────────────────────────────────────────────
type Props = {
  block: AdminOrderRouteBlock;
  savedStopOrder: string[] | null;
  onClose: () => void;
  onSave: (blockId: string, orderedIds: string[]) => void;
  onSend: (block: AdminOrderRouteBlock) => Promise<void>;
  isSending: boolean;
};

export default function RouteBlockModal({ block, savedStopOrder, onClose, onSave, onSend, isSending }: Props) {
  const buildInitialStops = (): AdminOrderRouteStop[] => {
    if (!savedStopOrder) return [...block.stops];
    return savedStopOrder
      .map((id, i) => {
        const orig = block.stops.find((s) => s.order.id === id);
        return orig ? { ...orig, stopNumber: i + 1 } : null;
      })
      .filter((x): x is AdminOrderRouteStop => x !== null);
  };

  const [stops, setStops] = useState<AdminOrderRouteStop[]>(buildInitialStops);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  // Build embed stops from current stop order — changes when user reorders
  const embedStops = stops.map((s) => ({
    stopNumber: s.stopNumber,
    name: s.order.customerName,
    address: s.order.customerAddress,
  }));

  function moveStop(index: number, dir: -1 | 1) {
    const next = [...stops];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setStops(next.map((s, i) => ({ ...s, stopNumber: i + 1 })));
    setSavedOk(false);
  }

  function handleSave() {
    onSave(block.id, stops.map((s) => s.order.id));
    setSavedOk(true);
  }

  const hasChanges = stops.some((s, i) => s.order.id !== block.stops[i]?.order.id);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/75 backdrop-blur-sm"
      role="dialog" aria-modal="true">
      <div className="relative flex w-full max-w-[1440px] flex-col overflow-hidden rounded-none bg-[#050816] shadow-[0_32px_120px_rgba(0,0,0,0.8)] md:m-4 md:rounded-[2rem]">

        {/* ── Header ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">{block.label}</p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              {block.stopsCount} paradas · {formatKilometers(block.estimatedTotalKm)} · {formatTime(block.estimatedTimeMinutes)}
            </h2>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 text-slate-400 transition hover:border-cyan-500 hover:text-white">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">

          {/* Google Maps Embed — real map, no JS API needed */}
          <div className="flex flex-col border-b border-slate-800 lg:w-[52%] lg:border-b-0 lg:border-r"
            style={{ minHeight: "360px" }}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                Ruta real · Google Maps
              </p>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {stops.length} {stops.length === 1 ? "parada" : "paradas"}
              </span>
            </div>
            <div className="flex-1 p-3" style={{ minHeight: "300px" }}>
              <GoogleMapsEmbed
                stops={embedStops}
                storeAddress={STORE_ADDRESS_EMBED}
                apiKey={MAPS_API_KEY}
              />
            </div>
          </div>

          {/* Stops list */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Orden de entrega</p>
              {hasChanges && !savedOk && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
                  Cambios sin guardar
                </span>
              )}
              {savedOk && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                  ✓ Orden guardado
                </span>
              )}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {stops.map((stop, index) => (
                <StopRow
                  key={stop.order.id}
                  stop={stop}
                  isFirst={index === 0}
                  isLast={index === stops.length - 1}
                  isExpanded={expandedId === stop.order.id}
                  onMoveUp={() => moveStop(index, -1)}
                  onMoveDown={() => moveStop(index, 1)}
                  onToggleExpand={() =>
                    setExpandedId((c) => (c === stop.order.id ? null : stop.order.id))
                  }
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-6 py-4">
          <div className="flex flex-wrap gap-3 text-sm text-slate-400">
            <span>Total <strong className="text-white">{formatCurrencySrd(block.totalAmount)}</strong></span>
            <span>·</span>
            <span>Delivery <strong className="text-white">{formatCurrencySrd(block.deliveryFees)}</strong></span>
            <span>·</span>
            <span>Ruta <strong className="text-white">{formatKilometers(block.estimatedTotalKm)}</strong></span>
            <span>·</span>
            <span>Tiempo <strong className="text-white">{formatTime(block.estimatedTimeMinutes)}</strong></span>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={!hasChanges || savedOk}
              onClick={handleSave}
              className="rounded-2xl border border-slate-600 bg-[#0a1020] px-5 py-2.5 text-sm font-semibold text-white transition hover:border-cyan-500 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savedOk ? "✓ Guardado" : "Guardar cambios"}
            </button>
            <button
              type="button"
              disabled={isSending || block.isSent}
              onClick={() => void onSend(block)}
              className="rounded-2xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400"
            >
              {isSending ? "Enviando..." : block.isSent ? "Bloque enviado" : "Enviar bloque"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
