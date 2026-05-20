"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import AddItemsToOrderModal from "@/components/account/AddItemsToOrderModal";
import EditOrderContactModal from "@/components/account/EditOrderContactModal";
import ReportOrderIssueModal from "@/components/account/ReportOrderIssueModal";
import type { ClientTheme } from "@/lib/shop/client-theme";
import { formatPickupLabel } from "@/lib/shop/checkout";
import { getDeliveryEstimateDetails } from "@/lib/shop/delivery-estimates";
import {
  formatCurrencySrd as formatCurrency,
  formatCurrencyUsd,
  formatKilometers,
} from "@/lib/shop/number-format";
import type {
  CatalogProductOption,
  Locale,
  OrderLineItem,
  OrderSummary,
} from "@/lib/shop/types";

type OrderActionResult = {
  success: boolean;
  errorMessage?: string;
};

type Notice = {
  type: "success" | "error";
  message: string;
};

const texts = {
  es: {
    title: "Historial de ordenes",
    latestOrder: "Ultima orden",
    history: "Todas las ordenes",
    total: "Total",
    deliveryType: "Tipo de entrega",
    estimatedDelivery: "Delivery estimado",
    possibleDeliveryDate: "Posible fecha de entrega",
    date: "Fecha",
    items: "Articulos",
    issues: "Problemas reportados",
    noOrders: "Aun no hay ordenes asociadas a esta cuenta.",
    loading: "Cargando ordenes...",
    loadMore: "Cargar mas",
    loadingMore: "Cargando mas ordenes...",
    delivery: "Delivery",
    pickup: "Recogida programada",
    pickupSchedule: "Fecha y hora de recogida",
    pickupAddress: "Direccion de recogida",
    requestedAgentCall: "Solicito hablar con un agente",
    yes: "Si",
    no: "No",
    agentNote: "Un agente se pondra en contacto con usted para confirmar la orden.",
    back: "Volver atras",
    close: "Cerrar",
    receiptTitle: "Recibo del pedido",
    customerInfo: "Informacion del cliente",
    summary: "Resumen del pedido",
    paymentInfo: "Pago",
    subtotal: "Subtotal",
    deliveryFee: "Delivery",
    distance: "Distancia",
    paymentMethod: "Metodo de pago",
    paymentState: "Estado del pago",
    paypalFee: "Fee de PayPal",
    statusHistory: "Historial de estados",
    lineTotal: "Total de linea",
    unitPrice: "Precio unitario",
    customerName: "Nombre",
    customerEmail: "Correo",
    customerPhone: "Telefono",
    customerAddress: "Direccion",
    noStatusHistory: "Todavia no hay cambios registrados.",
    cancelOrder: "Cancelar pedido",
    addItems: "Agregar articulos",
    editAddress: "Modificar direccion",
    editPhone: "Modificar telefono",
    reportIssue: "Reportar problema",
    canceling: "Cancelando...",
    updating: "Actualizando...",
    reporting: "Enviando...",
    cash: "Efectivo",
    paypal: "PayPal",
  },
  nl: {
    title: "Bestelgeschiedenis",
    latestOrder: "Laatste bestelling",
    history: "Alle bestellingen",
    total: "Totaal",
    deliveryType: "Leveringstype",
    estimatedDelivery: "Geschatte levering",
    possibleDeliveryDate: "Mogelijke leverdatum",
    date: "Datum",
    items: "Artikelen",
    issues: "Gemelde problemen",
    noOrders: "Er zijn nog geen bestellingen gekoppeld aan dit account.",
    loading: "Bestellingen laden...",
    loadMore: "Meer laden",
    loadingMore: "Meer bestellingen laden...",
    delivery: "Levering",
    pickup: "Geplande afhaling",
    pickupSchedule: "Afhaaldatum en tijd",
    pickupAddress: "Afhaaladres",
    requestedAgentCall: "Gesprek met agent gevraagd",
    yes: "Ja",
    no: "Nee",
    agentNote: "Een agent neemt contact met u op om de bestelling te bevestigen.",
    back: "Terug",
    close: "Sluiten",
    receiptTitle: "Bestelbon",
    customerInfo: "Klantgegevens",
    summary: "Besteloverzicht",
    paymentInfo: "Betaling",
    subtotal: "Subtotaal",
    deliveryFee: "Levering",
    distance: "Afstand",
    paymentMethod: "Betaalmethode",
    paymentState: "Betaalstatus",
    paypalFee: "PayPal-fee",
    statusHistory: "Statusgeschiedenis",
    lineTotal: "Regeltotaal",
    unitPrice: "Prijs per stuk",
    customerName: "Naam",
    customerEmail: "E-mail",
    customerPhone: "Telefoon",
    customerAddress: "Adres",
    noStatusHistory: "Er zijn nog geen statuswijzigingen geregistreerd.",
    cancelOrder: "Bestelling annuleren",
    addItems: "Artikelen toevoegen",
    editAddress: "Adres wijzigen",
    editPhone: "Telefoon wijzigen",
    reportIssue: "Probleem melden",
    canceling: "Annuleren...",
    updating: "Bijwerken...",
    reporting: "Verzenden...",
    cash: "Contant",
    paypal: "PayPal",
  },
  en: {
    title: "Order history",
    latestOrder: "Latest order",
    history: "All orders",
    total: "Total",
    deliveryType: "Delivery type",
    estimatedDelivery: "Estimated delivery",
    possibleDeliveryDate: "Possible delivery date",
    date: "Date",
    items: "Items",
    issues: "Reported issues",
    noOrders: "There are no orders linked to this account yet.",
    loading: "Loading orders...",
    loadMore: "Load more",
    loadingMore: "Loading more orders...",
    delivery: "Delivery",
    pickup: "Scheduled pickup",
    pickupSchedule: "Pickup date and time",
    pickupAddress: "Pickup address",
    requestedAgentCall: "Requested to speak with an agent",
    yes: "Yes",
    no: "No",
    agentNote: "An agent will contact you to confirm the order.",
    back: "Go back",
    close: "Close",
    receiptTitle: "Order receipt",
    customerInfo: "Customer information",
    summary: "Order summary",
    paymentInfo: "Payment",
    subtotal: "Subtotal",
    deliveryFee: "Delivery",
    distance: "Distance",
    paymentMethod: "Payment method",
    paymentState: "Payment status",
    paypalFee: "PayPal fee",
    statusHistory: "Status history",
    lineTotal: "Line total",
    unitPrice: "Unit price",
    customerName: "Name",
    customerEmail: "Email",
    customerPhone: "Phone",
    customerAddress: "Address",
    noStatusHistory: "There are no recorded updates yet.",
    cancelOrder: "Cancel order",
    addItems: "Add items",
    editAddress: "Edit address",
    editPhone: "Edit phone",
    reportIssue: "Report problem",
    canceling: "Canceling...",
    updating: "Updating...",
    reporting: "Sending...",
    cash: "Cash",
    paypal: "PayPal",
  },
  pt: {
    title: "Historico de pedidos",
    latestOrder: "Ultimo pedido",
    history: "Todos os pedidos",
    total: "Total",
    deliveryType: "Tipo de entrega",
    estimatedDelivery: "Entrega estimada",
    possibleDeliveryDate: "Possivel data de entrega",
    date: "Data",
    items: "Artigos",
    issues: "Problemas reportados",
    noOrders: "Ainda nao ha pedidos vinculados a esta conta.",
    loading: "Carregando pedidos...",
    loadMore: "Carregar mais",
    loadingMore: "Carregando mais pedidos...",
    delivery: "Entrega",
    pickup: "Retirada programada",
    pickupSchedule: "Data e hora da retirada",
    pickupAddress: "Endereco de retirada",
    requestedAgentCall: "Solicitou falar com um agente",
    yes: "Sim",
    no: "Nao",
    agentNote: "Um agente entrara em contato para confirmar o pedido.",
    back: "Voltar",
    close: "Fechar",
    receiptTitle: "Recibo do pedido",
    customerInfo: "Informacoes do cliente",
    summary: "Resumo do pedido",
    paymentInfo: "Pagamento",
    subtotal: "Subtotal",
    deliveryFee: "Entrega",
    distance: "Distancia",
    paymentMethod: "Metodo de pagamento",
    paymentState: "Status do pagamento",
    paypalFee: "Fee do PayPal",
    statusHistory: "Historico de status",
    lineTotal: "Total da linha",
    unitPrice: "Preco unitario",
    customerName: "Nome",
    customerEmail: "E-mail",
    customerPhone: "Telefone",
    customerAddress: "Endereco",
    noStatusHistory: "Ainda nao ha mudancas registradas.",
    cancelOrder: "Cancelar pedido",
    addItems: "Adicionar artigos",
    editAddress: "Modificar endereco",
    editPhone: "Modificar telefone",
    reportIssue: "Reportar problema",
    canceling: "Cancelando...",
    updating: "Atualizando...",
    reporting: "Enviando...",
    cash: "Dinheiro",
    paypal: "PayPal",
  },
} as const;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function deliveryLabel(locale: Locale, order: OrderSummary) {
  const t = texts[locale];
  return order.deliveryType === "delivery" ? t.delivery : t.pickup;
}

function paymentMethodLabel(locale: Locale, order: OrderSummary) {
  const t = texts[locale];
  return order.payment.method === "paypal" ? t.paypal : t.cash;
}

function shouldUseDirectOrderImage(src: string) {
  return src.startsWith("data:") || src.startsWith("/api/orders/");
}

function getStatusClass(order: OrderSummary, isLightTheme: boolean) {
  if (isLightTheme) {
    if (order.status === "Pedido cancelado") {
      return "bg-rose-100 text-rose-700 ring-rose-200";
    }

    if (order.deliveryType === "pickup") {
      return "bg-sky-100 text-rose-700 ring-sky-200";
    }

    if (order.status === "Pedido completado") {
      return "bg-emerald-100 text-rose-700 ring-emerald-200";
    }

    if (order.status === "Procesandose para delivery") {
      return "bg-amber-100 text-rose-700 ring-amber-200";
    }

    return "bg-cyan-100 text-rose-700 ring-cyan-200";
  }

  if (order.status === "Pedido cancelado") {
    return "bg-rose-500/15 text-rose-200 ring-rose-500/20";
  }

  if (order.deliveryType === "pickup") {
    return "bg-violet-500/15 text-violet-200 ring-violet-500/20";
  }

  if (order.status === "Pedido completado") {
    return "bg-emerald-500/15 text-emerald-200 ring-emerald-500/20";
  }

  if (order.status === "Procesandose para delivery") {
    return "bg-amber-500/15 text-amber-200 ring-amber-500/20";
  }

  return "bg-cyan-500/15 text-cyan-200 ring-cyan-500/20";
}

function OrderCard({
  clientTheme,
  locale,
  order,
  highlight,
  busy,
  pendingAction,
  onOpenProduct,
  onOpenReceipt,
  onCancel,
  onAddItems,
  onEditAddress,
  onEditPhone,
  onReportIssue,
}: {
  clientTheme: ClientTheme;
  locale: Locale;
  order: OrderSummary;
  highlight?: boolean;
  busy: boolean;
  pendingAction: "cancel" | "add-items" | "update-contact" | "report-issue" | null;
  onOpenProduct: (input: {
    productId: string | number;
    selectedVariantId?: string;
    selectedVariantName?: string;
    selectedColor?: string;
    selectedImage?: string;
  }) => void;
  onOpenReceipt: (order: OrderSummary) => void;
  onCancel: (orderId: string) => void;
  onAddItems: (order: OrderSummary) => void;
  onEditAddress: (order: OrderSummary) => void;
  onEditPhone: (order: OrderSummary) => void;
  onReportIssue: (order: OrderSummary) => void;
}) {
  const t = texts[locale];
  const isLightTheme = clientTheme === "light";
  const baseCardClass = isLightTheme
    ? highlight
      ? "border-sky-200 bg-sky-50"
      : "border-slate-200 bg-white"
    : highlight
      ? "border-cyan-500/30 bg-cyan-500/10"
      : "border-slate-800 bg-[#0a1020]";
  const titleTextClass = isLightTheme ? "text-slate-600" : "text-slate-500";
  const bodyTextClass = isLightTheme ? "text-slate-700" : "text-slate-300";
  const detailPanelClass = isLightTheme ? "bg-slate-50 text-slate-700" : "bg-[#050816] text-slate-300";
  const subtleActionClass = isLightTheme
    ? "border border-slate-300 bg-white text-slate-950"
    : "bg-[#050816] text-slate-200 ring-1 ring-slate-700";
  const issueActionClass = isLightTheme ? "bg-slate-950 text-white" : "bg-slate-900 text-white";
  const deliveryEstimate = getDeliveryEstimateDetails({
    distanceKm: order.deliveryDistanceKm,
    locale,
    baseDate: order.createdAt,
  });

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpenReceipt(order)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenReceipt(order);
        }
      }}
      className={`rounded-2xl border p-4 shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${baseCardClass} cursor-pointer`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${titleTextClass}`}>
            {order.id}
          </p>
          <p className={`text-sm ${bodyTextClass}`}>
            {t.date}: {formatDateTime(order.createdAt)}
          </p>
        </div>
        <span
          className={`max-w-full rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusClass(
            order,
            isLightTheme
          )}`}
        >
          {order.status}
        </span>
      </div>

      {order.statusDetail ? (
        <div className={`mt-3 rounded-2xl px-4 py-3 text-sm ${detailPanelClass}`}>
          {order.statusDetail}
        </div>
      ) : null}

      <div className={`mt-4 grid gap-3 text-sm md:grid-cols-2 ${bodyTextClass}`}>
        <p>
          <strong>{t.total}:</strong> {formatCurrency(order.total)}
        </p>
        <p>
          <strong>{t.deliveryType}:</strong> {deliveryLabel(locale, order)}
        </p>
        {order.deliveryType === "delivery" && deliveryEstimate ? (
          <>
            <p>
              <strong>{t.estimatedDelivery}:</strong> {deliveryEstimate.summaryText}
            </p>
            <p>
              <strong>{t.possibleDeliveryDate}:</strong> {deliveryEstimate.dateText}
            </p>
          </>
        ) : null}
        {order.deliveryType === "pickup" && order.pickupDate && order.pickupTime ? (
          <p className="md:col-span-2">
            <strong>{t.pickupSchedule}:</strong>{" "}
            {formatPickupLabel(order.pickupDate, order.pickupTime)}
          </p>
        ) : null}
        {order.pickupAddress ? (
          <p className="md:col-span-2">
            <strong>{t.pickupAddress}:</strong> {order.pickupAddress}
          </p>
        ) : null}
        <p className="md:col-span-2">
          <strong>{t.requestedAgentCall}:</strong> {order.requestedAgentCall ? t.yes : t.no}
        </p>
        {order.issues.length > 0 ? (
          <p className="md:col-span-2">
            <strong>{t.issues}:</strong> {order.issues.length}
          </p>
        ) : null}
      </div>

      <div className={`mt-4 rounded-2xl p-4 ${detailPanelClass}`}>
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${titleTextClass}`}>
          {t.items}
        </p>
        <div className="mt-3 space-y-2">
          {order.items.map((item, index) => (
            <div
              key={`${order.id}-${item.productId ?? item.name}-${index}`}
              className={`flex items-center justify-between gap-3 text-sm ${bodyTextClass}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                {item.image ? (
                  <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200/10 bg-slate-100/10">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="40px"
                      className="object-cover"
                      unoptimized={shouldUseDirectOrderImage(item.image)}
                    />
                  </div>
                ) : null}
                {item.productId ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenProduct({
                        productId: item.productId!,
                        selectedVariantId: item.selectedVariantId,
                        selectedVariantName: item.selectedVariantName,
                        selectedColor: item.selectedColor,
                        selectedImage: item.image,
                      });
                    }}
                    className={`min-w-0 truncate text-left transition ${isLightTheme ? "hover:text-slate-950" : "hover:text-cyan-300"}`}
                  >
                    {item.quantity}x {item.name}
                  </button>
                ) : (
                  <span className="min-w-0 truncate">
                    {item.quantity}x {item.name}
                  </span>
                )}
              </div>
              <span>{formatCurrency(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
      </div>

      {order.requestedAgentCall ? (
        <p className={`mt-4 rounded-xl px-3 py-2 text-sm font-medium ${isLightTheme ? "bg-teal-50 text-teal-700" : "bg-teal-500/10 text-teal-100"}`}>
          {t.agentNote}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {order.canCancel ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onCancel(order.id);
            }}
            disabled={busy}
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pendingAction === "cancel" ? t.canceling : t.cancelOrder}
          </button>
        ) : null}
        {order.canAddItems ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAddItems(order);
            }}
            disabled={busy}
            className="rounded-full bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pendingAction === "add-items" ? t.updating : t.addItems}
          </button>
        ) : null}
        {order.canEditAddress ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEditAddress(order);
            }}
            disabled={busy}
            className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${subtleActionClass}`}
          >
            {pendingAction === "update-contact" ? t.updating : t.editAddress}
          </button>
        ) : null}
        {order.canEditPhone ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEditPhone(order);
            }}
            disabled={busy}
            className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${subtleActionClass}`}
          >
            {pendingAction === "update-contact" ? t.updating : t.editPhone}
          </button>
        ) : null}
        {order.canReportIssue ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onReportIssue(order);
            }}
            disabled={busy}
            className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${issueActionClass}`}
          >
            {pendingAction === "report-issue" ? t.reporting : t.reportIssue}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function OrderReceiptModal({
  clientTheme,
  locale,
  order,
  pending,
  onClose,
  onOpenProduct,
  onReportIssue,
}: {
  clientTheme: ClientTheme;
  locale: Locale;
  order: OrderSummary;
  pending: boolean;
  onClose: () => void;
  onOpenProduct: (input: {
    productId: string | number;
    selectedVariantId?: string;
    selectedVariantName?: string;
    selectedColor?: string;
    selectedImage?: string;
  }) => void;
  onReportIssue: (order: OrderSummary) => void;
}) {
  const t = texts[locale];
  const isLightTheme = clientTheme === "light";
  const overlayCardClass = isLightTheme
    ? "border-slate-200 bg-white text-slate-950"
    : "border-slate-800 bg-[#050816] text-white";
  const panelClass = isLightTheme
    ? "border-slate-200 bg-slate-50"
    : "border-slate-800 bg-[#0a1020]";
  const mutedClass = isLightTheme ? "text-slate-600" : "text-slate-400";
  const strongClass = isLightTheme ? "text-slate-950" : "text-white";
  const itemPanelClass = isLightTheme ? "border-slate-200 bg-white" : "border-slate-800 bg-[#050816]";
  const deliveryEstimate = getDeliveryEstimateDetails({
    distanceKm: order.deliveryDistanceKm,
    locale,
    baseDate: order.createdAt,
  });
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 px-2 py-2 sm:items-center sm:px-4 sm:py-6">
      <div className={`flex max-h-[94dvh] w-full max-w-[min(100vw-0.75rem,64rem)] flex-col overflow-hidden rounded-[1.75rem] border ${overlayCardClass} sm:rounded-3xl`}>
        <div className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${panelClass}`}>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${mutedClass}`}>
              {t.receiptTitle}
            </p>
            <h5 className={`mt-1 text-lg font-bold ${strongClass}`}>{order.id}</h5>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {order.canReportIssue ? (
              <button
                type="button"
                onClick={() => onReportIssue(order)}
                disabled={pending}
                className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
                  isLightTheme
                    ? "border border-rose-300 bg-rose-50 text-rose-700"
                    : "border border-rose-500/30 bg-rose-500/10 text-rose-200"
                }`}
              >
                {pending ? t.reporting : t.reportIssue}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                isLightTheme
                  ? "border border-slate-300 bg-white text-slate-950"
                  : "border border-slate-700 bg-[#050816] text-slate-200"
              }`}
            >
              {t.close}
            </button>
          </div>
        </div>

        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <div className="space-y-4">
            <div className={`rounded-2xl border p-4 ${panelClass}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className={`text-sm ${mutedClass}`}>
                    {t.date}: {formatDateTime(order.createdAt)}
                  </p>
                  <p className={`text-sm ${mutedClass}`}>
                    {t.deliveryType}: {deliveryLabel(locale, order)}
                  </p>
                </div>
                <span
                  className={`max-w-full rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusClass(
                    order,
                    isLightTheme
                  )}`}
                >
                  {order.status}
                </span>
              </div>
              {order.statusDetail ? (
                <div className={`mt-3 rounded-2xl px-4 py-3 text-sm ${itemPanelClass}`}>
                  {order.statusDetail}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
              <div className={`rounded-2xl border p-4 ${panelClass}`}>
                <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${mutedClass}`}>
                  {t.items}
                </p>
                <div className="mt-4 space-y-3">
                  {order.items.map((item, index) => (
                    <div
                      key={`${order.id}-receipt-${item.productId ?? item.name}-${index}`}
                      className={`rounded-2xl border p-3 ${itemPanelClass}`}
                    >
                      <div className="flex gap-3">
                        {item.image ? (
                          <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border border-slate-200/10 bg-slate-100/10">
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              sizes="80px"
                              className="object-cover"
                              unoptimized={shouldUseDirectOrderImage(item.image)}
                            />
                          </div>
                        ) : null}
                        <div className="min-w-0 flex-1 space-y-2">
                          {item.productId ? (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenProduct({
                                  productId: item.productId!,
                                  selectedVariantId: item.selectedVariantId,
                                  selectedVariantName: item.selectedVariantName,
                                  selectedColor: item.selectedColor,
                                  selectedImage: item.image,
                                })
                              }
                              className={`text-left text-sm font-semibold transition ${isLightTheme ? "text-slate-950 hover:text-slate-700" : "text-white hover:text-cyan-300"}`}
                            >
                              {item.name}
                            </button>
                          ) : (
                            <p className={`text-sm font-semibold ${strongClass}`}>{item.name}</p>
                          )}
                          {item.selectedVariantName || item.selectedColor ? (
                            <p className={`text-xs ${mutedClass}`}>
                              {[item.selectedVariantName, item.selectedColor].filter(Boolean).join(" / ")}
                            </p>
                          ) : null}
                          <div className={`grid gap-2 text-sm sm:grid-cols-3 ${mutedClass}`}>
                            <p>
                              <strong>{t.items}:</strong> {item.quantity}
                            </p>
                            <p>
                              <strong>{t.unitPrice}:</strong> {formatCurrency(item.price)}
                            </p>
                            <p>
                              <strong>{t.lineTotal}:</strong> {formatCurrency(item.price * item.quantity)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className={`rounded-2xl border p-4 ${panelClass}`}>
                  <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${mutedClass}`}>
                    {t.customerInfo}
                  </p>
                  <div className={`mt-4 space-y-2 text-sm ${mutedClass}`}>
                    <p>
                      <strong>{t.customerName}:</strong> {order.customerName}
                    </p>
                    <p>
                      <strong>{t.customerEmail}:</strong> {order.customerEmail || "-"}
                    </p>
                    <p>
                      <strong>{t.customerPhone}:</strong> {order.customerPhone || "-"}
                    </p>
                    <p>
                      <strong>{t.customerAddress}:</strong> {order.customerAddress || "-"}
                    </p>
                    <p>
                      <strong>{t.requestedAgentCall}:</strong> {order.requestedAgentCall ? t.yes : t.no}
                    </p>
                  </div>
                </div>

                <div className={`rounded-2xl border p-4 ${panelClass}`}>
                  <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${mutedClass}`}>
                    {t.paymentInfo}
                  </p>
                  <div className={`mt-4 space-y-2 text-sm ${mutedClass}`}>
                    <p>
                      <strong>{t.paymentMethod}:</strong> {paymentMethodLabel(locale, order)}
                    </p>
                    <p>
                      <strong>{t.paymentState}:</strong> {order.payment.state}
                    </p>
                    {order.payment.method === "paypal" ? (
                      <>
                        <p>
                          <strong>{t.paypalFee}:</strong> {formatCurrency(order.payment.feeAmountSrd)}
                        </p>
                        {typeof order.payment.payableUsd === "number" ? (
                          <p>
                        <strong>USD:</strong> {formatCurrencyUsd(order.payment.payableUsd)}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>

                <div className={`rounded-2xl border p-4 ${panelClass}`}>
                  <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${mutedClass}`}>
                    {t.summary}
                  </p>
                  <div className={`mt-4 space-y-2 text-sm ${mutedClass}`}>
                    <p>
                      <strong>{t.subtotal}:</strong> {formatCurrency(order.subtotal)}
                    </p>
                    <p>
                      <strong>{t.deliveryFee}:</strong> {formatCurrency(order.deliveryFee)}
                    </p>
                    {order.deliveryDistanceKm ? (
                      <p>
                      <strong>{t.distance}:</strong> {formatKilometers(order.deliveryDistanceKm)}
                      </p>
                    ) : null}
                    <p>
                      <strong>{t.items}:</strong> {totalItems}
                    </p>
                    <p className={`text-base font-bold ${strongClass}`}>
                      {t.total}: {formatCurrency(order.total)}
                    </p>
                    {order.deliveryType === "delivery" && deliveryEstimate ? (
                      <>
                        <p>
                          <strong>{t.estimatedDelivery}:</strong> {deliveryEstimate.summaryText}
                        </p>
                        <p>
                          <strong>{t.possibleDeliveryDate}:</strong> {deliveryEstimate.dateText}
                        </p>
                      </>
                    ) : null}
                    {order.deliveryType === "pickup" && order.pickupDate && order.pickupTime ? (
                      <p>
                        <strong>{t.pickupSchedule}:</strong> {formatPickupLabel(order.pickupDate, order.pickupTime)}
                      </p>
                    ) : null}
                    {order.pickupAddress ? (
                      <p>
                        <strong>{t.pickupAddress}:</strong> {order.pickupAddress}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className={`rounded-2xl border p-4 ${panelClass}`}>
                  <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${mutedClass}`}>
                    {t.statusHistory}
                  </p>
                  <div className="mt-4 space-y-2">
                    {order.statusHistory.length > 0 ? (
                      order.statusHistory.map((entry) => (
                        <div
                          key={entry.id}
                          className={`rounded-2xl border px-3 py-3 text-sm ${itemPanelClass} ${mutedClass}`}
                        >
                          <p className={`font-semibold ${strongClass}`}>{entry.status}</p>
                          <p className="mt-1">{formatDateTime(entry.changedAt)}</p>
                          <p className="mt-1">{entry.changedByName}</p>
                        </div>
                      ))
                    ) : (
                      <p className={`text-sm ${mutedClass}`}>{t.noStatusHistory}</p>
                    )}
                  </div>
                </div>

                {order.issues.length > 0 ? (
                  <div className={`rounded-2xl border p-4 ${panelClass}`}>
                    <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${mutedClass}`}>
                      {t.issues}
                    </p>
                    <div className="mt-4 space-y-2">
                      {order.issues.map((issue) => (
                        <div
                          key={issue.id}
                          className={`rounded-2xl border px-3 py-3 text-sm ${itemPanelClass} ${mutedClass}`}
                        >
                          <p>{issue.message}</p>
                          <p className="mt-2">{formatDateTime(issue.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface OrdersPanelProps {
  clientTheme: ClientTheme;
  locale: Locale;
  latestOrder: OrderSummary | null;
  orders: OrderSummary[];
  products: CatalogProductOption[];
  onOpenProduct?: (input: {
    productId: string | number;
    selectedVariantId?: string;
    selectedVariantName?: string;
    selectedColor?: string;
    selectedImage?: string;
  }) => void;
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  pendingOrderId: string | null;
  pendingAction: "cancel" | "add-items" | "update-contact" | "report-issue" | null;
  notice: Notice | null;
  onLoadMore?: () => void;
  onClose: () => void;
  onCancelOrder: (orderId: string) => Promise<OrderActionResult>;
  onAddItems: (orderId: string, items: OrderLineItem[]) => Promise<OrderActionResult>;
  onUpdateContact: (
    orderId: string,
    payload: { address?: string; phone?: string }
  ) => Promise<OrderActionResult>;
  onReportIssue: (orderId: string, message: string) => Promise<OrderActionResult>;
  initialReceiptOrderId?: string | null;
}

export default function OrdersPanel({
  clientTheme,
  locale,
  latestOrder,
  orders,
  products,
  onOpenProduct,
  loading,
  loadingMore = false,
  hasMore = false,
  pendingOrderId,
  pendingAction,
  notice,
  onLoadMore = () => undefined,
  onClose,
  onCancelOrder,
  onAddItems,
  onUpdateContact,
  onReportIssue,
  initialReceiptOrderId = null,
}: OrdersPanelProps) {
  const router = useRouter();
  const t = texts[locale];
  const isLightTheme = clientTheme === "light";
  const panelShellClass = isLightTheme
    ? "border-slate-200 bg-white"
    : "border-slate-800 bg-[#050816]";
  const panelHeaderClass = isLightTheme
    ? "border-slate-200 bg-slate-50"
    : "border-slate-800 bg-[#03050f]";
  const textStrongClass = isLightTheme ? "text-slate-950" : "text-white";
  const textMutedClass = isLightTheme ? "text-slate-600" : "text-slate-500";
  const statePanelClass = isLightTheme
    ? "border-slate-200 bg-slate-50 text-slate-600"
    : "border-slate-800 bg-[#0a1020] text-slate-400";
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null);
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(initialReceiptOrderId);
  const [contactTarget, setContactTarget] = useState<{
    order: OrderSummary;
    mode: "address" | "phone";
  } | null>(null);
  const [issueTarget, setIssueTarget] = useState<OrderSummary | null>(null);
  const [addItemsError, setAddItemsError] = useState("");
  const [contactError, setContactError] = useState("");
  const [issueError, setIssueError] = useState("");

  const historyOrders = latestOrder
    ? orders.filter((order) => order.id !== latestOrder.id)
    : orders;
  const visibleOrders = latestOrder ? [latestOrder, ...historyOrders] : orders;
  const busy = pendingOrderId !== null;
  const selectedOrderPending =
    selectedOrder && pendingOrderId === selectedOrder.id ? pendingAction : null;
  const receiptOrder =
    receiptOrderId ? visibleOrders.find((order) => order.id === receiptOrderId) ?? null : null;
  const contactPending =
    contactTarget && pendingOrderId === contactTarget.order.id ? pendingAction : null;
  const issuePending =
    issueTarget && pendingOrderId === issueTarget.id ? pendingAction : null;

  function openProduct(input: {
    productId: string | number;
    selectedVariantId?: string;
    selectedVariantName?: string;
    selectedColor?: string;
    selectedImage?: string;
  }) {
    if (onOpenProduct) {
      onOpenProduct(input);
      return;
    }

    onClose();
    router.push(`/products/${input.productId}`);
  }

  return (
    <>
      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border ${panelShellClass}`}>
        <div className={`flex items-center justify-between gap-3 border-b px-4 py-4 ${panelHeaderClass}`}>
          <h4 className={`text-base font-bold ${textStrongClass}`}>{t.title}</h4>
        </div>

        {notice ? (
          <div
            className={`mx-4 mt-4 rounded-2xl px-4 py-3 text-sm ${
              notice.type === "success"
                ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                : "border border-rose-500/20 bg-rose-500/10 text-rose-200"
            }`}
          >
            {notice.message}
          </div>
        ) : null}

        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4">
          {loading ? (
            <div className={`rounded-2xl border p-6 text-sm ${statePanelClass}`}>
              {t.loading}
            </div>
          ) : !orders.length ? (
            <div className={`rounded-2xl border border-dashed p-6 text-sm ${statePanelClass}`}>
              {t.noOrders}
            </div>
          ) : (
            <div className="space-y-4">
              {latestOrder ? (
                <section className="space-y-3">
                  <h5 className={`text-xs font-semibold uppercase tracking-[0.2em] ${textMutedClass}`}>
                    {t.latestOrder}
                  </h5>
                  <OrderCard
                    clientTheme={clientTheme}
                    locale={locale}
                    order={latestOrder}
                    highlight
                    busy={busy}
                    pendingAction={pendingOrderId === latestOrder.id ? pendingAction : null}
                    onOpenProduct={openProduct}
                    onOpenReceipt={(order) => setReceiptOrderId(order.id)}
                    onCancel={(orderId) => {
                      void onCancelOrder(orderId);
                    }}
                    onAddItems={(order) => {
                      setAddItemsError("");
                      setSelectedOrder(order);
                    }}
                    onEditAddress={(order) => {
                      setContactError("");
                      setContactTarget({ order, mode: "address" });
                    }}
                    onEditPhone={(order) => {
                      setContactError("");
                      setContactTarget({ order, mode: "phone" });
                    }}
                    onReportIssue={(order) => {
                      setIssueError("");
                      setIssueTarget(order);
                    }}
                  />
                </section>
              ) : null}

              {historyOrders.length > 0 ? (
                <section className="space-y-3">
                  <h5 className={`text-xs font-semibold uppercase tracking-[0.2em] ${textMutedClass}`}>
                    {t.history}
                  </h5>
                  <div className="space-y-3">
                    {historyOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        clientTheme={clientTheme}
                        locale={locale}
                        order={order}
                        busy={busy}
                        pendingAction={pendingOrderId === order.id ? pendingAction : null}
                        onOpenProduct={openProduct}
                        onOpenReceipt={(selected) => setReceiptOrderId(selected.id)}
                        onCancel={(orderId) => {
                          void onCancelOrder(orderId);
                        }}
                        onAddItems={(selected) => {
                          setAddItemsError("");
                          setSelectedOrder(selected);
                        }}
                        onEditAddress={(selected) => {
                          setContactError("");
                          setContactTarget({ order: selected, mode: "address" });
                        }}
                        onEditPhone={(selected) => {
                          setContactError("");
                          setContactTarget({ order: selected, mode: "phone" });
                        }}
                        onReportIssue={(selected) => {
                          setIssueError("");
                          setIssueTarget(selected);
                        }}
                      />
                    ))}
                  </div>
                  {hasMore ? (
                    <button
                      type="button"
                      onClick={onLoadMore}
                      disabled={loadingMore}
                      className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        isLightTheme
                          ? "border border-slate-300 bg-white text-slate-950 hover:bg-slate-100"
                          : "border border-slate-700 bg-[#0a1020] text-slate-100 hover:border-cyan-500 hover:text-cyan-300"
                      }`}
                    >
                      {loadingMore ? t.loadingMore : t.loadMore}
                    </button>
                  ) : null}
                </section>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {selectedOrder ? (
        <AddItemsToOrderModal
          locale={locale}
          order={selectedOrder}
          products={products}
          pending={selectedOrderPending === "add-items"}
          errorMessage={addItemsError}
          onClose={() => {
            setAddItemsError("");
            setSelectedOrder(null);
          }}
          onSubmit={async (items) => {
            const result = await onAddItems(selectedOrder.id, items);

            if (result.success) {
              setAddItemsError("");
              setSelectedOrder(null);
              return;
            }

            setAddItemsError(result.errorMessage ?? "");
          }}
        />
      ) : null}

      {contactTarget ? (
        <EditOrderContactModal
          locale={locale}
          order={contactTarget.order}
          mode={contactTarget.mode}
          pending={contactPending === "update-contact"}
          errorMessage={contactError}
          onClose={() => {
            setContactError("");
            setContactTarget(null);
          }}
          onSubmit={async (payload) => {
            const result = await onUpdateContact(contactTarget.order.id, payload);

            if (result.success) {
              setContactError("");
              setContactTarget(null);
              return;
            }

            setContactError(result.errorMessage ?? "");
          }}
        />
      ) : null}

      {issueTarget ? (
        <ReportOrderIssueModal
          locale={locale}
          order={issueTarget}
          pending={issuePending === "report-issue"}
          errorMessage={issueError}
          onClose={() => {
            setIssueError("");
            setIssueTarget(null);
          }}
          onSubmit={async (message) => {
            const result = await onReportIssue(issueTarget.id, message);

            if (result.success) {
              setIssueError("");
              setIssueTarget(null);
              return;
            }

            setIssueError(result.errorMessage ?? "");
          }}
        />
      ) : null}

      {receiptOrder ? (
        <OrderReceiptModal
          clientTheme={clientTheme}
          locale={locale}
          order={receiptOrder}
          pending={issuePending === "report-issue"}
          onClose={() => setReceiptOrderId(null)}
          onOpenProduct={openProduct}
          onReportIssue={(selected) => {
            setIssueError("");
            setIssueTarget(selected);
          }}
        />
      ) : null}
    </>
  );
}
