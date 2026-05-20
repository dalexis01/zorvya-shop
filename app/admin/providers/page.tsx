"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  SupplierListEntry,
  SupplierProfile,
} from "@/lib/shop/admin-types";
import { formatCurrencyDollar } from "@/lib/shop/number-format";

function toDateInputValue(value?: string | null) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<SupplierListEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<SupplierProfile | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    contactName: "",
    phone: "",
    email: "",
    notes: "",
    isActive: true,
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentDate: toDateInputValue(),
    blockId: "",
    notes: "",
  });

  useEffect(() => {
    async function loadProviders() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/admin/providers?search=${encodeURIComponent(search)}`,
          { cache: "no-store" }
        );
        const data = await response.json();

        if (!data.success) {
          setError(data.error || "No se pudieron cargar los proveedores");
          return;
        }

        const nextProviders = (data.providers ?? []) as SupplierListEntry[];
        setProviders(nextProviders);

        if (!selectedId && nextProviders[0]?.id) {
          setSelectedId(nextProviders[0].id);
          return;
        }

        if (selectedId && !nextProviders.some((provider) => provider.id === selectedId)) {
          setSelectedId(nextProviders[0]?.id ?? "");
        }
      } catch {
        setError("No se pudieron cargar los proveedores");
      } finally {
        setLoading(false);
      }
    }

    void loadProviders();
  }, [search, selectedId]);

  useEffect(() => {
    async function loadProviderDetail() {
      if (!selectedId) {
        setSelectedProvider(null);
        return;
      }

      try {
        const response = await fetch(`/api/admin/providers/${selectedId}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (!data.success || !data.provider) {
          setError(data.error || "No se pudo cargar el proveedor");
          return;
        }

        const provider = data.provider as SupplierProfile;
        setSelectedProvider(provider);
        setForm({
          name: provider.name,
          contactName: provider.contactName,
          phone: provider.phone,
          email: provider.email,
          notes: provider.notes,
          isActive: provider.isActive,
        });
      } catch {
        setError("No se pudo cargar el proveedor");
      }
    }

    void loadProviderDetail();
  }, [selectedId]);

  const selectedSummary = selectedProvider?.summary;
  const blocks = useMemo(() => selectedProvider?.blockBalances ?? [], [selectedProvider]);

  async function refreshCurrentProvider(id: string) {
    const response = await fetch(`/api/admin/providers/${id}`, { cache: "no-store" });
    const data = await response.json();

    if (data.success && data.provider) {
      setSelectedProvider(data.provider);
    }

    const listResponse = await fetch(`/api/admin/providers?search=${encodeURIComponent(search)}`, {
      cache: "no-store",
    });
    const listData = await listResponse.json();

    if (listData.success) {
      setProviders(listData.providers ?? []);
    }
  }

  async function handleCreateProvider() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/admin/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Nuevo proveedor",
          contactName: "",
          phone: "",
          email: "",
          notes: "",
          isActive: true,
        }),
      });
      const data = await response.json();

      if (!data.success || !data.provider) {
        setError(data.error || "No se pudo crear el proveedor");
        return;
      }

      setSelectedId(data.provider.id);
      await refreshCurrentProvider(data.provider.id);
    } catch {
      setError("No se pudo crear el proveedor");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProvider() {
    if (!selectedId) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/providers/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!data.success) {
        setError(data.error || "No se pudo guardar el proveedor");
        return;
      }

      await refreshCurrentProvider(selectedId);
    } catch {
      setError("No se pudo guardar el proveedor");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddPayment() {
    if (!selectedId) {
      return;
    }

    setSavingPayment(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/providers/${selectedId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(paymentForm.amount),
          paymentDate: paymentForm.paymentDate,
          blockId: paymentForm.blockId || null,
          notes: paymentForm.notes,
        }),
      });
      const data = await response.json();

      if (!data.success) {
        setError(data.error || "No se pudo registrar el pago");
        return;
      }

      setPaymentForm({
        amount: "",
        paymentDate: toDateInputValue(),
        blockId: "",
        notes: "",
      });
      await refreshCurrentProvider(selectedId);
    } catch {
      setError("No se pudo registrar el pago");
    } finally {
      setSavingPayment(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-slate-800 bg-[#050816] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar proveedor"
            className="w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400 md:max-w-sm"
          />
          <button
            type="button"
            onClick={() => void handleCreateProvider()}
            disabled={saving}
            className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Creando..." : "Nuevo proveedor"}
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
        <section className="overflow-hidden rounded-[1.6rem] border border-slate-800 bg-[#050816] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          {loading ? (
            <div className="px-6 py-14 text-center text-sm uppercase tracking-[0.25em] text-slate-500">
              Cargando proveedores
            </div>
          ) : providers.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-slate-400">
              No hay proveedores registrados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-slate-800 bg-[#090e1b]">
                  <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3">Contacto</th>
                    <th className="px-4 py-3">Dia</th>
                    <th className="px-4 py-3">Semana</th>
                    <th className="px-4 py-3">Bloques</th>
                    <th className="px-4 py-3">Pendiente</th>
                    <th className="px-4 py-3">Pagado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {providers.map((provider) => (
                    <tr
                      key={provider.id}
                      onClick={() => setSelectedId(provider.id)}
                      className={`cursor-pointer transition ${
                        selectedId === provider.id ? "bg-cyan-500/10" : "hover:bg-slate-900/50"
                      }`}
                    >
                      <td className="px-4 py-3 text-sm text-white">
                        <p className="font-semibold">{provider.name}</p>
                        <p className="text-xs text-slate-500">{provider.id.slice(0, 8)}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        <p>{provider.contactName || "—"}</p>
                        <p className="text-xs text-slate-500">{provider.phone || provider.email || "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-white">
                        {formatCurrencyDollar(provider.summary.dayAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-white">
                        {formatCurrencyDollar(provider.summary.weekAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-cyan-100">
                        {provider.summary.blockCount}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-amber-200">
                        {formatCurrencyDollar(provider.summary.totalPending)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-200">
                        {formatCurrencyDollar(provider.summary.totalPaid)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="rounded-[1.6rem] border border-slate-800 bg-[#050816] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Proveedor"
                className="rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
              />
              <input
                type="text"
                value={form.contactName}
                onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
                placeholder="Contacto"
                className="rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
              />
              <input
                type="text"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="Telefono"
                className="rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
              />
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="Correo"
                className="rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
              />
            </div>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Notas privadas"
              rows={4}
              className="mt-3 w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-600 bg-[#0a1020] text-cyan-400"
                />
                Activo
              </label>
              <button
                type="button"
                onClick={() => void handleSaveProvider()}
                disabled={!selectedId || saving}
                className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-[1.3rem] border border-slate-800 bg-[#050816] p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Dia</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {formatCurrencyDollar(selectedSummary?.dayAmount ?? 0)}
              </p>
            </div>
            <div className="rounded-[1.3rem] border border-slate-800 bg-[#050816] p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Semana</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {formatCurrencyDollar(selectedSummary?.weekAmount ?? 0)}
              </p>
            </div>
            <div className="rounded-[1.3rem] border border-slate-800 bg-[#050816] p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Por bloques</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {formatCurrencyDollar(selectedSummary?.totalByBlocks ?? 0)}
              </p>
            </div>
            <div className="rounded-[1.3rem] border border-slate-800 bg-[#050816] p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Pendiente</p>
              <p className="mt-2 text-lg font-semibold text-amber-200">
                {formatCurrencyDollar(selectedSummary?.totalPending ?? 0)}
              </p>
            </div>
            <div className="rounded-[1.3rem] border border-slate-800 bg-[#050816] p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Pagado</p>
              <p className="mt-2 text-lg font-semibold text-emerald-200">
                {formatCurrencyDollar(selectedSummary?.totalPaid ?? 0)}
              </p>
            </div>
            <div className="rounded-[1.3rem] border border-slate-800 bg-[#050816] p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Total</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {formatCurrencyDollar(selectedSummary?.totalAccrued ?? 0)}
              </p>
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-slate-800 bg-[#050816] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="grid gap-3 md:grid-cols-[0.9fr_0.7fr_0.7fr_1fr_auto]">
              <input
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.amount}
                onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))}
                placeholder="Monto"
                className="rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
              />
              <input
                type="date"
                value={paymentForm.paymentDate}
                onChange={(event) => setPaymentForm((current) => ({ ...current, paymentDate: event.target.value }))}
                className="rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
              />
              <input
                type="text"
                value={paymentForm.blockId}
                onChange={(event) => setPaymentForm((current) => ({ ...current, blockId: event.target.value }))}
                placeholder="Bloque"
                className="rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
              />
              <input
                type="text"
                value={paymentForm.notes}
                onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Nota"
                className="rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={() => void handleAddPayment()}
                disabled={!selectedId || savingPayment}
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {savingPayment ? "Guardando..." : "Registrar pago"}
              </button>
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-slate-800 bg-[#050816] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-slate-800 bg-[#090e1b]">
                  <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    <th className="px-4 py-3">Bloque</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Pedidos</th>
                    <th className="px-4 py-3">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {blocks.length > 0 ? (
                    blocks.map((block) => (
                      <tr key={block.blockId}>
                        <td className="px-4 py-3 text-sm font-semibold text-white">{block.blockName}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">{block.blockStatus}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">{block.ordersCount}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-white">
                          {formatCurrencyDollar(block.amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                        Sin bloques asociados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-slate-800 bg-[#050816] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-slate-800 bg-[#090e1b]">
                  <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Monto</th>
                    <th className="px-4 py-3">Bloque</th>
                    <th className="px-4 py-3">Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {selectedProvider?.payments.length ? (
                    selectedProvider.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {new Date(payment.paymentDate).toLocaleDateString("es-ES")}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-emerald-200">
                          {formatCurrencyDollar(payment.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">{payment.blockId || "—"}</td>
                        <td className="px-4 py-3 text-sm text-slate-400">{payment.notes || "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                        Sin pagos registrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
