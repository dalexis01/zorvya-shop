/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, type CSSProperties } from "react";

import { getFreeDeliveryProgress } from "@/helpers/delivery";
import { getDeliveryEstimateDetails } from "@/lib/shop/delivery-estimates";
import { formatCurrencySrd as formatCurrency, formatKilometers } from "@/lib/shop/number-format";
import { getProductAvailableStock, isCartEntryPayable } from "@/lib/shop/product-stock";
import type { Locale, StorefrontProduct } from "@/lib/shop/types";

type CartEntry = {
  cartKey: string;
  product: StorefrontProduct;
  quantity: number;
  selectedVariantId?: string;
  selectedVariantName?: string;
  selectedColor?: string;
  unitPrice?: number;
  selectedImage?: string;
};

const texts = {
  es: {
    title: "Carrito",
    empty: "Tu carrito sigue guardado y esta vacio por ahora.",
    subtotal: "Subtotal",
    total: "Total",
    deliveryFee: "Delivery",
    deliveryPending: "Se calcula al confirmar la direccion",
    addressMissing: "Agrega tu direccion en tu cuenta para ver el costo real del delivery.",
    deliveryUnavailable: "Todavia no tenemos delivery disponible en tu zona.",
    deliveryReview: "Tu direccion necesita revision manual antes del envio.",
    freeDelivery: "Gratis",
    freeDeliveryGoal: "Delivery gratis",
    freeDeliveryUnlocked: "Ya desbloqueaste delivery gratis para este carrito.",
    freeDeliveryRemaining: (amount: number) =>
      `Te faltan ${formatCurrency(amount)} para delivery gratis.`,
    freeDeliveryNotAvailable: "En esta distancia no aplica delivery gratis.",
    selectItem: "Marcar articulo para pagar",
    selectionHint: "Solo se pagaran los articulos seleccionados.",
    selectAll: "Seleccionar todo",
    clearSelection: "Quitar seleccion",
    selectedSummary: (selected: number, total: number) =>
      `${selected} de ${total} articulos seleccionados`,
    selectToContinue: "Selecciona al menos un articulo para pagar.",
    continue: "Continuar al checkout",
    close: "Cerrar",
    remove: "Quitar",
    share: "Compartir carrito",
    estimatedDelivery: "Envio estimado",
    deliveryPendingItem: "Se calcula al confirmar",
    deliveryReviewItem: "Revisamos tu direccion",
    deliveryUnavailableItem: "Sin delivery en tu zona",
    arrivesOn: (when: string) => `Te llega ${when}`,
    arrivesBetween: (from: string, to: string) => `Te llega entre ${from} y ${to}`,
    outOfStockNow: "Agotado por ahora",
    savedForLater: "Queda guardado en tu carro para compra futura.",
    availableNow: (stock: number) => `${stock} disponibles ahora`,
  },
  nl: {
    title: "Winkelwagen",
    empty: "Je winkelwagen is opgeslagen en momenteel leeg.",
    subtotal: "Subtotaal",
    total: "Totaal",
    deliveryFee: "Levering",
    deliveryPending: "Wordt berekend bij het bevestigen van het adres",
    addressMissing: "Voeg je adres toe in je account om de echte leveringskosten te zien.",
    deliveryUnavailable: "We hebben nog geen levering beschikbaar in jouw zone.",
    deliveryReview: "Je adres heeft handmatige controle nodig voor verzending.",
    freeDelivery: "Gratis",
    freeDeliveryGoal: "Gratis levering",
    freeDeliveryUnlocked: "Je hebt gratis levering voor deze winkelwagen ontgrendeld.",
    freeDeliveryRemaining: (amount: number) =>
      `Nog ${formatCurrency(amount)} voor gratis levering.`,
    freeDeliveryNotAvailable: "Gratis levering geldt niet op deze afstand.",
    selectItem: "Artikel markeren om te betalen",
    selectionHint: "Alleen de geselecteerde artikelen worden afgerekend.",
    selectAll: "Alles selecteren",
    clearSelection: "Selectie wissen",
    selectedSummary: (selected: number, total: number) =>
      `${selected} van ${total} artikelen geselecteerd`,
    selectToContinue: "Selecteer minstens een artikel om af te rekenen.",
    continue: "Verder naar checkout",
    close: "Sluiten",
    remove: "Verwijderen",
    share: "Winkelwagen delen",
    estimatedDelivery: "Geschatte levering",
    deliveryPendingItem: "Wordt zo berekend",
    deliveryReviewItem: "Adres wordt nagekeken",
    deliveryUnavailableItem: "Geen levering in jouw zone",
    arrivesOn: (when: string) => `Komt ${when} aan`,
    arrivesBetween: (from: string, to: string) => `Komt tussen ${from} en ${to} aan`,
    outOfStockNow: "Momenteel uitverkocht",
    savedForLater: "Blijft bewaard in je winkelwagen voor later.",
    availableNow: (stock: number) => `${stock} nu beschikbaar`,
  },
  en: {
    title: "Cart",
    empty: "Your cart is saved and currently empty.",
    subtotal: "Subtotal",
    total: "Total",
    deliveryFee: "Delivery",
    deliveryPending: "Calculated when you confirm the address",
    addressMissing: "Add your address in your account to see the real delivery cost.",
    deliveryUnavailable: "We do not have delivery available in your area yet.",
    deliveryReview: "Your address needs manual review before dispatch.",
    freeDelivery: "Free",
    freeDeliveryGoal: "Free delivery",
    freeDeliveryUnlocked: "You already unlocked free delivery for this cart.",
    freeDeliveryRemaining: (amount: number) =>
      `${formatCurrency(amount)} left for free delivery.`,
    freeDeliveryNotAvailable: "Free delivery does not apply at this distance.",
    selectItem: "Mark item to pay",
    selectionHint: "Only the selected items will be paid now.",
    selectAll: "Select all",
    clearSelection: "Clear selection",
    selectedSummary: (selected: number, total: number) =>
      `${selected} of ${total} items selected`,
    selectToContinue: "Select at least one item to pay.",
    continue: "Continue to checkout",
    close: "Close",
    remove: "Remove",
    share: "Share cart",
    estimatedDelivery: "Estimated delivery",
    deliveryPendingItem: "Calculated at confirmation",
    deliveryReviewItem: "Address under review",
    deliveryUnavailableItem: "No delivery in your area",
    arrivesOn: (when: string) => `Arrives ${when}`,
    arrivesBetween: (from: string, to: string) => `Arrives between ${from} and ${to}`,
    outOfStockNow: "Out of stock for now",
    savedForLater: "Saved in your cart for a future purchase.",
    availableNow: (stock: number) => `${stock} available now`,
  },
  pt: {
    title: "Carrinho",
    empty: "Seu carrinho esta salvo e vazio por enquanto.",
    subtotal: "Subtotal",
    total: "Total",
    deliveryFee: "Entrega",
    deliveryPending: "Calculado ao confirmar o endereco",
    addressMissing: "Adicione seu endereco na conta para ver o custo real da entrega.",
    deliveryUnavailable: "Ainda nao temos entrega disponivel na sua area.",
    deliveryReview: "Seu endereco precisa de revisao manual antes do envio.",
    freeDelivery: "Gratis",
    freeDeliveryGoal: "Entrega gratis",
    freeDeliveryUnlocked: "Voce ja desbloqueou entrega gratis para este carrinho.",
    freeDeliveryRemaining: (amount: number) =>
      `Faltam ${formatCurrency(amount)} para entrega gratis.`,
    freeDeliveryNotAvailable: "Entrega gratis nao se aplica a essa distancia.",
    selectItem: "Marcar artigo para pagar",
    selectionHint: "Somente os artigos selecionados serao pagos agora.",
    selectAll: "Selecionar tudo",
    clearSelection: "Limpar selecao",
    selectedSummary: (selected: number, total: number) =>
      `${selected} de ${total} artigos selecionados`,
    selectToContinue: "Selecione pelo menos um artigo para pagar.",
    continue: "Continuar para checkout",
    close: "Fechar",
    remove: "Remover",
    share: "Compartilhar carrinho",
    estimatedDelivery: "Entrega estimada",
    deliveryPendingItem: "Calculada na confirmacao",
    deliveryReviewItem: "Endereco em revisao",
    deliveryUnavailableItem: "Sem entrega na sua area",
    arrivesOn: (when: string) => `Chega ${when}`,
    arrivesBetween: (from: string, to: string) => `Chega entre ${from} e ${to}`,
    outOfStockNow: "Sem estoque por agora",
    savedForLater: "Fica salvo no carrinho para compra futura.",
    availableNow: (stock: number) => `${stock} disponiveis agora`,
  },
} as const;

const INTL_LOCALE_BY_APP_LOCALE: Record<Locale, string> = {
  es: "es-SR",
  nl: "nl-SR",
  en: "en-US",
  pt: "pt-BR",
};

function getCalendarDayDistance(baseDate: Date, targetDate: Date) {
  const startOfBaseDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const startOfTargetDate = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate()
  );

  return Math.max(
    0,
    Math.round((startOfTargetDate.getTime() - startOfBaseDate.getTime()) / 86_400_000)
  );
}

function formatRelativeArrivalDay(
  locale: Locale,
  isoDate: string,
  baseDate: Date
) {
  const targetDate = new Date(isoDate);

  if (Number.isNaN(targetDate.getTime())) {
    return null;
  }

  const weekday = new Intl.DateTimeFormat(INTL_LOCALE_BY_APP_LOCALE[locale], {
    weekday: "long",
  }).format(targetDate);
  const dayDistance = getCalendarDayDistance(baseDate, targetDate);
  const usesCurrentWeek = dayDistance <= 6;

  switch (locale) {
    case "es":
      return usesCurrentWeek ? `este ${weekday}` : `el proximo ${weekday}`;
    case "nl":
      return usesCurrentWeek ? `deze ${weekday}` : `volgende ${weekday}`;
    case "pt":
      return usesCurrentWeek ? `nesta ${weekday}` : `na proxima ${weekday}`;
    case "en":
    default:
      return usesCurrentWeek ? `this ${weekday}` : `next ${weekday}`;
  }
}

interface CartPanelProps {
  cart: CartEntry[];
  locale: Locale;
  onClose: () => void;
  selectedCartKeys?: string[];
  selectedEntryCount?: number;
  onToggleSelection?: (cartKey: string) => void;
  onRemove: (cartKey: string) => void;
  onChangeQuantity: (cartKey: string, quantity: number) => void;
  onProceed: () => void;
  onOpenItem?: (entry: CartEntry) => void;
  onShare?: () => void;
  customerAddress?: string;
  deliveryQuote?: {
    distanceKm: number;
    fee: number;
    allowsDelivery: boolean;
    isValidSurinameAddress: boolean;
    requiresAgentReview: boolean;
    isFree: boolean;
    freeDeliveryMinimum: number | null;
  } | null;
  dockRight?: number | string;
  dockWidth?: string;
  sharedMode?: boolean;
  sharedFromName?: string;
  onImportShared?: () => void;
}

export default function CartPanel({
  cart,
  locale,
  onClose,
  selectedCartKeys = [],
  selectedEntryCount = 0,
  onToggleSelection = () => undefined,
  onRemove,
  onChangeQuantity,
  onProceed,
  onOpenItem = () => undefined,
  onShare = () => undefined,
  customerAddress,
  deliveryQuote,
  dockRight = "1rem",
  dockWidth = "min(92vw, 24rem)",
  sharedMode = false,
  sharedFromName,
  onImportShared,
}: CartPanelProps) {
  const t = texts[locale];
  const effectiveSelectedCartKeys = sharedMode ? cart.map((entry) => entry.cartKey) : selectedCartKeys;
  const selectedCart = useMemo(
    () => cart.filter((entry) => effectiveSelectedCartKeys.includes(entry.cartKey)),
    [cart, effectiveSelectedCartKeys]
  );
  const totalSelectedEntryCount = sharedMode ? cart.length : selectedEntryCount;
  const containsHeavyItems = useMemo(
    () => selectedCart.some((entry) => entry.product.isHeavy),
    [selectedCart]
  );

  const subtotal = useMemo(() => {
    return selectedCart.reduce(
      (sum, entry) => sum + (entry.unitPrice ?? entry.product.price) * entry.quantity,
      0
    );
  }, [selectedCart]);

  const freeDeliveryProgress = useMemo(
    () =>
      getFreeDeliveryProgress(
        deliveryQuote?.allowsDelivery ? deliveryQuote.distanceKm : null,
        subtotal
      ),
    [deliveryQuote, subtotal]
  );
  const deliveryAmount =
    deliveryQuote?.allowsDelivery && !deliveryQuote.requiresAgentReview ? deliveryQuote.fee : 0;
  const total = subtotal + deliveryAmount;
  const showFreeDeliveryCard = freeDeliveryProgress.available && !containsHeavyItems;
  const deliveryLabel = useMemo(() => {
    if (!customerAddress?.trim()) {
      return t.addressMissing;
    }

    if (!deliveryQuote) {
      return t.deliveryPending;
    }

    if (deliveryQuote.requiresAgentReview) {
      return t.deliveryReview;
    }

    if (!deliveryQuote.allowsDelivery) {
      return t.deliveryUnavailable;
    }

    if (deliveryQuote.isFree) {
    return `${t.freeDelivery}${deliveryQuote.distanceKm > 0 ? ` · ${formatKilometers(deliveryQuote.distanceKm)}` : ""}`;
    }

  return `${formatCurrency(deliveryQuote.fee)}${deliveryQuote.distanceKm > 0 ? ` · ${formatKilometers(deliveryQuote.distanceKm)}` : ""}`;
  }, [customerAddress, deliveryQuote, t]);
  const freeDeliveryMessage = useMemo(() => {
    if (!customerAddress?.trim()) {
      return t.addressMissing;
    }

    if (!deliveryQuote) {
      return t.deliveryPending;
    }

    if (!deliveryQuote?.allowsDelivery || deliveryQuote.requiresAgentReview) {
      return deliveryQuote?.requiresAgentReview ? t.deliveryReview : t.freeDeliveryNotAvailable;
    }

    if (!freeDeliveryProgress.available || !freeDeliveryProgress.minimum) {
      return t.freeDeliveryNotAvailable;
    }

    if (freeDeliveryProgress.isUnlocked) {
      return t.freeDeliveryUnlocked;
    }

    return t.freeDeliveryRemaining(freeDeliveryProgress.remaining ?? 0);
  }, [customerAddress, deliveryQuote, freeDeliveryProgress, t]);
  const cartDeliveryEstimateText = useMemo(() => {
    if (!customerAddress?.trim()) {
      return t.deliveryPendingItem;
    }

    if (!deliveryQuote) {
      return t.deliveryPendingItem;
    }

    if (deliveryQuote.requiresAgentReview) {
      return t.deliveryReviewItem;
    }

    if (!deliveryQuote.allowsDelivery) {
      return t.deliveryUnavailableItem;
    }

    const estimate = getDeliveryEstimateDetails({
      distanceKm: deliveryQuote.distanceKm,
      locale,
      baseDate: new Date(),
    });

    if (!estimate) {
      return t.deliveryPendingItem;
    }

    const baseDate = new Date();
    const earliestArrival = formatRelativeArrivalDay(locale, estimate.earliestDate, baseDate);
    const latestArrival = estimate.isRange
      ? formatRelativeArrivalDay(locale, estimate.latestDate, baseDate)
      : null;

    if (estimate.isRange) {
      return t.arrivesBetween(
        earliestArrival ?? estimate.dateText,
        latestArrival ?? estimate.dateText
      );
    }

    return t.arrivesOn(earliestArrival ?? estimate.dateText);
  }, [customerAddress, deliveryQuote, locale, t]);

  const dockPositionStyle = useMemo<CSSProperties | undefined>(() => {
    if (sharedMode) {
      return undefined;
    }

    if (typeof dockRight === "number") {
      return { right: `${dockRight}px` };
    }

    return { right: dockRight };
  }, [dockRight, sharedMode]);

  const cartPanelStyle = useMemo(
    () => ({
      maxHeight: "calc(100dvh - 1rem)",
      ...(sharedMode ? {} : { width: dockWidth }),
    }),
    [dockWidth, sharedMode]
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/18 backdrop-blur-[2px]">
      <button type="button" aria-label={t.close} onClick={onClose} className="absolute inset-0" />

      <div
        className={`pointer-events-none absolute flex ${
          sharedMode
            ? "inset-0 items-center justify-center p-4"
            : "bottom-1.5 sm:bottom-5"
        }`}
        style={dockPositionStyle}
      >
        <div
          className={`pointer-events-auto flex w-full flex-col overflow-hidden rounded-[2rem] border border-slate-800 bg-[#050816]/96 text-white shadow-[0_24px_80px_rgba(0,0,0,0.46)] ${
            sharedMode ? "max-w-[min(96vw,28rem)] sm:max-w-[min(92vw,28rem)]" : "w-full"
          }`}
          style={cartPanelStyle}
        >
          <div className="flex items-center justify-between border-b border-slate-800 bg-[#03050f]/92 px-3 py-3 sm:px-5 sm:py-4">
            <div className="flex items-center gap-3">
              <span className="cart-control-badge cart-control-badge--cart">
                <svg
                  viewBox="0 0 24 24"
                  className="cart-control-icon"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="20" r="1" />
                  <circle cx="18" cy="20" r="1" />
                  <path d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L21 7H7" />
                </svg>
              </span>
              {sharedMode ? (
                <div>
                  <p className="text-xs font-semibold text-white sm:text-sm">{sharedFromName || t.share}</p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:text-[11px]">
                    {t.share}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {!sharedMode ? (
                <div className="group relative">
                  <button
                    type="button"
                    onClick={onShare}
                    onPointerDown={(event) => event.stopPropagation()}
                    className="cart-control-btn cart-control-btn--ghost"
                    aria-label={t.share}
                    title={t.share}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="cart-control-icon"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M7 12v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-5" />
                      <path d="M15 3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" />
                    </svg>
                  </button>
                  <span className="pointer-events-none absolute -top-10 left-1/2 z-20 -translate-x-1/2 translate-y-2 rounded-full border border-cyan-500/20 bg-[#030611] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                    {t.share}
                  </span>
                </div>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                onPointerDown={(event) => event.stopPropagation()}
                className="cart-control-btn cart-control-btn--ghost"
                aria-label={t.close}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="cart-control-icon"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 6l12 12" />
                  <path d="M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>

          <div className="scrollbar-hidden flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
            {cart.length === 0 ? (
              <div className="rounded-[1.75rem] border border-dashed border-slate-700 bg-[#0a1020] px-5 py-8 text-center text-sm text-slate-400">
                {t.empty}
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((entry) => {
                  const availableStock = getProductAvailableStock(entry.product);
                  const isPayableEntry = isCartEntryPayable(entry.product);
                  const isSelected =
                    isPayableEntry && effectiveSelectedCartKeys.includes(entry.cartKey);

                  return (
                  <article
                    key={entry.cartKey}
                    className="relative overflow-hidden rounded-[1.15rem] sm:rounded-[1.35rem]"
                  >
                    <div
                      className={`relative rounded-[1.15rem] border border-slate-800 bg-[#0a1020] p-3 transition duration-200 ease-out sm:rounded-[1.35rem] sm:p-3.5 ${
                        !sharedMode && !isSelected ? "opacity-55" : ""
                      }`}
                    >
                      {!sharedMode ? (
                        <div className="cntr cart-selection-toggle cart-corner-control cart-corner-control--left">
                          <input
                            id={`cart-select-${entry.cartKey}`}
                            type="checkbox"
                            checked={isSelected}
                            disabled={!isPayableEntry}
                            onChange={() => onToggleSelection(entry.cartKey)}
                            onPointerDown={(event) => event.stopPropagation()}
                            aria-label={t.selectItem}
                            className="hidden-xs-up cart-selection-toggle__input"
                          />
                          <label
                            htmlFor={`cart-select-${entry.cartKey}`}
                            className="cbx"
                            title={t.selectItem}
                            onPointerDown={(event) => event.stopPropagation()}
                            aria-hidden="true"
                          />
                        </div>
                      ) : null}
                      {!sharedMode ? (
                        <button
                          type="button"
                          onClick={() => onRemove(entry.cartKey)}
                          onPointerDown={(event) => event.stopPropagation()}
                          className="cart-control-btn cart-control-btn--danger cart-corner-control cart-corner-control--right"
                          aria-label={t.remove}
                          title={t.remove}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="cart-control-icon"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M6 6l12 12" />
                            <path d="M18 6L6 18" />
                          </svg>
                        </button>
                      ) : null}
                    <div className={`flex gap-3 sm:gap-4 ${!sharedMode ? "pt-6" : ""}`}>
                      <div className="h-16 w-16 overflow-hidden rounded-[0.95rem] border border-slate-800 bg-[#02040c] sm:h-20 sm:w-20 sm:rounded-[1rem]">
                        {entry.product.image ? (
                          <button
                            type="button"
                            onClick={() => onOpenItem(entry)}
                            onPointerDown={(event) => event.stopPropagation()}
                            className="block h-full w-full"
                          >
                            <img
                              src={entry.selectedImage || entry.product.image}
                              alt={entry.product.name}
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => onOpenItem(entry)}
                              onPointerDown={(event) => event.stopPropagation()}
                              className="block max-w-full truncate text-left text-xs font-semibold text-white transition hover:text-cyan-300 sm:text-sm"
                            >
                              {entry.product.name}
                            </button>
                            <div className="mt-1 space-y-0.5">
                              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200/90 sm:text-[10px]">
                                {t.estimatedDelivery}
                              </p>
                              <p className="text-[10px] font-medium leading-tight text-slate-100 drop-shadow-[0_1px_10px_rgba(125,211,252,0.14)] sm:text-[11px]">
                                {cartDeliveryEstimateText}
                              </p>
                            </div>
                            <div className="mt-1 space-y-0.5">
                              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-pink-200/90 sm:text-[10px]">
                                {availableStock > 0 ? t.availableNow(availableStock) : t.outOfStockNow}
                              </p>
                              {!isPayableEntry ? (
                                <p className="text-[10px] font-medium leading-tight text-rose-200/95 sm:text-[11px]">
                                  {t.savedForLater}
                                </p>
                              ) : null}
                            </div>
                            {entry.selectedVariantName || entry.selectedColor ? (
                              <p className="mt-1 truncate text-[10px] text-cyan-300 sm:text-[11px]">
                                {[entry.selectedVariantName, entry.selectedColor]
                                  .filter(Boolean)
                                  .join(" / ")}
                              </p>
                            ) : null}
                          </div>

                          {!sharedMode ? <span className="w-8 shrink-0" aria-hidden="true" /> : null}
                        </div>

                        <div className="mt-2.5 flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-cyan-300 sm:text-sm">
                            {formatCurrency(entry.unitPrice ?? entry.product.price)}
                          </p>
                          <div className="cart-stepper-shell">
                            <button
                              type="button"
                              onClick={() => onChangeQuantity(entry.cartKey, Math.max(1, entry.quantity - 1))}
                              onPointerDown={(event) => event.stopPropagation()}
                              disabled={sharedMode || entry.quantity <= 1 || availableStock <= 0}
                              className="cart-control-btn cart-control-btn--stepper"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="cart-control-icon"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                              >
                                <path d="M6 12h12" />
                              </svg>
                            </button>
                            <span className="cart-stepper-value text-center text-sm font-semibold text-black">
                              {entry.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => onChangeQuantity(entry.cartKey, entry.quantity + 1)}
                              onPointerDown={(event) => event.stopPropagation()}
                              disabled={sharedMode || availableStock <= 0 || entry.quantity >= availableStock}
                              className="cart-control-btn cart-control-btn--primary"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="cart-control-icon"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                              >
                                <path d="M12 6v12" />
                                <path d="M6 12h12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    </div>
                  </article>
                  );
                })}
              </div>
            )}
          </div>

          {cart.length > 0 ? (
            <div className="border-t border-slate-800 bg-[#03050f]/94 px-4 py-4 sm:px-5">
              {showFreeDeliveryCard ? (
                <div className="cart-free-delivery-card relative mb-4 overflow-hidden rounded-[1.35rem] border border-emerald-500/20 bg-emerald-500/10 px-3 py-3">
                  {freeDeliveryProgress.isUnlocked ? (
                    <div className="cart-free-delivery-burst" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                    <span>{t.freeDeliveryGoal}</span>
                    <span>
                      {freeDeliveryProgress.minimum
                        ? formatCurrency(freeDeliveryProgress.minimum)
                        : "--"}
                    </span>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-emerald-950/70">
                    <div
                      className={`h-full rounded-full bg-[linear-gradient(90deg,#22c55e,#4ade80,#86efac)] transition-[width] duration-500 ${
                        freeDeliveryProgress.isUnlocked ? "cart-free-delivery-bar--celebrate" : ""
                      }`}
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, (freeDeliveryProgress.progress || 0) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-emerald-100/90">{freeDeliveryMessage}</p>
                </div>
              ) : null}
              {!sharedMode && totalSelectedEntryCount === 0 ? (
                <div className="mb-4 rounded-[1.15rem] border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-xs text-amber-100">
                  {t.selectToContinue}
                </div>
              ) : null}
              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>{t.subtotal}</span>
                  <span className="font-semibold text-white">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t.deliveryFee}</span>
                  <span className="text-right font-semibold text-white">{deliveryLabel}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                  <span className="text-sm font-semibold text-white">{t.total}</span>
                  <span className="text-lg font-semibold text-white">{formatCurrency(total)}</span>
                </div>
              </div>

              {sharedMode ? (
                <button
                  type="button"
                  onClick={onImportShared}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-cyan-500 px-5 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  {(sharedFromName || t.share) + " a mi carro"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onProceed}
                  disabled={totalSelectedEntryCount === 0}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-cyan-500 px-5 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                >
                  {t.continue}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
