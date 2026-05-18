"use client";

import Link from "next/link";
import { useState } from "react";

import GoogleMapsEmbed from "@/components/admin/GoogleMapsEmbed";
import { formatCurrencySrd, formatKilometers } from "@/lib/shop/number-format";
import type { DeliveryBlock } from "@/lib/server/admin/delivery-blocks-store";
import type { AdminOrderRecord } from "@/lib/shop/admin-types";

const STORE_ADDRESS_EMBED = "Anton Drachtenweg 146, Paramaribo, Suriname";
const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

type BlockStatusColor = { label: string; cls: string };
const STATUS_COLORS: Record<string, BlockStatusColor> = {
  draft:       { label: "Borrador",    cls: "border-slate-600 bg-slate-700/20 text-slate-300" },
  ready:       { label: "Listo",       cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  in_delivery: { label: "En delivery", cls: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  completed:   { label: "Completado",  cls: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300" },
  cancelled:   { label: "Cancelado",   cls: "border-rose-500/40 bg-rose-500/10 text-rose-300" },
};

function fmt(minutes: number) {
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h}h ${m}min` : `~${h}h`;
}

type Props = {
  block: DeliveryBlock;
  orders: AdminOrderRecord[];
  availableOrders: AdminOrderRecord[];
  assignedOrderIds: Set<string>;
  onClose: () => void;
  onReorder: (orderedIds: string[]) => Promise<void>;
  onRemoveOrder: (orderId: string) => Promise<void>;
  onAddOrder: (orderId: string) => Promise<void>;
  onUpdateStatus: (status: DeliveryBlock["status"]) => Promise<void>;
  onAutoRoute: () => Promise<{ distanceKm: number; durationMinutes: number; gmapsUrl?: string } | null>;
  onDelete: () => Promise<void>;
  onBulkOrderStatus: (status: string) => Promise<void>;
};

export default function BlockManagerModal({
  block,
  orders,
  availableOrders,
  assignedOrderIds,
  onClose,
  onReorder,
  onRemoveOrder,
  onAddOrder,
  onUpdateStatus,
  onAutoRoute,
  onDelete,
  onBulkOrderStatus,
}: Props) {
  const [localOrders, setLocalOrders] = useState<AdminOrderRecord[]>(orders);
  const [routing, setRouting] = useState(false);
  const [gmapsUrl, setGmapsUrl] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddOrders, setShowAddOrders] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warning"; msg: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ km: number; min: number } | null>(
    block.routeDistanceKm ? { km: block.routeDistanceKm, min: block.routeDurationMinutes ?? 0 } : null
  );

  const statusInfo = STATUS_COLORS[block.status] ?? STATUS_COLORS.draft;
  const embedStops = localOrders.map((o, i) => ({
    stopNumber: i + 1,
    name: o.customerName,
    address: o.customerAddress,
  }));

  const freeToAdd = availableOrders.filter(
    (o) => !assignedOrderIds.has(o.id) || localOrders.some((lo) => lo.id === o.id)
  ).filter((o) => !localOrders.some((lo) => lo.id === o.id));

  function moveOrder(index: number, dir: -1 | 1) {
    const next = [...localOrders];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setLocalOrders(next);
  }

  async function handleSaveOrder() {
    setActionLoading("reorder");
    try {
      await onReorder(localOrders.map((o) => o.id));
      setNotice({ tone: "success", msg: "Orden de paradas guardado." });
    } catch {
      setNotice({ tone: "error", msg: "No se pudo guardar el orden." });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAutoRoute() {
    setRouting(true);
    setNotice(null);
    try {
      const result = await onAutoRoute();
      if (result) {
        setRouteInfo({ km: result.distanceKm, min: result.durationMinutes });
        if (result.gmapsUrl) setGmapsUrl(result.gmapsUrl);
        setNotice({ tone: "success", msg: `Ruta calculada: ${result.distanceKm} km · ${fmt(result.durationMinutes)}` });
      } else {
        setNotice({ tone: "error", msg: "No se pudo calcular la ruta." });
      }
    } catch {
      setNotice({ tone: "error", msg: "Error al calcular la ruta." });
    } finally {
      setRouting(false);
    }
  }

  async function handleRemoveOrder(orderId: string) {
    setActionLoading(`remove-${orderId}`);
    try {
      await onRemoveOrder(orderId);
      setLocalOrders((prev) => prev.filter((o) => o.id !== orderId));
      setNotice({ tone: "success", msg: "Orden quitada del bloque." });
    } catch {
      setNotice({ tone: "error", msg: "No se pudo quitar la orden." });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAddOrder(order: AdminOrderRecord) {
    setActionLoading(`add-${order.id}`);
    try {
      await onAddOrder(order.id);
      setLocalOrders((prev) => [...prev, order]);
      setNotice({ tone: "success", msg: `${order.customerName} agregado al bloque.` });
    } catch {
      setNotice({ tone: "error", msg: "No se pudo agregar la orden." });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleStatus(status: DeliveryBlock["status"]) {
    setActionLoading(`status-${status}`);
    try {
      await onUpdateStatus(status);
      setNotice({ tone: "success", msg: `Bloque marcado como: ${STATUS_COLORS[status]?.label ?? status}` });
    } catch {
      setNotice({ tone: "error", msg: "No se pudo actualizar el estado." });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleBulkOrderStatus(status: string) {
    setActionLoading(`bulk-${status}`);
    try {
      await onBulkOrderStatus(status);
      setNotice({ tone: "success", msg: `${localOrders.length} ordenes → "${status}"` });
    } catch {
      setNotice({ tone: "error", msg: "No se pudo actualizar las ordenes." });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete() {
    setActionLoading("delete");
    try {
      await onDelete();
      onClose();
    } catch {
      setNotice({ tone: "error", msg: "No se pudo eliminar el bloque." });
      setConfirmDelete(false);
    } finally {
      setActionLoading(null);
    }
  }

  const totalAmount = localOrders.reduce((s, o) => s + o.total, 0);
  const totalDelivery = localOrders.reduce((s, o) => s + o.deliveryFee, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative flex w-full max-w-[1440px] flex-col overflow-hidden bg-[#050816] shadow-[0_32px_120px_rgba(0,0,0,0.8)] md:m-4 md:rounded-[2rem]">

        {/* Header */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">{block.id}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
            </div>
            <h2 className="mt-0.5 text-xl font-semibold text-white">{block.name}</h2>
            <p className="text-xs text-slate-500">{localOrders.length} paradas · {block.createdAt ? new Date(block.createdAt).toLocaleDateString("es") : ""}</p>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-400 hover:border-cyan-500 hover:text-white">
            ✕
          </button>
        </div>

        {/* Body — 2 col */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">

          {/* Left: map + route info */}
          <div className="flex flex-col border-b border-slate-800 lg:w-[48%] lg:border-b-0 lg:border-r" style={{ minHeight: "360px" }}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Ruta · Google Maps</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={routing || localOrders.length === 0}
                  onClick={() => void handleAutoRoute()}
                  className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold text-violet-300 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {routing ? "Calculando..." : "🗺 Organizar automáticamente"}
                </button>
                {(gmapsUrl ?? (localOrders.length > 0 ? buildGmapsUrl(localOrders) : "")) && (
                  <a
                    href={gmapsUrl ?? buildGmapsUrl(localOrders)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/20"
                  >
                    Abrir en Google Maps ↗
                  </a>
                )}
              </div>
            </div>

            {/* Route stats */}
            {routeInfo && (
              <div className="flex gap-6 border-b border-slate-800 px-4 py-2 text-xs text-slate-400">
                <span>🛣 <strong className="text-white">{routeInfo.km} km</strong></span>
                <span>⏱ <strong className="text-white">{fmt(routeInfo.min)}</strong></span>
                <span>💰 <strong className="text-cyan-300">{formatCurrencySrd(totalAmount)}</strong></span>
              </div>
            )}

            <div className="flex-1 p-3" style={{ minHeight: "280px" }}>
              <GoogleMapsEmbed stops={embedStops} storeAddress={STORE_ADDRESS_EMBED} apiKey={MAPS_API_KEY} />
            </div>
          </div>

          {/* Right: stops list */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Orden de entrega ({localOrders.length} paradas)</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddOrders((v) => !v)}
                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                >
                  {showAddOrders ? "Ocultar" : "+ Agregar orden"}
                </button>
                <button
                  type="button"
                  disabled={actionLoading === "reorder"}
                  onClick={() => void handleSaveOrder()}
                  className="rounded-lg border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-300 hover:border-cyan-500 hover:text-white disabled:opacity-40"
                >
                  {actionLoading === "reorder" ? "..." : "Guardar orden"}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Add orders panel */}
              {showAddOrders && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2 mb-2">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
                    Pedidos disponibles ({freeToAdd.length})
                  </p>
                  {freeToAdd.length === 0 ? (
                    <p className="text-xs text-slate-500">No hay pedidos disponibles para agregar.</p>
                  ) : (
                    freeToAdd.map((o) => (
                      <div key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-[#0a1020] px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">{o.customerName} <span className="font-mono text-xs text-cyan-400">···{o.idTail}</span></p>
                          <p className="truncate text-xs text-slate-400">{o.customerAddress}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{formatCurrencySrd(o.total)}</span>
                          <button
                            type="button"
                            disabled={actionLoading === `add-${o.id}`}
                            onClick={() => void handleAddOrder(o)}
                            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
                          >
                            {actionLoading === `add-${o.id}` ? "..." : "+ Agregar"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Stops list */}
              {localOrders.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-700 py-8 text-center text-sm text-slate-500">
                  No hay ordenes en este bloque.
                </p>
              ) : (
                localOrders.map((order, index) => (
                  <div key={order.id} className="overflow-hidden rounded-xl border border-slate-800 bg-[#0a1020]">
                    <div className="flex items-start gap-3 p-3">
                      {/* Stop number + reorder */}
                      <div className="flex shrink-0 flex-col items-center gap-1">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500 text-xs font-bold text-slate-950">
                          {index + 1}
                        </div>
                        <button type="button" disabled={index === 0} onClick={() => moveOrder(index, -1)}
                          className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 text-slate-500 hover:border-cyan-500 hover:text-white disabled:opacity-20">
                          ▲
                        </button>
                        <button type="button" disabled={index === localOrders.length - 1} onClick={() => moveOrder(index, 1)}
                          className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 text-slate-500 hover:border-cyan-500 hover:text-white disabled:opacity-20">
                          ▼
                        </button>
                      </div>

                      {/* Order info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-white">{order.customerName}</p>
                            <p className="text-xs text-slate-400">{order.customerPhone}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{order.customerAddress}</p>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                              {order.items.map((item, i) => (
                                <span key={i}>{item.quantity}× {item.name}</span>
                              ))}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold text-white">{formatCurrencySrd(order.total)}</p>
                            <p className="text-xs text-slate-400">Delivery {formatCurrencySrd(order.deliveryFee)}</p>
                            <p className={`mt-1 text-[10px] font-semibold uppercase ${
                              order.isCancelled ? "text-rose-400" : order.isCompleted ? "text-emerald-400" : "text-amber-300"
                            }`}>{order.adminStatus ?? order.status}</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Link href={`/admin/orders/${order.id}`} target="_blank"
                            className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400 hover:border-cyan-500 hover:text-white">
                            Ver pedido ↗
                          </Link>
                          <button
                            type="button"
                            disabled={actionLoading === `remove-${order.id}`}
                            onClick={() => void handleRemoveOrder(order.id)}
                            className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-400 hover:bg-rose-500/20 disabled:opacity-40"
                          >
                            {actionLoading === `remove-${order.id}` ? "..." : "Quitar del bloque"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-800 px-6 py-4">
          {notice && (
            <div className={`mb-3 rounded-xl border px-4 py-2 text-xs ${
              notice.tone === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : notice.tone === "warning" ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            }`}>
              {notice.msg}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: stats + bulk actions */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-4 text-sm text-slate-400">
                <span>{localOrders.length} paradas</span>
                <span>Total <strong className="text-white">{formatCurrencySrd(totalAmount)}</strong></span>
                <span>Delivery <strong className="text-emerald-300">{formatCurrencySrd(totalDelivery)}</strong></span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" disabled={!!actionLoading} onClick={() => void handleBulkOrderStatus("Confirmando stock")}
                  className="rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-40">
                  📋 Stock
                </button>
                <button type="button" disabled={!!actionLoading} onClick={() => void handleBulkOrderStatus("Preparando pedido")}
                  className="rounded border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-300 hover:bg-violet-500/20 disabled:opacity-40">
                  📦 Preparar
                </button>
                <button type="button" disabled={!!actionLoading} onClick={() => void handleBulkOrderStatus("En delivery")}
                  className="rounded border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/20 disabled:opacity-40">
                  🚚 En delivery
                </button>
                <button type="button" disabled={!!actionLoading} onClick={() => void handleBulkOrderStatus("Pedido completado")}
                  className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40">
                  ✓ Entregado
                </button>
              </div>
            </div>

            {/* Right: block status actions */}
            <div className="flex flex-wrap gap-2">
              {confirmDelete ? (
                <div className="flex gap-2">
                  <span className="self-center text-xs text-rose-300">¿Eliminar bloque?</span>
                  <button type="button" disabled={actionLoading === "delete"} onClick={() => void handleDelete()}
                    className="rounded-xl border border-rose-500 bg-rose-500/20 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/30">
                    {actionLoading === "delete" ? "..." : "Sí, eliminar"}
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)}
                    className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400">
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  {block.status !== "in_delivery" && (
                    <button type="button" disabled={!!actionLoading} onClick={() => void handleStatus("in_delivery")}
                      className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-500/20 disabled:opacity-40">
                      🚚 Marcar en delivery
                    </button>
                  )}
                  {block.status !== "completed" && (
                    <button type="button" disabled={!!actionLoading} onClick={() => void handleStatus("completed")}
                      className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40">
                      ✓ Marcar completado
                    </button>
                  )}
                  {block.status !== "cancelled" && (
                    <button type="button" onClick={() => setConfirmDelete(true)}
                      className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-400 hover:bg-rose-500/20">
                      🗑 Eliminar bloque
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function buildGmapsUrl(orders: AdminOrderRecord[]): string {
  if (orders.length === 0) return "";
  const store = "Anton Drachtenweg 146, Paramaribo, Suriname";
  const addresses = orders.map((o) => o.customerAddress);
  const enc = encodeURIComponent;
  const base = `https://www.google.com/maps/dir/?api=1&origin=${enc(store)}&destination=${enc(addresses[addresses.length - 1])}&travelmode=driving`;
  if (addresses.length > 1) {
    const wps = addresses.slice(0, -1).map(enc).join("|");
    return `${base}&waypoints=${wps}`;
  }
  return base;
}
