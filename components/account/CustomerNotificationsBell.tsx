"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { formatPickupLabel } from "@/lib/shop/checkout";
import { formatCurrencySrd } from "@/lib/shop/number-format";
import type {
  CustomerNotification,
  CustomerNotificationOrderSummary,
  Locale,
  SessionUser,
} from "@/lib/shop/types";

type NotificationsResponse = {
  success?: boolean;
  notifications?: CustomerNotification[];
  pendingOrders?: CustomerNotificationOrderSummary[];
  unreadCount?: number;
};

const texts = {
  es: {
    title: "Notificaciones",
    subtitle: "Pedidos y mensajes importantes",
    pendingOrders: "Pedidos pendientes",
    importantMessages: "Mensajes importantes",
    empty: "No hay novedades activas ahora mismo.",
    confirmed: "Confirmado",
    processed: "Procesado",
    inTransit: "En camino",
    delivered: "Entregado",
    lastMessage: "Ultimo mensaje",
    address: "Direccion",
    date: "Fecha",
    total: "Total",
    order: "Pedido",
    pickupFor: "Recogida programada",
    close: "Cerrar",
    routeMessage: "Tu pedido va rumbo a tu direccion.",
    processingMessage: "Tu pedido ya esta siendo preparado.",
    confirmedMessage: "Tu pedido fue confirmado y entro a la fila.",
    deliveredMessage: "Tu pedido ya fue completado.",
  },
  nl: {
    title: "Meldingen",
    subtitle: "Bestellingen en belangrijke berichten",
    pendingOrders: "Openstaande bestellingen",
    importantMessages: "Belangrijke berichten",
    empty: "Er zijn nu geen actieve updates.",
    confirmed: "Bevestigd",
    processed: "Verwerkt",
    inTransit: "Onderweg",
    delivered: "Afgeleverd",
    lastMessage: "Laatste bericht",
    address: "Adres",
    date: "Datum",
    total: "Totaal",
    order: "Bestelling",
    pickupFor: "Afhaling gepland",
    close: "Sluiten",
    routeMessage: "Je bestelling is onderweg naar je adres.",
    processingMessage: "Je bestelling wordt nu klaargemaakt.",
    confirmedMessage: "Je bestelling is bevestigd en staat in de rij.",
    deliveredMessage: "Je bestelling is voltooid.",
  },
  en: {
    title: "Notifications",
    subtitle: "Orders and important messages",
    pendingOrders: "Pending orders",
    importantMessages: "Important messages",
    empty: "There are no active updates right now.",
    confirmed: "Confirmed",
    processed: "Processed",
    inTransit: "On the way",
    delivered: "Delivered",
    lastMessage: "Latest message",
    address: "Address",
    date: "Date",
    total: "Total",
    order: "Order",
    pickupFor: "Pickup scheduled",
    close: "Close",
    routeMessage: "Your order is on the way to your address.",
    processingMessage: "Your order is already being prepared.",
    confirmedMessage: "Your order was confirmed and entered the queue.",
    deliveredMessage: "Your order has been completed.",
  },
  pt: {
    title: "Notificacoes",
    subtitle: "Pedidos e mensagens importantes",
    pendingOrders: "Pedidos pendentes",
    importantMessages: "Mensagens importantes",
    empty: "Nao ha novidades ativas agora.",
    confirmed: "Confirmado",
    processed: "Processado",
    inTransit: "A caminho",
    delivered: "Entregue",
    lastMessage: "Ultima mensagem",
    address: "Endereco",
    date: "Data",
    total: "Total",
    order: "Pedido",
    pickupFor: "Retirada agendada",
    close: "Fechar",
    routeMessage: "Seu pedido esta a caminho do seu endereco.",
    processingMessage: "Seu pedido ja esta sendo preparado.",
    confirmedMessage: "Seu pedido foi confirmado e entrou na fila.",
    deliveredMessage: "Seu pedido foi concluido.",
  },
} as const;

interface CustomerNotificationsBellProps {
  locale: Locale;
  user: SessionUser | null;
  buttonClassName: string;
}

function formatDate(value: string, locale: Locale) {
  try {
    return new Intl.DateTimeFormat(
      locale === "nl" ? "nl-NL" : locale === "pt" ? "pt-BR" : locale === "en" ? "en-US" : "es-SR",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    ).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}

function getCustomerTimelineStep(status: string) {
  if (status === "Pedido completado") {
    return 3;
  }

  if (status === "En delivery") {
    return 2;
  }

  if (
    [
      "Confirmando stock",
      "Preparando pedido",
      "Pagada / Preparando",
      "Pedido listo para delivery",
      "Procesandose para delivery",
    ].includes(status)
  ) {
    return 1;
  }

  return 0;
}

function formatCustomerNotificationPickupLabel(
  order: Pick<CustomerNotificationOrderSummary, "pickupDate" | "pickupTime">
) {
  if (!order.pickupDate || !order.pickupTime) {
    return null;
  }

  return formatPickupLabel(order.pickupDate, order.pickupTime);
}

export default function CustomerNotificationsBell({
  locale,
  user,
  buttonClassName,
}: CustomerNotificationsBellProps) {
  const t = texts[locale];
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [pendingOrders, setPendingOrders] = useState<CustomerNotificationOrderSummary[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const hasVisibleBell = Boolean(user && (notifications.length > 0 || pendingOrders.length > 0));
  const unreadIds = useMemo(
    () => notifications.filter((notification) => !notification.readAt).map((notification) => notification.id),
    [notifications]
  );

  const loadNotifications = useCallback(
    async (showLoading = false) => {
      if (!user) {
        setNotifications([]);
        setPendingOrders([]);
        setUnreadCount(0);
        return;
      }

      if (showLoading) {
        setLoading(true);
      }

      try {
        const response = await fetch("/api/account/notifications", {
          cache: "no-store",
        });
        const payload = (await response.json()) as NotificationsResponse;

        if (!response.ok || !payload.success) {
          throw new Error("No se pudieron cargar las notificaciones.");
        }

        setNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
        setPendingOrders(Array.isArray(payload.pendingOrders) ? payload.pendingOrders : []);
        setUnreadCount(Math.max(0, Number(payload.unreadCount ?? 0)));
      } catch (error) {
        console.error("[customer-notifications] failed to load panel data:", error);
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [user]
  );

  const markRead = useCallback(async () => {
    if (!user || unreadIds.length === 0) {
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        unreadIds.includes(notification.id)
          ? {
              ...notification,
              readAt: new Date().toISOString(),
            }
          : notification
      )
    );
    setUnreadCount(0);

    try {
      await fetch("/api/account/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: unreadIds }),
      });
    } catch (error) {
      console.error("[customer-notifications] failed to mark notifications as read:", error);
    }
  }, [unreadIds, user]);

  useEffect(() => {
    setPanelOpen(false);
    void loadNotifications(true);
  }, [loadNotifications]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        void loadNotifications(false);
      }
    };

    refreshIfVisible();
    const intervalId = window.setInterval(refreshIfVisible, 75_000);
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, [loadNotifications, user]);

  useEffect(() => {
    if (!panelOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPanelOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [panelOpen]);

  useEffect(() => {
    if (!panelOpen || unreadIds.length === 0) {
      return;
    }

    void markRead();
  }, [markRead, panelOpen, unreadIds.length]);

  if (!user || !hasVisibleBell) {
    return null;
  }

  const latestMessageByOrderId = new Map<string, string>();

  for (const notification of notifications) {
    if (!notification.orderId || latestMessageByOrderId.has(notification.orderId)) {
      continue;
    }

    latestMessageByOrderId.set(notification.orderId, notification.message);
  }

  const timelineLabels = [t.confirmed, t.processed, t.inTransit, t.delivered];

  return (
    <div ref={wrapperRef} className="relative min-w-0 shrink-0 basis-[3.55rem] md:basis-auto">
      <button
        type="button"
        onClick={() => {
          setPanelOpen((current) => !current);
        }}
        className={buttonClassName}
        aria-label={t.title}
        title={t.title}
      >
        <span className="storefront-cosmic-button__text whitespace-nowrap">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="mx-auto h-[1.28rem] w-[1.28rem]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.03 2.03 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0m6 0H9"
            />
          </svg>
        </span>
        <span className="storefront-cosmic-button__stars-container" aria-hidden="true">
          <span className="storefront-cosmic-button__stars" />
        </span>
        <span className="storefront-cosmic-button__glow" aria-hidden="true">
          <span className="storefront-cosmic-button__circle" />
          <span className="storefront-cosmic-button__circle" />
        </span>
        {unreadCount > 0 ? (
          <span className="storefront-cosmic-button__badge storefront-cosmic-button__badge--support">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {panelOpen ? (
        <div className="customer-notification-panel absolute left-0 top-[calc(100%+0.7rem)] z-[85] w-[min(92vw,24rem)] overflow-hidden rounded-[1.45rem] border border-cyan-400/20 bg-[#061120]/96 text-white shadow-[0_24px_80px_rgba(0,0,0,0.46)] backdrop-blur-xl md:left-auto md:right-0">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
                {t.title}
              </p>
              <p className="text-xs text-slate-300">{t.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPanelOpen(false);
              }}
              className="text-lg leading-none text-slate-300 transition hover:text-white"
              aria-label={t.close}
            >
              X
            </button>
          </div>

          <div className="max-h-[min(72vh,34rem)] overflow-y-auto px-4 py-3">
            {loading ? (
              <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-5 text-center text-sm text-slate-300">
                {t.subtitle}
              </div>
            ) : notifications.length > 0 || pendingOrders.length > 0 ? (
              <div className="space-y-4">
                {notifications.length > 0 ? (
                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-300/85">
                        {t.importantMessages}
                      </h3>
                      {unreadCount > 0 ? (
                        <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                          {unreadCount}
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      {notifications.map((notification) => (
                        <article
                          key={notification.id}
                          className={`rounded-[1rem] border px-3 py-3 ${
                            notification.readAt
                              ? "border-white/8 bg-white/5"
                              : "border-cyan-400/20 bg-cyan-500/10"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white">{notification.title}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-300">{notification.message}</p>
                            </div>
                            {!notification.readAt ? (
                              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.7)]" />
                            ) : null}
                          </div>
                          <p className="mt-2 text-[11px] text-slate-400">
                            {formatDate(notification.createdAt, locale)}
                          </p>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                {pendingOrders.length > 0 ? (
                  <section className="space-y-2">
                    <h3 className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cyan-300/85">
                      {t.pendingOrders}
                    </h3>
                    <div className="space-y-2">
                      {pendingOrders.map((order) => (
                        <article
                          key={order.id}
                          className="space-y-3 rounded-[1rem] border border-white/10 bg-white/5 px-3 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-lg font-semibold text-white">
                                {getCustomerTimelineStep(order.status) >= 2
                                  ? t.routeMessage
                                  : getCustomerTimelineStep(order.status) >= 1
                                    ? t.processingMessage
                                    : order.status === "Pedido completado"
                                      ? t.deliveredMessage
                                      : t.confirmedMessage}
                              </p>
                              <p className="mt-1 text-sm text-slate-300">
                                {t.order} {order.id}{" "}
                                {order.deliveryType === "pickup"
                                  ? formatCustomerNotificationPickupLabel(order)
                                  : t.routeMessage}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-white">
                              {formatCurrencySrd(order.total)}
                            </span>
                          </div>

                          <div className="rounded-[1rem] border border-[#d8e4ef] bg-[#f8fbff] px-3 py-3 text-slate-900">
                            <div className="grid grid-cols-4 gap-2">
                              {timelineLabels.map((label, index) => {
                                const step = getCustomerTimelineStep(order.status);
                                const isCompleted = index <= step;
                                const isCurrent = index === step;

                                return (
                                  <div key={`${order.id}-${label}`} className="text-center">
                                    <div className="relative flex items-center justify-center">
                                      {index > 0 ? (
                                        <span
                                          className={`absolute right-1/2 top-1/2 h-[2px] w-full -translate-y-1/2 ${
                                            index - 1 < step ? "bg-[#15803d]" : "bg-[#d7dee7]"
                                          }`}
                                        />
                                      ) : null}
                                      <span
                                        className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-[12px] font-semibold ${
                                          isCompleted
                                            ? isCurrent && step === 2
                                              ? "border-[#1d4ed8] bg-[#1d4ed8] text-white"
                                              : "border-[#15803d] bg-[#15803d] text-white"
                                            : "border-[#d7dee7] bg-white text-[#94a3b8]"
                                        }`}
                                      >
                                        {index + 1}
                                      </span>
                                    </div>
                                    <p
                                      className={`mt-2 text-[10px] font-semibold ${
                                        isCompleted
                                          ? isCurrent && step === 2
                                            ? "text-[#1d4ed8]"
                                            : "text-[#0f766e]"
                                          : "text-[#94a3b8]"
                                      }`}
                                    >
                                      {label}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {order.lastMessage ?? latestMessageByOrderId.get(order.id) ? (
                            <p className="line-clamp-2 text-[11px] text-slate-400">
                              <span className="font-semibold text-slate-300">{t.lastMessage}:</span>{" "}
                              {order.lastMessage ?? latestMessageByOrderId.get(order.id)}
                            </p>
                          ) : null}
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[11px] text-slate-400">
                              {formatDate(order.createdAt, locale)}
                            </span>
                            <span className="text-[11px] text-slate-300">
                              {order.deliveryType === "pickup"
                                ? t.pickupFor
                                : order.status}
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : (
              <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-5 text-center text-sm text-slate-300">
                {t.empty}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
