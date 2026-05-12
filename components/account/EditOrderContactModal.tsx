"use client";

import { useEffect, useState } from "react";

import AddressAutocompleteField from "@/components/AddressAutocompleteField";
import { formatCurrencySrd as formatCurrency, formatKilometers } from "@/lib/shop/number-format";
import type { Locale, OrderSummary } from "@/lib/shop/types";

const texts = {
  es: {
    editAddress: "Modificar direccion",
    editPhone: "Modificar telefono",
    address: "Direccion",
    phone: "Telefono",
    currentDelivery: "Delivery actual",
    updatedDelivery: "Delivery actualizado",
    currentTotal: "Total actual",
    updatedTotal: "Total actualizado",
    calculating: "Calculando la distancia real del delivery...",
    reviewNeeded:
      "Su direccion no se pudo calcular con exito. Antes del envio un agente se pondra en contacto con usted.",
    close: "Cerrar",
    save: "Guardar cambios",
    saving: "Guardando...",
  },
  nl: {
    editAddress: "Adres wijzigen",
    editPhone: "Telefoon wijzigen",
    address: "Adres",
    phone: "Telefoon",
    currentDelivery: "Huidige levering",
    updatedDelivery: "Bijgewerkte levering",
    currentTotal: "Huidig totaal",
    updatedTotal: "Bijgewerkt totaal",
    calculating: "De echte leveringsafstand wordt berekend...",
    reviewNeeded:
      "Uw adres kon niet exact worden berekend. Voor de levering neemt een agent eerst contact met u op.",
    close: "Sluiten",
    save: "Wijzigingen opslaan",
    saving: "Opslaan...",
  },
  en: {
    editAddress: "Edit address",
    editPhone: "Edit phone",
    address: "Address",
    phone: "Phone",
    currentDelivery: "Current delivery",
    updatedDelivery: "Updated delivery",
    currentTotal: "Current total",
    updatedTotal: "Updated total",
    calculating: "Calculating the real delivery distance...",
    reviewNeeded:
      "Your address could not be calculated exactly. An agent will contact you before delivery.",
    close: "Close",
    save: "Save changes",
    saving: "Saving...",
  },
  pt: {
    editAddress: "Modificar endereco",
    editPhone: "Modificar telefone",
    address: "Endereco",
    phone: "Telefone",
    currentDelivery: "Entrega atual",
    updatedDelivery: "Entrega atualizada",
    currentTotal: "Total atual",
    updatedTotal: "Total atualizado",
    calculating: "Calculando a distancia real da entrega...",
    reviewNeeded:
      "Nao foi possivel calcular seu endereco com exatidao. Um agente entrara em contato antes da entrega.",
    close: "Fechar",
    save: "Salvar alteracoes",
    saving: "Salvando...",
  },
} as const;

type DeliveryQuoteResponse = {
  distanceKm: number;
  fee: number;
  allowsDelivery: boolean;
  isValidSurinameAddress: boolean;
  requiresAgentReview: boolean;
};

interface EditOrderContactModalProps {
  locale: Locale;
  order: OrderSummary;
  mode: "address" | "phone";
  pending: boolean;
  errorMessage: string;
  onClose: () => void;
  onSubmit: (payload: { address?: string; phone?: string }) => Promise<void>;
}

export default function EditOrderContactModal({
  locale,
  order,
  mode,
  pending,
  errorMessage,
  onClose,
  onSubmit,
}: EditOrderContactModalProps) {
  const t = texts[locale];
  const [address, setAddress] = useState(order.customerAddress);
  const [phone, setPhone] = useState(order.customerPhone);
  const [isResolvingDeliveryQuote, setIsResolvingDeliveryQuote] = useState(false);
  const [serverDeliveryQuote, setServerDeliveryQuote] = useState<DeliveryQuoteResponse | null>(
    null
  );

  const nextAddress = mode === "address" ? address.trim() : order.customerAddress;
  const nextPhone = mode === "phone" ? phone.trim() : order.customerPhone;
  const nextDeliveryQuote = serverDeliveryQuote ?? {
    distanceKm: order.deliveryDistanceKm ?? 0,
    fee: order.deliveryFee,
    allowsDelivery: true,
    isValidSurinameAddress: true,
    requiresAgentReview: false,
  };
  const nextDeliveryFee = order.deliveryType === "delivery" ? nextDeliveryQuote.fee : order.deliveryFee;
  const nextTotal =
    order.deliveryType === "delivery" ? order.subtotal + nextDeliveryFee : order.total;
  const hasChanges =
    nextAddress !== order.customerAddress || nextPhone !== order.customerPhone;

  useEffect(() => {
    if (order.deliveryType !== "delivery" || nextAddress.length < 5) {
      setServerDeliveryQuote(null);
      setIsResolvingDeliveryQuote(false);
      return;
    }

    setServerDeliveryQuote(null);
    setIsResolvingDeliveryQuote(true);

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/delivery-quote?address=${encodeURIComponent(nextAddress)}&locale=${locale}&subtotal=${order.subtotal}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Delivery quote request failed with ${response.status}`);
        }

        const payload = (await response.json()) as DeliveryQuoteResponse;
        setServerDeliveryQuote(payload);
      } catch {
        setServerDeliveryQuote(null);
      } finally {
        setIsResolvingDeliveryQuote(false);
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [locale, nextAddress, order.deliveryType, order.subtotal]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-[#050816] p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-white">
              {mode === "address" ? t.editAddress : t.editPhone}
            </h3>
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
          {mode === "address" ? (
            <AddressAutocompleteField
              value={address}
              onChange={setAddress}
              placeholder={t.address}
              locale={locale}
              className="w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
            />
          ) : (
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder={t.phone}
              className="w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
            />
          )}

          <div className="space-y-3 rounded-2xl border border-slate-800 bg-[#0a1020] p-4">
            <div className="flex justify-between gap-4 text-sm text-slate-300">
              <span>{t.currentDelivery}</span>
              <span>{formatCurrency(order.deliveryFee)}</span>
            </div>
            <div className="flex justify-between gap-4 text-sm text-slate-300">
              <span>{t.updatedDelivery}</span>
              <span>
                {formatCurrency(nextDeliveryFee)}
                {order.deliveryType === "delivery" &&
                !isResolvingDeliveryQuote &&
                !nextDeliveryQuote.requiresAgentReview ? (
                  nextDeliveryQuote.distanceKm > 0 ? (
                    <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {formatKilometers(nextDeliveryQuote.distanceKm)}
                    </span>
                  ) : null
                ) : null}
              </span>
            </div>
            <div className="flex justify-between gap-4 text-sm text-slate-300">
              <span>{t.currentTotal}</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
            <div className="flex justify-between gap-4 text-base font-semibold text-white">
              <span>{t.updatedTotal}</span>
              <span>{formatCurrency(nextTotal)}</span>
            </div>
          </div>

          {order.deliveryType === "delivery" && isResolvingDeliveryQuote ? (
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
              {t.calculating}
            </div>
          ) : null}

          {order.deliveryType === "delivery" && nextDeliveryQuote.requiresAgentReview ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {t.reviewNeeded}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() =>
              void onSubmit({
                address: mode === "address" ? nextAddress : undefined,
                phone: mode === "phone" ? nextPhone : undefined,
              })
            }
            disabled={pending || !hasChanges}
            className="w-full rounded-2xl bg-cyan-500 py-3 text-sm font-semibold text-slate-950 disabled:bg-slate-700 disabled:text-slate-300"
          >
            {pending ? t.saving : t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
