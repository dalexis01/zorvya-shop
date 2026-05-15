"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import CancelOrderDialog from "@/components/admin/CancelOrderDialog";
import RouteBlockModal from "@/components/admin/RouteBlockModal";
import { formatCurrencySrd, formatKilometers } from "@/lib/shop/number-format";
import { planAdminOrderRoutes, type AdminOrderRouteBlock, type AdminOrderRouteStop } from "@/lib/shop/admin-order-routing";
import { ADMIN_ORDER_STATUS_OPTIONS } from "@/lib/shop/order-status";
import type { AdminOrderRecord, AdminOrdersMeta } from "@/lib/shop/admin-types";
import type { ProductAccountingEntry } from "@/app/api/admin/products/accounting/route";

// ─── types ────────────────────────────────────────────────────────────────────
type Tab = "blocks" | "orders" | "pickups" | "cancelled" | "completed";
type StatusFilter = "all" | "pending" | "completed" | "cancelled";
type DeliveryFilter = "all" | "delivery" | "pickup";
type Notice = { tone: "success" | "warning" | "error"; message: string };
type AdminOrdersResponse = {
  success?: boolean; orders?: AdminOrderRecord[]; hasMore?: boolean; nextCursor?: string | null;
};

const LIMIT = 24;
const TAB_PARAMS: Record<Tab, { status: StatusFilter; deliveryType: DeliveryFilter }> = {
  blocks:    { status: "pending",   deliveryType: "delivery" },
  orders:    { status: "all",       deliveryType: "delivery" },
  pickups:   { status: "all",       deliveryType: "pickup"   },
  cancelled: { status: "cancelled", deliveryType: "all"      },
  completed: { status: "completed", deliveryType: "all"      },
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function getInitialStatus(o: AdminOrderRecord) { return o.adminStatus ?? ""; }

function mergeOrders(a: AdminOrderRecord[], b: AdminOrderRecord[]) {
  const m = new Map(a.map((o) => [o.id, o]));
  for (const o of b) m.set(o.id, o);
  return Array.from(m.values()).sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
}

function apiUrl(p: { status: StatusFilter; deliveryType: DeliveryFilter; last4: string; cursor?: string | null }) {
  const sp = new URLSearchParams({ status: p.status, deliveryType: p.deliveryType, last4: p.last4, limit: String(LIMIT) });
  if (p.cursor) sp.set("cursor", p.cursor);
  return `/api/admin/orders?${sp.toString()}`;
}

function noticeClass(t: Notice["tone"]) {
  if (t === "success") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-100";
  if (t === "warning") return "border-amber-500/20 bg-amber-500/10 text-amber-100";
  return "border-rose-500/20 bg-rose-500/10 text-rose-100";
}

function statusBadge(o: AdminOrderRecord) {
  if (o.isCancelled) return { text: "Cancelada",  cls: "bg-rose-500/20 text-rose-300 border-rose-500/30" };
  if (o.isCompleted) return { text: "Completada", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };
  if (o.isPending)   return { text: "Pendiente",  cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" };
  return { text: o.status, cls: "bg-slate-500/20 text-slate-300 border-slate-500/30" };
}

function formatTime(m: number) {
  if (m < 60) return `~${m}m`;
  const h = Math.floor(m / 60); const r = m % 60;
  return r > 0 ? `~${h}h${r}m` : `~${h}h`;
}

// ─── shared table shell ───────────────────────────────────────────────────────
function TH({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`border-b border-r border-slate-700 bg-[#0a0f1e] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300 whitespace-nowrap ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function TD({ children, right, muted, cls }: { children: React.ReactNode; right?: boolean; muted?: boolean; cls?: string }) {
  return (
    <td className={`border-b border-r border-slate-800 px-3 py-2.5 text-sm align-top ${right ? "text-right" : ""} ${muted ? "text-slate-400" : "text-slate-100"} ${cls ?? ""}`}>
      {children}
    </td>
  );
}

function paymentLabel(order: AdminOrderRecord) {
  if (order.payment.method === "paypal") {
    const state = (order.payment as { state?: string }).state ?? "";
    const stateLabel = state === "captured" ? "Capturado" : state === "authorized" ? "Autorizado" : state;
    return { label: "PayPal", sub: stateLabel, cls: "text-blue-400" };
  }
  return { label: "Efectivo", sub: "", cls: "text-emerald-400" };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es", { day: "2-digit", month: "2-digit", year: "2-digit" });
}


// ─── click-menu (address / phone) ────────────────────────────────────────────
function ClickMenu({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: Array<{ label: string; icon: string; onClick: () => void; href?: string }>;
}) {
  useEffect(() => {
    if (!open) return;
    const close = () => onClose();
    document.addEventListener("click", close, { once: true });
    return () => document.removeEventListener("click", close);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="absolute left-0 top-full z-30 mt-1 min-w-[170px] overflow-hidden rounded-xl border border-slate-600 bg-[#0a1428] shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item) =>
        item.href ? (
          <a
            key={item.label}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-[#162040] hover:text-white"
          >
            <span>{item.icon}</span> {item.label}
          </a>
        ) : (
          <button
            key={item.label}
            type="button"
            onClick={() => { item.onClick(); onClose(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-[#162040] hover:text-white"
          >
            <span>{item.icon}</span> {item.label}
          </button>
        )
      )}
    </div>
  );
}

// ─── order row (used in both the orders/pickups table AND block sub-rows) ─────
function OrderRow({
  order, rowIndex, statusDraft, activeOrderId, pendingAction,
  stopInfo, accountingMap, onDraftChange, onSaveStatus, onOpenCancel,
}: {
  order: AdminOrderRecord;
  rowIndex: number;
  statusDraft: string;
  activeOrderId: string | null;
  pendingAction: "update-status" | "cancel-order" | null;
  stopInfo?: AdminOrderRouteStop;
  accountingMap: Map<string, ProductAccountingEntry>;
  onDraftChange: (id: string, val: string) => void;
  onSaveStatus: (o: AdminOrderRecord) => Promise<void>;
  onOpenCancel: (o: AdminOrderRecord) => void;
}) {
  const [addrMenuOpen, setAddrMenuOpen] = useState(false);
  const [phoneMenu, setPhoneMenu] = useState<string | null>(null);

  const saving    = activeOrderId === order.id && pendingAction === "update-status";
  const canceling = activeOrderId === order.id && pendingAction === "cancel-order";
  const { text: stText, cls: stCls } = statusBadge(order);
  const items    = order.items;
  const rowBg = rowIndex % 2 === 0 ? "bg-[#050816]" : "bg-[#070d1c]";
  const pay      = paymentLabel(order);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customerAddress)}`;

  return (
    <tr className={`${rowBg} transition-colors hover:bg-[#0c1530]`}>

      {/* ── Estado + Fecha + ID + Parada (todo en una casilla) ── */}
      <TD cls="w-48">
        <div className="space-y-3">
          {stopInfo ? (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500 text-xs font-bold text-slate-950">
              {stopInfo.stopNumber}
            </span>
          ) : (
            <span className="text-xs text-slate-500 font-mono">{rowIndex + 1}</span>
          )}
          <span className={`block w-fit rounded border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.1em] ${stCls}`}>
            {stText}
          </span>
          <p className="font-mono text-xs text-slate-300 leading-relaxed">
            {formatDate(order.createdAt)}{" "}
            <span className="text-slate-500">
              {new Date(order.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </p>
          <Link
            href={`/admin/orders/${order.id}`}
            target="_blank"
            className="block font-mono text-sm font-bold text-cyan-400 hover:text-cyan-200 hover:underline"
          >
            ···{order.idTail}
          </Link>
        </div>
      </TD>

      {/* Cliente */}
      <TD cls="min-w-[140px]">
        <p className="font-semibold text-white leading-tight">{order.customerName}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{order.customerPhone}</p>
      </TD>

      {/* Dirección — clickable → Google Maps / Copiar */}
      <TD cls="min-w-[200px]">
        <div className="relative">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setAddrMenuOpen((v) => !v); }}
            className="text-left text-xs leading-snug text-slate-200 hover:text-cyan-300 focus:outline-none"
          >
            {order.customerAddress}
            <span className="ml-1 text-[9px] text-slate-600">▼</span>
          </button>
          <ClickMenu
            open={addrMenuOpen}
            onClose={() => setAddrMenuOpen(false)}
            items={[
              {
                label: "Abrir en Google Maps",
                icon: "📍",
                href: mapsUrl,
                onClick: () => {},
              },
              {
                label: "Copiar direccion",
                icon: "📋",
                onClick: () => navigator.clipboard.writeText(order.customerAddress),
              },
            ]}
          />
        </div>
      </TD>

      {/* Productos + info contable inline */}
      <TD cls="min-w-[240px]">
        <div className="space-y-2">
          {items.map((item, i) => {
            const acc = accountingMap.get(String(item.productId ?? ""));
            const phone = acc?.supplierPhone ?? "";
            return (
              <div key={i} className="space-y-0.5">
                <p className="text-xs font-semibold leading-tight text-white">
                  <span className="font-bold text-cyan-300">{item.quantity}×</span>{" "}
                  <Link href={item.href} className="hover:text-cyan-300">{item.name}</Link>
                </p>
                {acc ? (
                  <div className="ml-3 space-y-0.5 border-l border-amber-500/30 pl-2">
                    {acc.supplier && (
                      <p className="text-[10px] text-amber-300">
                        <span className="text-slate-500">Prov:</span> {acc.supplier}
                      </p>
                    )}
                    {acc.costPrice > 0 && (
                      <p className="text-[10px] font-mono text-rose-300">
                        <span className="text-slate-500">Costo:</span>{" "}
                        {formatCurrencySrd(acc.costPrice)}
                        {item.quantity > 1 && (
                          <span className="text-slate-500 ml-1">
                            × {item.quantity} ={" "}
                            {formatCurrencySrd(acc.costPrice * item.quantity)}
                          </span>
                        )}
                      </p>
                    )}
                    {/* Teléfono proveedor — clic para Copiar / Llamar */}
                    {phone ? (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhoneMenu((v) => (v === phone ? null : phone));
                          }}
                          className="text-[10px] font-semibold text-emerald-300 hover:text-emerald-200"
                        >
                          📞 {phone}
                        </button>
                        <ClickMenu
                          open={phoneMenu === phone}
                          onClose={() => setPhoneMenu(null)}
                          items={[
                            {
                              label: "Copiar numero",
                              icon: "📋",
                              onClick: () => navigator.clipboard.writeText(phone),
                            },
                            {
                              label: "Llamar",
                              icon: "📞",
                              href: `tel:${phone}`,
                              onClick: () => {},
                            },
                          ]}
                        />
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-600 italic">Sin tel. proveedor</p>
                    )}
                  </div>
                ) : (
                  <p className="ml-3 text-[10px] text-slate-700">Sin datos contables</p>
                )}
              </div>
            );
          })}
        </div>
      </TD>

      {/* Subtotal */}
      <TD right cls="w-28 font-mono text-slate-200">{formatCurrencySrd(order.subtotal)}</TD>

      {/* Delivery */}
      <TD right cls="w-24 font-mono text-slate-200">{formatCurrencySrd(order.deliveryFee)}</TD>

      {/* Total */}
      <TD right cls="w-28 font-bold text-white font-mono">{formatCurrencySrd(order.total)}</TD>

      {/* Pago */}
      <TD cls="w-28">
        <p className={`text-xs font-bold ${pay.cls}`}>{pay.label}</p>
        {pay.sub && <p className="text-[10px] text-slate-400 mt-0.5">{pay.sub}</p>}
      </TD>

      {/* Km tramo (solo en bloques) */}
      {stopInfo !== undefined && (
        <TD right cls="w-16 font-mono text-xs font-semibold text-cyan-300">
          {formatKilometers(stopInfo.estimatedLegKm)}
        </TD>
      )}

      {/* Acciones */}
      <TD cls="w-52 !py-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <select
              value={statusDraft}
              onChange={(e) => onDraftChange(order.id, e.target.value)}
              disabled={order.isCancelled}
              className="flex-1 rounded border border-slate-600 bg-[#0c1220] px-2 py-1.5 text-[11px] text-white outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:text-slate-500"
            >
              <option value="">Automatico</option>
              {ADMIN_ORDER_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void onSaveStatus(order)}
              disabled={saving || order.isCancelled || !statusDraft || statusDraft === order.adminStatus}
              className="rounded border border-cyan-500/50 bg-cyan-500/15 px-2 py-1.5 text-[11px] font-bold text-cyan-300 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {saving ? "…" : "✓"}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {!order.isCancelled ? (
              <button
                type="button"
                onClick={() => onOpenCancel(order)}
                disabled={canceling}
                className="flex-1 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:cursor-not-allowed"
              >
                {canceling ? "…" : "Cancelar"}
              </button>
            ) : (
              <span className="flex-1 rounded border border-slate-700 px-2 py-1.5 text-center text-[11px] font-medium text-slate-500">
                Cancelada
              </span>
            )}
            <Link
              href={`/admin/orders/${order.id}`}
              className="rounded border border-slate-600 bg-[#0c1220] px-2 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:border-cyan-500 hover:text-white"
            >
              Ver
            </Link>
          </div>
        </div>
      </TD>
    </tr>
  );
}

// ─── orders table (Pedidos / Recogida tabs) ───────────────────────────────────
function OrdersTable({
  orders, statusDrafts, activeOrderId, pendingAction, accountingMap,
  onDraftChange, onSaveStatus, onOpenCancel,
}: {
  orders: AdminOrderRecord[];
  statusDrafts: Record<string, string>;
  activeOrderId: string | null;
  pendingAction: "update-status" | "cancel-order" | null;
  accountingMap: Map<string, ProductAccountingEntry>;
  onDraftChange: (id: string, val: string) => void;
  onSaveStatus: (o: AdminOrderRecord) => Promise<void>;
  onOpenCancel: (o: AdminOrderRecord) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-[1.5rem] border border-slate-700 shadow-[0_16px_60px_rgba(0,0,0,0.4)]">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <TH>Estado / Fecha / ID</TH>
            <TH>Cliente</TH>
            <TH>Direccion</TH>
            <TH>Productos</TH>
            <TH right>Subtotal</TH>
            <TH right>Delivery</TH>
            <TH right>Total</TH>
            <TH>Pago</TH>
            <TH>Acciones</TH>
          </tr>
        </thead>
        <tbody>
          {orders.map((order, i) => (
            <OrderRow
              key={order.id}
              order={order}
              rowIndex={i}
              accountingMap={accountingMap}
              statusDraft={statusDrafts[order.id] ?? ""}
              activeOrderId={activeOrderId}
              pendingAction={pendingAction}
              onDraftChange={onDraftChange}
              onSaveStatus={onSaveStatus}
              onOpenCancel={onOpenCancel}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── blocks table (Bloques de ordenes tab) ────────────────────────────────────
function BlocksTable({
  routeBlocks, nonRouteOrders, statusDrafts, activeOrderId, pendingAction,
  sentBlocks, sendingBlockId, accountingMap,
  onViewRoute, onSend, onDraftChange, onSaveStatus, onOpenCancel,
}: {
  routeBlocks: ReturnType<typeof planAdminOrderRoutes>["routeBlocks"];
  nonRouteOrders: AdminOrderRecord[];
  statusDrafts: Record<string, string>;
  activeOrderId: string | null;
  pendingAction: "update-status" | "cancel-order" | null;
  sentBlocks: Set<string>;
  sendingBlockId: string | null;
  accountingMap: Map<string, ProductAccountingEntry>;
  onViewRoute: (b: AdminOrderRouteBlock) => void;
  onSend: (b: AdminOrderRouteBlock) => Promise<void>;
  onDraftChange: (id: string, val: string) => void;
  onSaveStatus: (o: AdminOrderRecord) => Promise<void>;
  onOpenCancel: (o: AdminOrderRecord) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(routeBlocks.map((b) => b.id)));

  function toggleBlock(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const COLS = 10; // Estado/Fecha/ID, Cliente, Dir, Productos, Subtotal, Delivery, Total, Pago, Km, Acciones

  return (
    <div className="space-y-4">
      {routeBlocks.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-slate-700 px-8 py-16 text-center text-sm text-slate-500">
          No hay ordenes activas de delivery para construir bloques.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[1.5rem] border border-slate-700 shadow-[0_16px_60px_rgba(0,0,0,0.4)]">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <TH>Estado / Fecha / ID</TH>
                <TH>Cliente</TH>
                <TH>Direccion</TH>
                <TH>Productos</TH>
                <TH right>Subtotal</TH>
                <TH right>Delivery</TH>
                <TH right>Total</TH>
                <TH>Pago</TH>
                <TH right>Km tramo</TH>
                <TH>Acciones</TH>
              </tr>
            </thead>
            <tbody>
              {routeBlocks.map((block) => {
                const isCollapsed = collapsed.has(block.id);
                const isSent = sentBlocks.has(block.id);
                const sending = sendingBlockId === block.id;

                return (
                  <React.Fragment key={block.id}>
                    {/* Block header row */}
                    <tr className="bg-[#0a1428]">
                      <td colSpan={COLS} className="border-b border-t border-slate-600 px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Expand toggle */}
                          <button
                            type="button"
                            onClick={() => toggleBlock(block.id)}
                            className="flex h-6 w-6 items-center justify-center rounded border border-slate-600 bg-[#050816] text-xs text-slate-400 hover:border-cyan-500 hover:text-white"
                          >
                            {isCollapsed ? "+" : "−"}
                          </button>

                          {/* Block label */}
                          <span className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">
                            {block.label}
                          </span>

                          {/* Metrics */}
                          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                            <span><strong className="text-white">{block.stopsCount}</strong> paradas</span>
                            <span><strong className="text-white">{block.packagesCount}</strong> paquetes</span>
                            <span><strong className="text-white">{formatKilometers(block.estimatedTotalKm)}</strong></span>
                            <span><strong className="text-white">{formatTime(block.estimatedTimeMinutes)}</strong></span>
                            <span>Cobro <strong className="text-cyan-300">{formatCurrencySrd(block.totalAmount)}</strong></span>
                            <span>Delivery <strong className="text-emerald-300">{formatCurrencySrd(block.deliveryFees)}</strong></span>
                          </div>

                          {/* Badges */}
                          {block.isPartial && (
                            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                              Parcial
                            </span>
                          )}
                          {isSent && (
                            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                              ✓ Enviado
                            </span>
                          )}

                          {/* Actions */}
                          <div className="ml-auto flex gap-2">
                            <button
                              type="button"
                              onClick={() => onViewRoute(block)}
                              className="rounded border border-slate-600 bg-[#050816] px-3 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-cyan-500 hover:text-white"
                            >
                              Ver ruta
                            </button>
                            <button
                              type="button"
                              disabled={sending || isSent}
                              onClick={() => void onSend(block)}
                              className="rounded border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {sending ? "Enviando..." : isSent ? "Enviado" : "Enviar bloque"}
                            </button>
                          </div>
                        </div>

                      </td>
                    </tr>

                    {/* Stop rows */}
                    {!isCollapsed && block.stops.map((stop, i) => (
                      <OrderRow
                        key={stop.order.id}
                        order={stop.order}
                        rowIndex={i}
                        accountingMap={accountingMap}
                        statusDraft={statusDrafts[stop.order.id] ?? ""}
                        activeOrderId={activeOrderId}
                        pendingAction={pendingAction}
                        stopInfo={stop}
                        onDraftChange={onDraftChange}
                        onSaveStatus={onSaveStatus}
                        onOpenCancel={onOpenCancel}
                      />
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Non-route orders */}
      {nonRouteOrders.length > 0 && (
        <div>
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-400">
            Fuera de ruta activa · {nonRouteOrders.length} ordenes
          </p>
          <div className="overflow-x-auto rounded-[1.5rem] border border-slate-700 shadow-[0_16px_60px_rgba(0,0,0,0.4)]">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <TH>#</TH>
                  <TH>Estado</TH>
                  <TH>Fecha</TH>
                  <TH>ID</TH>
                  <TH>Cliente</TH>
                  <TH>Direccion</TH>
                  <TH>Productos</TH>
                  <TH right>Subtotal</TH>
                  <TH right>Delivery</TH>
                  <TH right>Total</TH>
                  <TH>Pago</TH>
                  <TH>Acciones</TH>
                </tr>
              </thead>
              <tbody>
                {nonRouteOrders.map((order, i) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    rowIndex={i}
                    accountingMap={accountingMap}
                    statusDraft={statusDrafts[order.id] ?? ""}
                    activeOrderId={activeOrderId}
                    pendingAction={pendingAction}
                    onDraftChange={onDraftChange}
                    onSaveStatus={onSaveStatus}
                    onOpenCancel={onOpenCancel}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────
export default function AdminOrdersPage() {
  const [activeTab, setActiveTab] = useState<Tab>("blocks");
  const [orders, setOrders] = useState<AdminOrderRecord[]>([]);
  const [meta, setMeta] = useState<AdminOrdersMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [last4, setLast4] = useState("");
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"update-status" | "cancel-order" | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminOrderRecord | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [activeModalBlock, setActiveModalBlock] = useState<AdminOrderRouteBlock | null>(null);
  const [blockStopOverrides, setBlockStopOverrides] = useState<Record<string, string[]>>({});
  const [sentBlocks, setSentBlocks] = useState<Set<string>>(new Set());
  const [sendingBlockId, setSendingBlockId] = useState<string | null>(null);
  const [accountingMap, setAccountingMap] = useState<Map<string, ProductAccountingEntry>>(new Map());

  const { status, deliveryType } = TAB_PARAMS[activeTab];

  useEffect(() => {
    const fn = () => setRefreshKey((k) => k + 1);
    window.addEventListener("admin-orders-updated", fn);
    return () => window.removeEventListener("admin-orders-updated", fn);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setOrders([]);
    setHasMore(false);
    setNextCursor(null);

    async function load() {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 12_000);
      try {
        const [ordRes, metaRes] = await Promise.all([
          fetch(apiUrl({ status, deliveryType, last4 }), { cache: "no-store", signal: abort.signal }),
          fetch("/api/admin/orders/meta", { cache: "no-store", signal: abort.signal }),
        ]);
        const [ordData, metaData] = await Promise.all([
          ordRes.json() as Promise<AdminOrdersResponse>,
          metaRes.json() as Promise<{ success?: boolean; meta?: AdminOrdersMeta }>,
        ]);
        if (!alive) return;
        if (ordData.success) {
          const next = ordData.orders ?? [];
          setOrders(next);
          setHasMore(Boolean(ordData.hasMore));
          setNextCursor(ordData.nextCursor ?? null);
          setStatusDrafts(Object.fromEntries(next.map((o) => [o.id, getInitialStatus(o)])));

          // Fetch accounting data for all unique product IDs in these orders
          const productIds = Array.from(
            new Set(
              next.flatMap((o) =>
                o.items.map((i) => String(i.productId ?? "")).filter(Boolean)
              )
            )
          );
          if (productIds.length > 0) {
            fetch("/api/admin/products/accounting", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productIds }),
            })
              .then((r) => r.json())
              .then((data: { success?: boolean; entries?: ProductAccountingEntry[] }) => {
                if (!alive || !data.success || !data.entries) return;
                const map = new Map<string, ProductAccountingEntry>();
                for (const entry of data.entries) map.set(entry.productId, entry);
                setAccountingMap(map);
              })
              .catch(() => {/* non-critical */});
          }
        }
        if (metaData.success) setMeta(metaData.meta ?? null);
      } catch (err) {
        if (!alive) return;
        const isTimeout = err instanceof DOMException && err.name === "AbortError";
        setNotice({ tone: "error", message: isTimeout ? "Tiempo de espera agotado. Intenta de nuevo." : "Error al cargar ordenes." });
      } finally {
        clearTimeout(timer);
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, [activeTab, last4, refreshKey, status, deliveryType]);

  async function loadMore() {
    if (!nextCursor || loading || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(apiUrl({ status, deliveryType, last4, cursor: nextCursor }), { cache: "no-store" });
      const data = (await res.json()) as AdminOrdersResponse;
      if (!data.success) return;
      const inc = data.orders ?? [];
      setOrders((c) => mergeOrders(c, inc));
      setHasMore(Boolean(data.hasMore));
      setNextCursor(data.nextCursor ?? null);
      setStatusDrafts((c) => ({ ...c, ...Object.fromEntries(inc.map((o) => [o.id, c[o.id] ?? getInitialStatus(o)])) }));
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleUpdateStatus(order: AdminOrderRecord) {
    const next = statusDrafts[order.id];
    if (!next || next === order.adminStatus) return;
    setActiveOrderId(order.id);
    setPendingAction("update-status");
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-status", status: next }),
      });
      const data = await res.json();
      if (data.success) { setNotice({ tone: "success", message: `Estado actualizado: ${order.idTail}` }); window.dispatchEvent(new Event("admin-orders-updated")); return; }
      setNotice({ tone: "error", message: data.error || "No se pudo actualizar." });
    } finally { setActiveOrderId(null); setPendingAction(null); }
  }

  async function handleCancelOrder(reason: string) {
    if (!cancelTarget) return;
    setActiveOrderId(cancelTarget.id);
    setPendingAction("cancel-order");
    setCancelError("");
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/orders/${cancelTarget.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel-order", reason }),
      });
      const data = await res.json();
      if (data.success) {
        setCancelTarget(null);
        setNotice({ tone: data.warnings?.length ? "warning" : "success", message: `Orden cancelada: ${cancelTarget.idTail}` });
        window.dispatchEvent(new Event("admin-orders-updated"));
        return;
      }
      setCancelError(data.errors?.reason?.[0] || data.error || "No se pudo cancelar.");
    } finally { setActiveOrderId(null); setPendingAction(null); }
  }

  async function handleSendBlock(block: AdminOrderRouteBlock) {
    setSendingBlockId(block.id);
    setNotice(null);
    const ids = block.stops.map((s) => s.order.id);
    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/admin/orders/${id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update-status", status: "Pedido listo para delivery" }),
        }).then((r) => r.json())
      )
    );
    const fails = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value?.success));
    setSendingBlockId(null);
    setSentBlocks((p) => new Set([...p, block.id]));
    setNotice({ tone: fails.length === 0 ? "success" : "warning", message: fails.length === 0 ? `${block.label} enviado — ${ids.length} ordenes listas.` : `${block.label} enviado con ${fails.length} error(es).` });
    window.dispatchEvent(new Event("admin-orders-updated"));
    setActiveModalBlock(null);
  }

  const routePlan = useMemo(
    () => (activeTab === "blocks" ? planAdminOrderRoutes(orders) : null),
    [activeTab, orders]
  );

  const TABS: Array<{ id: Tab; label: string; accent?: string }> = [
    { id: "blocks",    label: "Bloques de ordenes" },
    { id: "orders",    label: "Pedidos" },
    { id: "pickups",   label: "Recogida" },
    { id: "cancelled", label: "Canceladas", accent: "rose" },
    { id: "completed", label: "Completadas", accent: "emerald" },
  ];

  const commonTableProps = {
    statusDrafts, activeOrderId, pendingAction, accountingMap,
    onDraftChange: (id: string, val: string) => setStatusDrafts((c) => ({ ...c, [id]: val })),
    onSaveStatus: handleUpdateStatus,
    onOpenCancel: (o: AdminOrderRecord) => { setCancelError(""); setCancelTarget(o); },
  };

  return (
    <div className="space-y-3">

      {/* ── Header bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-slate-800 bg-[#050816] px-5 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-white">Ordenes</h1>
          {meta?.pendingOrdersCount ? (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
              {meta.pendingOrdersCount} pendientes
            </span>
          ) : null}
          {meta?.totalOrdersCount ? (
            <span className="text-xs text-slate-600">
              {meta.totalOrdersCount} total
            </span>
          ) : null}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-[#0a1020] px-3 py-1.5">
          <svg className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text" value={last4}
            onChange={(e) => setLast4(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="Buscar ID"
            className="w-20 bg-transparent text-xs font-medium text-white outline-none placeholder:text-slate-600"
          />
          {last4 && (
            <button type="button" onClick={() => setLast4("")} className="text-[10px] text-slate-500 hover:text-white">✕</button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          let activeCls = "bg-cyan-500 text-slate-950";
          let hoverCls  = "hover:border-cyan-500 hover:text-white";
          if (tab.accent === "rose") {
            activeCls = "bg-rose-500 text-white";
            hoverCls  = "hover:border-rose-500 hover:text-rose-300";
          } else if (tab.accent === "emerald") {
            activeCls = "bg-emerald-500 text-white";
            hoverCls  = "hover:border-emerald-500 hover:text-emerald-300";
          }
          return (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? activeCls
                  : `border border-slate-700 bg-[#050816] text-slate-400 ${hoverCls}`
              }`}>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Notice ── */}
      {notice && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${noticeClass(notice.tone)}`}>
          {notice.message}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-[#050816] py-16 text-center text-xs uppercase tracking-[0.3em] text-slate-600">
          Cargando...
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#050816] py-16 text-center text-sm text-slate-500">
          No hay ordenes.
        </div>
      ) : activeTab === "blocks" && routePlan ? (
        <BlocksTable
          key={routePlan.routeBlocks.map((block) => block.id).join("|")}
          routeBlocks={routePlan.routeBlocks}
          nonRouteOrders={routePlan.nonRouteOrders}
          sentBlocks={sentBlocks}
          sendingBlockId={sendingBlockId}
          onViewRoute={setActiveModalBlock}
          onSend={handleSendBlock}
          {...commonTableProps}
        />
      ) : (
        <OrdersTable orders={orders} {...commonTableProps} />
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button type="button" onClick={() => void loadMore()} disabled={loadingMore}
            className="rounded-xl border border-slate-700 bg-[#050816] px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-cyan-500 hover:text-white disabled:opacity-50">
            {loadingMore ? "Cargando..." : "Cargar mas"}
          </button>
        </div>
      )}

      {/* Cancel dialog */}
      {cancelTarget && (
        <CancelOrderDialog
          orderId={cancelTarget.id}
          pending={activeOrderId === cancelTarget.id && pendingAction === "cancel-order"}
          errorMessage={cancelError}
          onClose={() => { if (pendingAction === "cancel-order") return; setCancelError(""); setCancelTarget(null); }}
          onSubmit={handleCancelOrder}
        />
      )}

      {/* Route modal */}
      {activeModalBlock && (
        <RouteBlockModal
          block={activeModalBlock}
          savedStopOrder={blockStopOverrides[activeModalBlock.id] ?? null}
          onClose={() => setActiveModalBlock(null)}
          onSave={(blockId, ids) => setBlockStopOverrides((c) => ({ ...c, [blockId]: ids }))}
          onSend={handleSendBlock}
          isSending={sendingBlockId === activeModalBlock.id}
        />
      )}
    </div>
  );
}
