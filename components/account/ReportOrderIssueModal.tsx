"use client";

import { useState } from "react";

import type { Locale, OrderSummary } from "@/lib/shop/types";

const texts = {
  es: {
    title: "Reportar un problema con el pedido",
    placeholder: "Describe claramente lo ocurrido con el pedido",
    close: "Cerrar",
    send: "Enviar reporte",
    sending: "Enviando...",
  },
  nl: {
    title: "Probleem met bestelling melden",
    placeholder: "Beschrijf duidelijk wat er met de bestelling is gebeurd",
    close: "Sluiten",
    send: "Rapport verzenden",
    sending: "Verzenden...",
  },
  en: {
    title: "Report a problem with the order",
    placeholder: "Describe clearly what happened with the order",
    close: "Close",
    send: "Send report",
    sending: "Sending...",
  },
  pt: {
    title: "Reportar um problema com o pedido",
    placeholder: "Descreva claramente o que aconteceu com o pedido",
    close: "Fechar",
    send: "Enviar relato",
    sending: "Enviando...",
  },
} as const;

interface ReportOrderIssueModalProps {
  locale: Locale;
  order: OrderSummary;
  pending: boolean;
  errorMessage: string;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
}

export default function ReportOrderIssueModal({
  locale,
  order,
  pending,
  errorMessage,
  onClose,
  onSubmit,
}: ReportOrderIssueModalProps) {
  const t = texts[locale];
  const [message, setMessage] = useState("");

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-[#050816] p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-white">{t.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{order.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#0a1020] px-3 py-2 text-sm font-semibold text-slate-300"
          >
            {t.close}
          </button>
        </div>

        <div className="space-y-5">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t.placeholder}
            rows={6}
            className="w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
          />

          {errorMessage ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void onSubmit(message.trim())}
            disabled={pending || message.trim().length < 10}
            className="w-full rounded-2xl bg-cyan-500 py-3 text-sm font-semibold text-slate-950 disabled:bg-slate-700 disabled:text-slate-300"
          >
            {pending ? t.sending : t.send}
          </button>
        </div>
      </div>
    </div>
  );
}
