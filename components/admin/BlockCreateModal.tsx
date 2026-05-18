"use client";

import { useEffect, useState } from "react";

import { formatCurrencySrd } from "@/lib/shop/number-format";
import type { AdminOrderRecord } from "@/lib/shop/admin-types";

type Props = {
  availableOrders: AdminOrderRecord[];
  assignedOrderIds: Set<string>;
  onClose: () => void;
  onCreate: (name: string, orderIds: string[]) => Promise<void>;
};

export default function BlockCreateModal({ availableOrders, assignedOrderIds, onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const free = availableOrders.filter((o) => !assignedOrderIds.has(o.id));

  const filtered = free.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.customerName.toLowerCase().includes(q) ||
      o.customerAddress.toLowerCase().includes(q) ||
      o.idTail.toLowerCase().includes(q)
    );
  });

  const selectedOrders = free.filter((o) => selected.has(o.id));
  const subtotal = selectedOrders.reduce((s, o) => s + o.subtotal, 0);
  const delivery = selectedOrders.reduce((s, o) => s + o.deliveryFee, 0);
  const total = selectedOrders.reduce((s, o) => s + o.total, 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!name.trim()) { setError("El nombre del bloque es requerido."); return; }
    if (selected.size === 0) { setError("Selecciona al menos una orden."); return; }
    setError("");
    setSaving(true);
    try {
      await onCreate(name.trim(), Array.from(selected));
    } catch {
      setError("No se pudo crear el bloque.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative flex w-full max-w-3xl flex-col overflow-hidden bg-[#050816] shadow-[0_32px_120px_rgba(0,0,0,0.8)] md:m-4 md:rounded-[2rem]">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Nuevo bloque</p>
            <h2 className="mt-0.5 text-xl font-semibold text-white">Crear bloque de delivery</h2>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-400 hover:border-cyan-500 hover:text-white">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">

          {/* Name field */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Nombre del bloque
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Bloque tarde — zona norte"
              className="w-full rounded-xl border border-slate-700 bg-[#0a1020] px-4 py-2.5 text-sm text-white outline-none transition focus:border-cyan-500 placeholder:text-slate-600"
            />
          </div>

          {/* Order search */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Pedidos disponibles para agregar ({free.length})
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, dirección o ID..."
              className="mb-3 w-full rounded-xl border border-slate-700 bg-[#0a1020] px-4 py-2 text-sm text-white outline-none transition focus:border-cyan-500 placeholder:text-slate-600"
            />

            {free.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-700 py-8 text-center text-sm text-slate-500">
                No hay pedidos de delivery pendientes disponibles.
              </p>
            ) : (
              <div className="space-y-2 rounded-xl border border-slate-800 bg-[#070d1c] p-3">
                {filtered.map((order) => {
                  const isSelected = selected.has(order.id);
                  return (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => toggle(order.id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? "border-cyan-500/50 bg-cyan-500/10"
                          : "border-slate-700 bg-[#0a1020] hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold ${isSelected ? "text-cyan-400" : "text-slate-600"}`}>
                              {isSelected ? "✓" : "○"}
                            </span>
                            <span className="font-semibold text-white text-sm">{order.customerName}</span>
                            <span className="font-mono text-xs text-cyan-400">···{order.idTail}</span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-400">{order.customerAddress}</p>
                          <p className="text-xs text-slate-500">{order.customerPhone}</p>
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
                          }`}>{order.status}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-800 px-6 py-4">
          {/* Summary */}
          {selected.size > 0 && (
            <div className="mb-3 flex flex-wrap gap-4 text-sm text-slate-400">
              <span><strong className="text-white">{selected.size}</strong> ordenes</span>
              <span>Subtotal <strong className="text-white">{formatCurrencySrd(subtotal)}</strong></span>
              <span>Delivery <strong className="text-emerald-300">{formatCurrencySrd(delivery)}</strong></span>
              <span>Total <strong className="text-cyan-300">{formatCurrencySrd(total)}</strong></span>
            </div>
          )}

          {error && (
            <p className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-400 hover:border-slate-600 hover:text-white">
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving || !name.trim() || selected.size === 0}
              onClick={() => void handleSave()}
              className="flex-1 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {saving ? "Creando..." : `Crear bloque (${selected.size} ordenes)`}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
