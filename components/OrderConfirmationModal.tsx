"use client";

import { useState } from "react";

import PayPalCheckoutButton from "@/components/PayPalCheckoutButton";
import { formatPickupLabel, PICKUP_ADDRESS } from "@/lib/shop/checkout";
import {
  formatCurrencySrd as formatCurrency,
  formatCurrencyUsd as formatUsd,
  formatKilometers,
} from "@/lib/shop/number-format";
import type { CheckoutCustomerData, Locale, StorefrontProduct } from "@/lib/shop/types";

type CartEntry = {
  cartKey: string;
  product: StorefrontProduct;
  quantity: number;
  selectedVariantName?: string;
  selectedColor?: string;
  unitPrice?: number;
};

const texts = {
  es: {
    orderSummary: "Resumen final del pedido",
    confirmOrder: "Confirmar pedido",
    back: "Atras",
    subtotal: "Subtotal",
    deliveryFee: "Delivery",
    freeDelivery: "Gratis",
    total: "Total final",
    delivery: "Delivery",
    pickup: "Recogida programada",
    pickupDate: "Fecha y hora de recogida",
    pickupAddress: "Direccion de recogida",
    name: "Nombre",
    phone: "Telefono",
    email: "Correo",
    address: "Direccion",
    requestedAgentCall: "Solicito hablar con un agente",
    agentNote: "Un agente se pondra en contacto con usted para confirmar la orden.",
    products: "Articulos",
    customerInfo: "Datos del cliente",
    deliveryInfo: "Entrega",
    loading: "Confirmando...",
    close: "Cerrar",
    yes: "Si",
    no: "No",
    paymentMethod: "Pago",
    paymentFee: "Fee PayPal",
    paymentCash: "Pago al confirmar",
    paymentPaypal: "PayPal online",
    paymentUsdEquivalent: "Total en PayPal",
  },
  nl: {
    orderSummary: "Definitief besteloverzicht",
    confirmOrder: "Bestelling bevestigen",
    back: "Terug",
    subtotal: "Subtotaal",
    deliveryFee: "Levering",
    freeDelivery: "Gratis",
    total: "Eindtotaal",
    delivery: "Levering",
    pickup: "Geplande afhaling",
    pickupDate: "Afhaaldatum en tijd",
    pickupAddress: "Afhaaladres",
    name: "Naam",
    phone: "Telefoon",
    email: "E-mail",
    address: "Adres",
    requestedAgentCall: "Agent aangevraagd",
    agentNote: "Een agent neemt contact met u op om de bestelling te bevestigen.",
    products: "Artikelen",
    customerInfo: "Klantgegevens",
    deliveryInfo: "Levering",
    loading: "Bevestigen...",
    close: "Sluiten",
    yes: "Ja",
    no: "Nee",
    paymentMethod: "Betaling",
    paymentFee: "PayPal-fee",
    paymentCash: "Betalen bij bevestiging",
    paymentPaypal: "PayPal online",
    paymentUsdEquivalent: "Totaal in PayPal",
  },
  en: {
    orderSummary: "Final order summary",
    confirmOrder: "Confirm order",
    back: "Back",
    subtotal: "Subtotal",
    deliveryFee: "Delivery",
    freeDelivery: "Free",
    total: "Final total",
    delivery: "Delivery",
    pickup: "Scheduled pickup",
    pickupDate: "Pickup date and time",
    pickupAddress: "Pickup address",
    name: "Name",
    phone: "Phone",
    email: "Email",
    address: "Address",
    requestedAgentCall: "Requested agent call",
    agentNote: "An agent will contact you to confirm the order.",
    products: "Items",
    customerInfo: "Customer details",
    deliveryInfo: "Delivery",
    loading: "Confirming...",
    close: "Close",
    yes: "Yes",
    no: "No",
    paymentMethod: "Payment",
    paymentFee: "PayPal fee",
    paymentCash: "Pay on confirmation",
    paymentPaypal: "PayPal online",
    paymentUsdEquivalent: "Total in PayPal",
  },
  pt: {
    orderSummary: "Resumo final do pedido",
    confirmOrder: "Confirmar pedido",
    back: "Voltar",
    subtotal: "Subtotal",
    deliveryFee: "Entrega",
    freeDelivery: "Gratis",
    total: "Total final",
    delivery: "Entrega",
    pickup: "Retirada programada",
    pickupDate: "Data e hora da retirada",
    pickupAddress: "Endereco de retirada",
    name: "Nome",
    phone: "Telefone",
    email: "E-mail",
    address: "Endereco",
    requestedAgentCall: "Solicitou contato com agente",
    agentNote: "Um agente entrara em contato para confirmar o pedido.",
    products: "Artigos",
    customerInfo: "Dados do cliente",
    deliveryInfo: "Entrega",
    loading: "Confirmando...",
    close: "Fechar",
    yes: "Sim",
    no: "Nao",
    paymentMethod: "Pagamento",
    paymentFee: "Taxa PayPal",
    paymentCash: "Pagar na confirmacao",
    paymentPaypal: "PayPal online",
    paymentUsdEquivalent: "Total no PayPal",
  },
} as const;

function formatSelectedPaymentValue(input: {
  amountSrd: number;
  paymentMethod: CheckoutCustomerData["paymentMethod"];
  displayCurrency?: CheckoutCustomerData["paypalDisplayCurrency"];
  exchangeRate?: number | null;
}) {
  if (input.paymentMethod === "paypal" && input.displayCurrency === "USD") {
    const rate = input.exchangeRate ?? 38;
    return formatUsd(input.amountSrd / rate);
  }

  return formatCurrency(input.amountSrd);
}

interface OrderConfirmationModalProps {
  locale: Locale;
  cart: CartEntry[];
  customerData: CheckoutCustomerData;
  subtotal: number;
  deliveryFee: number;
  deliveryDistanceKm?: number;
  total: number;
  paypalClientId: string | null;
  onClose: () => void;
  onBack: () => void;
  onConfirm: () => Promise<void>;
  onCreatePayPalOrder: () => Promise<string>;
  onApprovePayPalOrder: (paypalOrderId: string) => Promise<boolean>;
  onPayPalError: (message: string) => void;
}

export default function OrderConfirmationModal({
  locale,
  cart,
  customerData,
  subtotal,
  deliveryFee,
  deliveryDistanceKm,
  total,
  paypalClientId,
  onClose,
  onBack,
  onConfirm,
  onCreatePayPalOrder,
  onApprovePayPalOrder,
  onPayPalError,
}: OrderConfirmationModalProps) {
  const t = texts[locale];
  const [loading, setLoading] = useState(false);
  const isPayPalCheckout = customerData.paymentMethod === "paypal";
  const receiptSectionClass = isPayPalCheckout
    ? "rounded-[1.45rem] border border-slate-700 bg-[#0a1020] p-5"
    : "rounded-[1.75rem] border border-slate-800 bg-[#0a1020] p-5";
  const compactDeliverySectionClass = isPayPalCheckout
    ? "rounded-[1.3rem] border border-slate-700 bg-[#0a1020] p-4"
    : receiptSectionClass;
  const receiptHeadingClass = isPayPalCheckout
    ? "text-[12px] font-bold uppercase tracking-[0.18em] text-slate-300"
    : "text-sm font-semibold uppercase tracking-[0.25em] text-slate-400";
  const receiptStackClass = isPayPalCheckout ? "space-y-4" : "space-y-6";
  const displayedTotalSrd =
    customerData.paymentMethod === "paypal" ? customerData.paymentGrandTotalSrd ?? total : total;

  async function handleConfirm() {
    setLoading(true);

    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  const productReceiptSection = (
    <section className={receiptSectionClass}>
      <h3 className={receiptHeadingClass}>
        {t.products}
      </h3>
      <div
        className={`${
          isPayPalCheckout
            ? "scrollbar-hidden mt-3 max-h-32 space-y-2.5 overflow-y-auto pr-1"
            : "mt-4 space-y-3"
        }`}
      >
        {cart.map((entry) => (
          <div
            key={entry.cartKey}
            className={`flex items-center justify-between gap-3 ${
              isPayPalCheckout ? "text-[13px] leading-5 text-slate-200" : "text-sm text-slate-300"
            }`}
          >
            <span className={isPayPalCheckout ? "line-clamp-2 pr-2 leading-5" : ""}>
              {entry.quantity}x {entry.product.name}
              {entry.selectedVariantName || entry.selectedColor
                ? ` (${[entry.selectedVariantName, entry.selectedColor].filter(Boolean).join(" / ")})`
                : ""}
            </span>
            <span className="font-semibold text-white">
              {formatCurrency((entry.unitPrice ?? entry.product.price) * entry.quantity)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );

  const paymentReceiptSection = (
    <section className={receiptSectionClass}>
      <div className={`${isPayPalCheckout ? "space-y-3 text-[13px] leading-5 text-slate-200" : "space-y-3 text-sm text-slate-300"}`}>
        <div className="flex items-center justify-between">
          <span>{t.subtotal}</span>
          <span className="font-semibold text-white">
            {formatSelectedPaymentValue({
              amountSrd: subtotal,
              paymentMethod: customerData.paymentMethod,
              displayCurrency: customerData.paypalDisplayCurrency,
              exchangeRate: customerData.exchangeRateSrdPerUsd,
            })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>{t.deliveryFee}</span>
          <span className="font-semibold text-white">
            {customerData.deliveryType === "delivery" &&
            deliveryFee <= 0 &&
            !customerData.requestedAgentCall
              ? t.freeDelivery
              : formatSelectedPaymentValue({
                  amountSrd: customerData.deliveryType === "delivery" ? deliveryFee : 0,
                  paymentMethod: customerData.paymentMethod,
                  displayCurrency: customerData.paypalDisplayCurrency,
                  exchangeRate: customerData.exchangeRateSrdPerUsd,
                })}
            {customerData.deliveryType === "delivery" && deliveryDistanceKm ? (
              <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {formatKilometers(deliveryDistanceKm)}
              </span>
            ) : null}
          </span>
        </div>
        {customerData.paymentMethod === "paypal" ? (
          <div className="flex items-center justify-between">
            <span>{t.paymentFee}</span>
            <span className="font-semibold text-white">
              {formatSelectedPaymentValue({
                amountSrd: customerData.paymentFeeAmountSrd ?? 0,
                paymentMethod: customerData.paymentMethod,
                displayCurrency: customerData.paypalDisplayCurrency,
                exchangeRate: customerData.exchangeRateSrdPerUsd,
              })}
            </span>
          </div>
        ) : null}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3">
          <span className="font-semibold text-white">{t.total}</span>
          <span className={`${isPayPalCheckout ? "text-xl" : "text-lg"} font-bold text-white`}>
            {formatSelectedPaymentValue({
              amountSrd: displayedTotalSrd,
              paymentMethod: customerData.paymentMethod,
              displayCurrency: customerData.paypalDisplayCurrency,
              exchangeRate: customerData.exchangeRateSrdPerUsd,
            })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>{t.paymentMethod}</span>
          <span className="font-semibold text-white">
            {customerData.paymentMethod === "paypal" ? t.paymentPaypal : t.paymentCash}
          </span>
        </div>
        {customerData.paymentMethod === "paypal" &&
        typeof customerData.paymentPayableUsd === "number" ? (
          <div className="flex items-center justify-between">
            <span>{t.paymentUsdEquivalent}</span>
            <span className="font-semibold text-white">{formatUsd(customerData.paymentPayableUsd)}</span>
          </div>
        ) : null}
      </div>
    </section>
  );

  const deliveryReceiptSection = (
    <section className={compactDeliverySectionClass}>
      <h3 className={receiptHeadingClass}>
        {t.deliveryInfo}
      </h3>
      <div
        className={`${
          isPayPalCheckout
            ? "mt-3 space-y-2 text-[13px] leading-5 text-slate-200"
            : "mt-4 space-y-3 text-sm text-slate-300"
        }`}
      >
        <p>{customerData.deliveryType === "delivery" ? t.delivery : t.pickup}</p>
        {customerData.deliveryType === "pickup" &&
        customerData.pickupDate &&
        customerData.pickupTime ? (
          <>
            <p>
              <strong className="text-white">{t.pickupDate}:</strong>{" "}
              {formatPickupLabel(
                `${customerData.pickupDate.getFullYear()}-${String(
                  customerData.pickupDate.getMonth() + 1
                ).padStart(2, "0")}-${String(customerData.pickupDate.getDate()).padStart(2, "0")}`,
                customerData.pickupTime
              )}
            </p>
            <p>
              <strong className="text-white">{t.pickupAddress}:</strong> {PICKUP_ADDRESS}
            </p>
          </>
        ) : null}
        {customerData.deliveryType === "pickup" ? (
          <p>
            <strong className="text-white">{t.requestedAgentCall}:</strong>{" "}
            {customerData.requestedAgentCall ? t.yes : t.no}
          </p>
        ) : null}
        {customerData.requestedAgentCall ? (
          <div
            className={`rounded-2xl border border-teal-500/20 bg-teal-500/10 font-medium text-teal-100 ${
              isPayPalCheckout ? "px-3.5 py-2.5 text-[12px] leading-5" : "px-4 py-3 text-sm"
            }`}
          >
            {t.agentNote}
          </div>
        ) : null}
      </div>
    </section>
  );

  const customerReceiptSection = (
    <section className={receiptSectionClass}>
      <h3 className={receiptHeadingClass}>
        {t.customerInfo}
      </h3>
      <div className={`${isPayPalCheckout ? "mt-3 space-y-2.5 text-[13px] leading-5 text-slate-200" : "mt-4 space-y-3 text-sm text-slate-300"}`}>
        <p>
          <strong className="text-white">{t.name}:</strong> {customerData.name}
        </p>
        <p>
          <strong className="text-white">{t.phone}:</strong> {customerData.phone}
        </p>
        {customerData.email ? (
          <p>
            <strong className="text-white">{t.email}:</strong> {customerData.email}
          </p>
        ) : null}
        <p>
          <strong className="text-white">{t.address}:</strong> {customerData.address}
        </p>
      </div>
    </section>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div
        className={`scrollbar-hidden max-h-[90vh] w-full overflow-y-auto rounded-[2rem] border border-slate-800 bg-[#050816] p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.4)] ${
          isPayPalCheckout ? "max-w-xl" : "max-w-3xl"
        }`}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-[#0a1020] text-sm font-semibold text-slate-300 transition hover:border-pink-500 hover:text-white"
              aria-label={t.back}
              title={t.back}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className={`${isPayPalCheckout ? "text-xl font-bold" : "text-lg font-semibold"} text-white`}>
              {isPayPalCheckout ? t.paymentPaypal : t.orderSummary}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-[#0a1020] text-sm font-semibold text-slate-300 transition hover:border-cyan-500 hover:text-white"
            aria-label={t.close}
          >
            X
          </button>
        </div>

        <div className={receiptStackClass}>
          {productReceiptSection}
          {paymentReceiptSection}
          {isPayPalCheckout ? (
            <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1.45fr)_minmax(0,0.75fr)]">
              {customerReceiptSection}
              {deliveryReceiptSection}
            </div>
          ) : (
            <>
              {deliveryReceiptSection}
              {customerReceiptSection}
            </>
          )}

          {isPayPalCheckout ? (
            <div className="space-y-3 rounded-[1.45rem] border border-cyan-400/25 bg-cyan-500/10 p-5">
              <PayPalCheckoutButton
                clientId={paypalClientId}
                onCreateOrder={onCreatePayPalOrder}
                onApproveOrder={onApprovePayPalOrder}
                onError={onPayPalError}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-cyan-500 px-5 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
            >
              {loading ? t.loading : t.confirmOrder}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
