"use client";

import { useState } from "react";

const REASON_OPTIONS = [
  { value: "inventory", label: "Sin stock disponible" },
  { value: "address", label: "Direccion fuera de cobertura" },
  { value: "contact", label: "No fue posible confirmar el pedido" },
  { value: "operations", label: "Incidencia operativa interna" },
  { value: "payment", label: "Problema con la validacion del pedido" },
  { value: "other", label: "Otro motivo" },
] as const;

function buildReason(reasonKey: string, details: string) {
  const option = REASON_OPTIONS.find((item) => item.value === reasonKey);
  const normalizedDetails = details.trim().replace(/\s+/g, " ");

  if (!option) {
    return "";
  }

  if (reasonKey === "other") {
    return normalizedDetails;
  }

  return normalizedDetails ? `${option.label}. ${normalizedDetails}` : option.label;
}

interface CancelOrderDialogProps {
  orderId: string;
  pending: boolean;
  errorMessage: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}

export default function CancelOrderDialog({
  orderId,
  pending,
  errorMessage,
  onClose,
  onSubmit,
}: CancelOrderDialogProps) {
  const [reasonKey, setReasonKey] = useState<(typeof REASON_OPTIONS)[number]["value"]>("inventory");
  const [details, setDetails] = useState("");

  const resolvedReason = buildReason(reasonKey, details);
  const requiresDetails = reasonKey === "other";
  const isDisabled = pending || !resolvedReason || (requiresDetails && resolvedReason.length < 5);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-rose-500">Cancelar orden</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              {orderId}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Motivo</label>
            <select
              value={reasonKey}
              onChange={(event) =>
                setReasonKey(event.target.value as (typeof REASON_OPTIONS)[number]["value"])
              }
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-400"
            >
              {REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              {requiresDetails ? "Detalle del motivo" : "Detalle adicional"}
            </label>
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={4}
              placeholder={
                requiresDetails
                  ? "Escriba el motivo de cancelacion"
                  : "Opcional"
              }
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-400"
            />
          </div>

          {errorMessage ? (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={() => void onSubmit(resolvedReason)}
            disabled={isDisabled}
            className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-rose-200"
          >
            {pending ? "Cancelando..." : "Confirmar cancelacion"}
          </button>
        </div>
      </div>
    </div>
  );
}
