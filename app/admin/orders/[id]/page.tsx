"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import CancelOrderDialog from "@/components/admin/CancelOrderDialog";
import { formatCurrencyDollar } from "@/lib/shop/number-format";
import { ADMIN_ORDER_STATUS_OPTIONS } from "@/lib/shop/order-status";
import type { AdminOrderRecord } from "@/lib/shop/admin-types";

type Notice = {
  tone: "success" | "warning" | "error";
  message: string;
};

function getNoticeClasses(tone: Notice["tone"]) {
  if (tone === "success") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-100";
  }

  if (tone === "warning") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-100";
  }

  return "border-rose-500/20 bg-rose-500/10 text-rose-100";
}

function formatPickupSchedule(pickupDate: string | null, pickupTime: string | null) {
  if (!pickupDate && !pickupTime) {
    return "Recogida programada";
  }

  const hasValidDate = pickupDate && !Number.isNaN(new Date(pickupDate).getTime());
  const formattedDate = hasValidDate
    ? new Date(pickupDate).toLocaleDateString("es", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : pickupDate;

  if (formattedDate && pickupTime) {
    return `Recogida programada para ${formattedDate} a las ${pickupTime}`;
  }

  if (formattedDate) {
    return `Recogida programada para ${formattedDate}`;
  }

  return `Recogida programada a las ${pickupTime}`;
}

export default function AdminOrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [order, setOrder] = useState<AdminOrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelSaving, setCancelSaving] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const isPickupOrder = order?.deliveryType === "pickup";
  const pickupScheduleText = order
    ? formatPickupSchedule(order.pickupDate, order.pickupTime)
    : "Recogida programada";

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    let isActive = true;

    async function loadOrder() {
      setLoading(true);

      try {
        const response = await fetch(`/api/admin/orders/${orderId}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (!isActive) {
          return;
        }

        if (data.success && data.order) {
          setOrder(data.order);
          setSelectedStatus(data.order.adminStatus ?? "");

          if (data.order.isNew) {
            const reviewResponse = await fetch(`/api/admin/orders/${orderId}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                action: "mark-reviewed",
              }),
            });
            const reviewData = await reviewResponse.json();

            if (!isActive) {
              return;
            }

            if (reviewData.success && reviewData.order) {
              setOrder(reviewData.order);
              setSelectedStatus(reviewData.order.adminStatus ?? "");
              window.dispatchEvent(new Event("admin-orders-updated"));
            }
          }
        } else {
          setOrder(null);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadOrder();

    return () => {
      isActive = false;
    };
  }, [orderId, refreshKey]);

  async function handleSaveStatus() {
    if (!order || !selectedStatus || selectedStatus === order.adminStatus) {
      return;
    }

    setSavingStatus(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update-status",
          status: selectedStatus,
        }),
      });
      const data = await response.json();

      if (data.success && data.order) {
        setOrder(data.order);
        setSelectedStatus(data.order.adminStatus ?? "");
        setNotice({
          tone: "success",
          message: `Estado actualizado para ${data.order.id}.`,
        });
        window.dispatchEvent(new Event("admin-orders-updated"));
        return;
      }

      setNotice({
        tone: "error",
        message: data.error || "No se pudo actualizar la orden.",
      });
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleCancelOrder(reason: string) {
    if (!order) {
      return;
    }

    setCancelSaving(true);
    setCancelError("");
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "cancel-order",
          reason,
        }),
      });
      const data = await response.json();

      if (data.success && data.order) {
        setOrder(data.order);
        setSelectedStatus(data.order.adminStatus ?? "");
        setCancelOpen(false);
        setCancelError("");
        setNotice({
          tone: data.warnings?.length ? "warning" : "success",
          message: data.warnings?.length
            ? `Orden cancelada. ${data.warnings.join(" ")}`
            : `Orden cancelada correctamente: ${data.order.id}.`,
        });
        window.dispatchEvent(new Event("admin-orders-updated"));
        setRefreshKey((currentKey) => currentKey + 1);
        return;
      }

      setCancelError(
        data.errors?.reason?.[0] || data.error || "No se pudo cancelar la orden."
      );
    } finally {
      setCancelSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-500"></div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Cargando orden</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="rounded-[2rem] border border-slate-800 bg-[#050816] p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <p className="text-lg font-medium text-white">No se encontro la orden.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2.5rem] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_38%),linear-gradient(180deg,_#050816_0%,_#03050f_100%)] p-8 shadow-[0_24px_90px_rgba(0,0,0,0.4)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Detalle de orden</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">{order.id}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">Estado actual: {order.status}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-2xl border border-slate-700 bg-[#0a1020] px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-cyan-500 hover:text-white"
            >
              Volver
            </button>
            {!order.isCancelled ? (
              <button
                type="button"
                onClick={() => {
                  setCancelError("");
                  setCancelOpen(true);
                }}
                className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-500"
              >
                Cancelar orden
              </button>
            ) : null}
            {order.userId ? (
              <Link
                href={`/admin/users/${order.userId}`}
                className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                Abrir perfil del usuario
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {notice ? (
        <div className={`rounded-[1.5rem] border px-5 py-4 text-sm ${getNoticeClasses(notice.tone)}`}>
          {notice.message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
        <section className="space-y-6">
          <div className="rounded-[2rem] border border-slate-800 bg-[#050816] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Cliente</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Nombre</p>
                <p className="mt-2 text-base font-semibold text-white">{order.customerName}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Correo</p>
                <p className="mt-2 text-base font-semibold text-white">{order.customerEmail}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Telefono</p>
                <p className="mt-2 text-base font-semibold text-white">{order.customerPhone}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">
                  {isPickupOrder ? "Recogida programada" : "Direccion"}
                </p>
                <p className="mt-2 text-base font-semibold text-white">
                  {isPickupOrder ? pickupScheduleText : order.customerAddress}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-[#050816] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Productos comprados</p>
            <div className="mt-5 space-y-4">
              {order.items.map((item, index) => (
                <div
                  key={`${order.id}-${item.name}-${index}`}
                  id={`item-${index}`}
                  className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <Link
                        href={item.href}
                        className="text-base font-semibold text-white hover:text-cyan-300"
                      >
                        {item.name}
                      </Link>
                      <p className="mt-2 text-sm text-slate-500">Cantidad: {item.quantity}</p>
                    </div>
                    <p className="text-lg font-semibold text-white">
                      {formatCurrencyDollar(item.price * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-slate-800 bg-[#050816] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Estado manual</p>
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              disabled={order.isCancelled}
              className="mt-5 w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-500"
            >
              <option value="">Estado automatico</option>
              {ADMIN_ORDER_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleSaveStatus()}
              disabled={
                savingStatus ||
                !selectedStatus ||
                selectedStatus === order.adminStatus ||
                order.isCancelled
              }
              className="mt-4 w-full rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
            >
              {savingStatus ? "Guardando..." : "Actualizar estado"}
            </button>
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-[#050816] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Resumen</p>
            <div className="mt-5 space-y-4 text-sm text-slate-300">
              <p>
                <strong className="text-white">Total:</strong> {formatCurrencyDollar(order.total)}
              </p>
              <p>
                <strong className="text-white">Subtotal:</strong> {formatCurrencyDollar(order.subtotal)}
              </p>
              <p>
                <strong className="text-white">Delivery:</strong> {formatCurrencyDollar(order.deliveryFee)}
              </p>
              <p>
                <strong className="text-white">Tipo:</strong> {order.deliveryType}
              </p>
              <p>
                <strong className="text-white">Fecha:</strong> {new Date(order.createdAt).toLocaleString()}
              </p>
              <p>
                <strong className="text-white">Revisada:</strong> {order.adminReviewedAt ? "Si" : "No"}
              </p>
              {order.cancellationReason ? (
                <p>
                  <strong className="text-white">Motivo de cancelacion:</strong>{" "}
                  {order.cancellationReason}
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-[#050816] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Historial de estado</p>
            <div className="mt-5 space-y-4">
              {order.statusHistory.length === 0 ? (
                <p className="text-sm text-slate-500">Aun no hay cambios manuales de estado.</p>
              ) : (
                order.statusHistory
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <div key={entry.id} className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-4">
                      <p className="text-sm font-semibold text-white">{entry.status}</p>
                      <p className="mt-2 text-sm text-slate-400">{entry.changedByName}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {new Date(entry.changedAt).toLocaleString()}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </div>
        </aside>
      </div>

      {cancelOpen ? (
        <CancelOrderDialog
          orderId={order.id}
          pending={cancelSaving}
          errorMessage={cancelError}
          onClose={() => {
            if (cancelSaving) {
              return;
            }

            setCancelError("");
            setCancelOpen(false);
          }}
          onSubmit={handleCancelOrder}
        />
      ) : null}
    </div>
  );
}
