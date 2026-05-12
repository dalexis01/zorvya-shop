"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import AddressAutocompleteField from "@/components/AddressAutocompleteField";
import OrdersPanel from "@/components/account/OrdersPanel";
import {
  applyClientTheme,
  readStoredClientTheme,
  type ClientTheme,
} from "@/lib/shop/client-theme";
import { readStoredLocale, writeStoredLocale } from "@/lib/shop/locale-storage";
import type {
  CatalogProductOption,
  Locale,
  OrderLineItem,
  OrderSummary,
  SessionUser,
} from "@/lib/shop/types";

type FormErrors = Record<string, string[]>;

type AuthResponse = {
  success?: boolean;
  user?: SessionUser | null;
  errors?: FormErrors;
};

type OrdersResponse = {
  orders?: OrderSummary[];
  latestOrder?: OrderSummary | null;
  hasMore?: boolean;
  nextCursor?: string | null;
};

type OrderMutationResponse = {
  success?: boolean;
  error?: string;
  errors?: FormErrors;
  order?: OrderSummary;
};

type OrderNotice = {
  type: "success" | "error";
  message: string;
};

type CachedAccountOrders = {
  cachedAt: number;
  latestOrder: OrderSummary | null;
  orders: OrderSummary[];
  hasMore: boolean;
  nextCursor: string | null;
};

const ACCOUNT_ORDERS_CACHE_TTL_MS = 60_000;
const accountOrdersCache = new Map<string, CachedAccountOrders>();

function getCachedAccountOrders(userId: string) {
  return accountOrdersCache.get(userId) ?? null;
}

function setCachedAccountOrders(
  userId: string,
  value: {
    latestOrder: OrderSummary | null;
    orders: OrderSummary[];
    hasMore: boolean;
    nextCursor: string | null;
  }
) {
  accountOrdersCache.set(userId, {
    cachedAt: Date.now(),
    latestOrder: value.latestOrder,
    orders: value.orders,
    hasMore: value.hasMore,
    nextCursor: value.nextCursor,
  });
}

function clearCachedAccountOrders(userId?: string | null) {
  if (userId) {
    accountOrdersCache.delete(userId);
    return;
  }

  accountOrdersCache.clear();
}

type OrderActionResult = {
  success: boolean;
  errorMessage?: string;
};

const texts = {
  es: {
    account: "Cuenta",
    login: "Iniciar sesion",
    register: "Crear cuenta",
    profile: "Perfil",
    orders: "Ordenes",
    logout: "Cerrar sesion",
    name: "Nombre",
    email: "Correo",
    phone: "Telefono",
    address: "Direccion",
    password: "Contrasena",
    confirmPassword: "Confirmar contrasena",
    memberSince: "Miembro desde",
    loading: "Cargando cuenta...",
    noData: "No registrado todavia.",
    latestStatus: "Estado actual del ultimo pedido",
    requestError: "No se pudo completar la solicitud.",
    cancelSuccess: "El pedido fue cancelado correctamente.",
    updateSuccess: "El pedido fue actualizado correctamente.",
    issueSuccess: "El problema fue enviado a soporte correctamente.",
    acceptTerms: "Acepto los terminos y condiciones de uso",
    termsLink: "Leer terminos y condiciones",
    termsButton: "Terminos y condiciones",
    editInfo: "Editar informacion",
    saveInfo: "Guardar cambios",
    saving: "Guardando...",
    profileSaved: "La informacion de tu cuenta fue actualizada.",
    languages: "Idiomas",
    appearance: "Pantalla",
    lightMode: "Modo claro",
    changeEmailCode: "Enviar codigo al nuevo correo",
    confirmEmailCode: "Confirmar correo",
    code: "Codigo",
    emailCodeSent: "Te enviamos un codigo al nuevo correo.",
    themeLabel: "Cambiar luz",
  },
  nl: {
    account: "Account",
    login: "Inloggen",
    register: "Account maken",
    profile: "Profiel",
    orders: "Bestellingen",
    logout: "Uitloggen",
    name: "Naam",
    email: "E-mail",
    phone: "Telefoon",
    address: "Adres",
    password: "Wachtwoord",
    confirmPassword: "Wachtwoord bevestigen",
    memberSince: "Lid sinds",
    loading: "Account laden...",
    noData: "Nog niet ingevuld.",
    latestStatus: "Huidige status van de laatste bestelling",
    requestError: "De aanvraag kon niet worden voltooid.",
    cancelSuccess: "De bestelling is geannuleerd.",
    updateSuccess: "De bestelling is bijgewerkt.",
    issueSuccess: "Het probleem is naar support verzonden.",
    acceptTerms: "Ik accepteer de gebruiksvoorwaarden",
    termsLink: "Lees de voorwaarden",
    termsButton: "Voorwaarden",
    editInfo: "Gegevens bewerken",
    saveInfo: "Wijzigingen opslaan",
    saving: "Opslaan...",
    profileSaved: "Je accountgegevens zijn bijgewerkt.",
    languages: "Talen",
    appearance: "Scherm",
    lightMode: "Lichte modus",
    changeEmailCode: "Code naar nieuw e-mailadres sturen",
    confirmEmailCode: "E-mail bevestigen",
    code: "Code",
    emailCodeSent: "We hebben een code naar het nieuwe e-mailadres gestuurd.",
    themeLabel: "Licht wisselen",
  },
  en: {
    account: "Account",
    login: "Log in",
    register: "Create account",
    profile: "Profile",
    orders: "Orders",
    logout: "Log out",
    name: "Name",
    email: "Email",
    phone: "Phone",
    address: "Address",
    password: "Password",
    confirmPassword: "Confirm password",
    memberSince: "Member since",
    loading: "Loading account...",
    noData: "Not provided yet.",
    latestStatus: "Current latest order status",
    requestError: "The request could not be completed.",
    cancelSuccess: "The order was canceled successfully.",
    updateSuccess: "The order was updated successfully.",
    issueSuccess: "The issue was sent to support successfully.",
    acceptTerms: "I accept the terms and conditions of use",
    termsLink: "Read terms and conditions",
    termsButton: "Terms and conditions",
    editInfo: "Edit information",
    saveInfo: "Save changes",
    saving: "Saving...",
    profileSaved: "Your account information was updated.",
    languages: "Languages",
    appearance: "Display",
    lightMode: "Light mode",
    changeEmailCode: "Send code to new email",
    confirmEmailCode: "Confirm email",
    code: "Code",
    emailCodeSent: "We sent a code to the new email.",
    themeLabel: "Switch light",
  },
  pt: {
    account: "Conta",
    login: "Entrar",
    register: "Criar conta",
    profile: "Perfil",
    orders: "Pedidos",
    logout: "Sair",
    name: "Nome",
    email: "E-mail",
    phone: "Telefone",
    address: "Endereco",
    password: "Senha",
    confirmPassword: "Confirmar senha",
    memberSince: "Membro desde",
    loading: "Carregando conta...",
    noData: "Ainda nao informado.",
    latestStatus: "Status atual do ultimo pedido",
    requestError: "Nao foi possivel concluir a solicitacao.",
    cancelSuccess: "O pedido foi cancelado com sucesso.",
    updateSuccess: "O pedido foi atualizado com sucesso.",
    issueSuccess: "O problema foi enviado ao suporte com sucesso.",
    acceptTerms: "Aceito os termos e condicoes de uso",
    termsLink: "Ler termos e condicoes",
    termsButton: "Termos e condicoes",
    editInfo: "Editar informacoes",
    saveInfo: "Salvar alteracoes",
    saving: "Salvando...",
    profileSaved: "As informacoes da conta foram atualizadas.",
    languages: "Idiomas",
    appearance: "Tela",
    lightMode: "Modo claro",
    changeEmailCode: "Enviar codigo ao novo e-mail",
    confirmEmailCode: "Confirmar e-mail",
    code: "Codigo",
    emailCodeSent: "Enviamos um codigo ao novo e-mail.",
    themeLabel: "Trocar luz",
  },
} as const;

function collectFieldError(errors: FormErrors, field: string) {
  return errors[field]?.[0] ?? "";
}

function getOrderErrorMessage(payload: OrderMutationResponse, fallback: string) {
  const fieldError = Object.values(payload.errors ?? {})
    .flat()
    .find(Boolean);

  return payload.error ?? fieldError ?? fallback;
}

function mergeOrderSummary(existing: OrderSummary, incoming: OrderSummary) {
  return {
    ...existing,
    ...incoming,
    isLatest: existing.isLatest,
  };
}

function mergeUniqueOrderSummaries(
  existingOrders: OrderSummary[],
  incomingOrders: OrderSummary[]
) {
  const orderMap = new Map<string, OrderSummary>();

  for (const order of existingOrders) {
    orderMap.set(order.id, order);
  }

  for (const order of incomingOrders) {
    const currentOrder = orderMap.get(order.id);
    orderMap.set(order.id, currentOrder ? mergeOrderSummary(currentOrder, order) : order);
  }

  return Array.from(orderMap.values()).sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

interface AccountModalProps {
  locale: Locale;
  sessionReady: boolean;
  user: SessionUser | null;
  products: CatalogProductOption[];
  onOpenProduct?: (input: {
    productId: string | number;
    selectedVariantId?: string;
    selectedVariantName?: string;
    selectedColor?: string;
    selectedImage?: string;
  }) => void;
  onClose: () => void;
  onSessionChange: (user: SessionUser | null) => void;
}

export default function AccountModal({
  locale,
  sessionReady,
  user,
  products,
  onOpenProduct,
  onClose,
  onSessionChange,
}: AccountModalProps) {
  const t = texts[locale];
  const sessionChangeRef = useRef(onSessionChange);
  const previousUserIdRef = useRef<string | null>(user?.id ?? null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const ordersRef = useRef<OrderSummary[]>([]);
  const latestOrderRef = useRef<OrderSummary | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [activeTab, setActiveTab] = useState<"profile" | "orders">(
    user ? "orders" : "profile"
  );
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerAcceptedTerms, setRegisterAcceptedTerms] = useState(false);
  const [authErrors, setAuthErrors] = useState<FormErrors>({});
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [latestOrder, setLatestOrder] = useState<OrderSummary | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersLoadingMore, setOrdersLoadingMore] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [ordersHasMore, setOrdersHasMore] = useState(false);
  const [ordersNextCursor, setOrdersNextCursor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderPendingId, setOrderPendingId] = useState<string | null>(null);
  const [orderPendingAction, setOrderPendingAction] = useState<
    "cancel" | "add-items" | "update-contact" | "report-issue" | null
  >(null);
  const [orderNotice, setOrderNotice] = useState<OrderNotice | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileErrors, setProfileErrors] = useState<FormErrors>({});
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [accountTheme, setAccountTheme] = useState<ClientTheme>("dark");
  const [accountLocale, setAccountLocale] = useState<Locale>(locale);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

  useEffect(() => {
    sessionChangeRef.current = onSessionChange;
  }, [onSessionChange]);

  useEffect(() => {
    setAccountTheme(readStoredClientTheme("dark"));
  }, []);

  useEffect(() => {
    setAccountLocale(readStoredLocale(locale));
  }, [locale]);

  useEffect(() => {
    const currentUserId = user?.id ?? null;

    if (currentUserId && previousUserIdRef.current !== currentUserId) {
      setActiveTab("orders");
    }

    previousUserIdRef.current = currentUserId;
  }, [user?.id]);

  useEffect(() => {
    if (!languageMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setLanguageMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [languageMenuOpen]);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    latestOrderRef.current = latestOrder;
  }, [latestOrder]);

  useEffect(() => {
    if (!user) {
      setProfileName("");
      setProfileEmail("");
      setProfilePhone("");
      setProfileAddress("");
      setProfileErrors({});
      setProfileSuccess("");
      setEmailCode("");
      setEmailCodeSent(false);
      return;
    }

    setProfileName(user.name ?? "");
    setProfileEmail(user.email ?? "");
    setProfilePhone(user.phone ?? "");
    setProfileAddress(user.address ?? "");
    setProfileErrors({});
    setProfileSuccess("");
    setEmailCode("");
    setEmailCodeSent(false);
  }, [user]);

  const applyUpdatedOrder = useCallback((updatedOrder: OrderSummary) => {
    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.id === updatedOrder.id ? mergeOrderSummary(order, updatedOrder) : order
      )
    );

    setLatestOrder((currentLatest) => {
      if (!currentLatest || currentLatest.id !== updatedOrder.id) {
        return currentLatest;
      }

      return mergeOrderSummary(currentLatest, updatedOrder);
    });
  }, []);

  const loadOrders = useCallback(async (options?: { cursor?: string | null; append?: boolean }) => {
    if (!user?.id) {
      setOrders([]);
      setLatestOrder(null);
      setOrdersLoaded(false);
      setOrdersHasMore(false);
      setOrdersNextCursor(null);
      return;
    }

    const append = Boolean(options?.append);
    const cursor = options?.cursor ?? null;
    const cachedOrders = getCachedAccountOrders(user.id);
    const hasFreshCache =
      cachedOrders &&
      Date.now() - cachedOrders.cachedAt <= ACCOUNT_ORDERS_CACHE_TTL_MS;

    if (!append && cachedOrders) {
      setOrders(cachedOrders.orders);
      setLatestOrder(cachedOrders.latestOrder);
      setOrdersHasMore(cachedOrders.hasMore);
      setOrdersNextCursor(cachedOrders.nextCursor);
      setOrdersLoaded(true);
    }

    if (!append && hasFreshCache) {
      return;
    }

    if (append) {
      setOrdersLoadingMore(true);
    } else {
      setOrdersLoading(true);
    }

    try {
      const searchParams = new URLSearchParams({
        limit: "20",
      });

      if (cursor) {
        searchParams.set("cursor", cursor);
      }

      const response = await fetch(`/api/account/orders?${searchParams.toString()}`, {
        cache: "no-store",
      });

      if (response.status === 401) {
        clearCachedAccountOrders(user.id);
        sessionChangeRef.current(null);
        return;
      }

      const payload = (await response.json()) as OrdersResponse;
      const incomingOrders = payload.orders ?? [];

      const nextOrders = append
        ? mergeUniqueOrderSummaries(ordersRef.current, incomingOrders)
        : incomingOrders;
      const nextLatestOrder = append
        ? latestOrderRef.current ?? payload.latestOrder ?? incomingOrders[0] ?? null
        : payload.latestOrder ?? incomingOrders[0] ?? null;

      setOrders(nextOrders);
      setLatestOrder(nextLatestOrder);
      setOrdersHasMore(Boolean(payload.hasMore));
      setOrdersNextCursor(payload.nextCursor ?? null);
      setOrdersLoaded(true);
      setCachedAccountOrders(user.id, {
        orders: nextOrders,
        latestOrder: nextLatestOrder,
        hasMore: Boolean(payload.hasMore),
        nextCursor: payload.nextCursor ?? null,
      });
    } catch {
      if (!append) {
        setOrders([]);
        setLatestOrder(null);
        setOrdersHasMore(false);
        setOrdersNextCursor(null);
      }
      setOrdersLoaded(true);
    } finally {
      if (append) {
        setOrdersLoadingMore(false);
      } else {
        setOrdersLoading(false);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setLatestOrder(null);
      setOrdersLoaded(false);
      setOrdersHasMore(false);
      setOrdersNextCursor(null);
      setOrderNotice(null);
      setActiveTab("profile");
      return;
    }

    if (!ordersLoaded) {
      void loadOrders();
    }
  }, [loadOrders, ordersLoaded, user]);

  useEffect(() => {
    if (!user?.id || !ordersLoaded) {
      return;
    }

    setCachedAccountOrders(user.id, {
      orders,
      latestOrder,
      hasMore: ordersHasMore,
      nextCursor: ordersNextCursor,
    });
  }, [latestOrder, orders, ordersHasMore, ordersLoaded, ordersNextCursor, user?.id]);

  const loadMoreOrders = useCallback(async () => {
    if (!ordersNextCursor || ordersLoading || ordersLoadingMore) {
      return;
    }

    await loadOrders({
      cursor: ordersNextCursor,
      append: true,
    });
  }, [loadOrders, ordersLoading, ordersLoadingMore, ordersNextCursor]);

  async function handleAuthSubmit(
    endpoint: "/api/auth/login" | "/api/auth/register",
    body: Record<string, unknown>
  ) {
    setSubmitting(true);
    setAuthErrors({});

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as AuthResponse;

      if (!response.ok || !payload.user) {
        setAuthErrors(payload.errors ?? { general: [t.requestError] });
        return;
      }

      setOrderNotice(null);
      setOrdersLoaded(false);
      setOrdersHasMore(false);
      setOrdersNextCursor(null);
      setLoginPassword("");
      setRegisterPassword("");
      setRegisterConfirmPassword("");
      setRegisterAcceptedTerms(false);
      setActiveTab("orders");
      sessionChangeRef.current(payload.user);
    } catch {
      setAuthErrors({
        general: [t.requestError],
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setSubmitting(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      setOrders([]);
      setLatestOrder(null);
      setOrdersLoaded(false);
      setOrdersHasMore(false);
      setOrdersNextCursor(null);
      setAuthErrors({});
      setOrderNotice(null);
      clearCachedAccountOrders(user?.id ?? null);
      sessionChangeRef.current(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOrderMutation(
    orderId: string,
    action: "cancel" | "add-items" | "update-contact" | "report-issue",
    body: Record<string, unknown>,
    successMessage: string
  ): Promise<OrderActionResult> {
    setOrderPendingId(orderId);
    setOrderPendingAction(action);
    setOrderNotice(null);

    try {
      const response = await fetch(`/api/account/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as OrderMutationResponse;

      if (response.status === 401) {
        sessionChangeRef.current(null);
        return { success: false, errorMessage: t.requestError };
      }

      if (!response.ok || !payload.order) {
        const errorMessage = getOrderErrorMessage(payload, t.requestError);
        setOrderNotice({
          type: "error",
          message: errorMessage,
        });
        return { success: false, errorMessage };
      }

      applyUpdatedOrder(payload.order);
      setOrderNotice({
        type: "success",
        message: successMessage,
      });
      return { success: true };
    } catch {
      setOrderNotice({
        type: "error",
        message: t.requestError,
      });
      return { success: false, errorMessage: t.requestError };
    } finally {
      setOrderPendingId(null);
      setOrderPendingAction(null);
    }
  }

  async function handleCancelOrder(orderId: string) {
    return handleOrderMutation(
      orderId,
      "cancel",
      { action: "cancel" },
      t.cancelSuccess
    );
  }

  async function handleAddItems(orderId: string, items: OrderLineItem[]) {
    return handleOrderMutation(
      orderId,
      "add-items",
      {
        action: "add-items",
        products: items,
      },
      t.updateSuccess
    );
  }

  async function handleUpdateContact(
    orderId: string,
    payload: {
      phone?: string;
      address?: string;
    }
  ) {
    return handleOrderMutation(
      orderId,
      "update-contact",
      {
        action: "update-contact",
        ...payload,
      },
      t.updateSuccess
    );
  }

  async function handleReportIssue(orderId: string, message: string) {
    return handleOrderMutation(
      orderId,
      "report-issue",
      {
        action: "report-issue",
        message,
      },
      t.issueSuccess
    );
  }

  async function handleProfileSave() {
    setProfileSubmitting(true);
    setProfileErrors({});
    setProfileSuccess("");

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: profileName,
          phone: profilePhone,
          address: profileAddress,
        }),
      });

      const payload = (await response.json()) as AuthResponse & {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.success || !payload.user) {
        setProfileErrors(
          payload.errors ?? {
            general: [payload.error ?? t.requestError],
          }
        );
        return;
      }

      sessionChangeRef.current(payload.user);
      setProfileSuccess(t.profileSaved);
    } catch {
      setProfileErrors({
        general: [t.requestError],
      });
    } finally {
      setProfileSubmitting(false);
    }
  }

  async function handleEmailCodeRequest() {
    setProfileSubmitting(true);
    setProfileErrors({});
    setProfileSuccess("");

    try {
      const response = await fetch("/api/account/profile/email/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: profileEmail,
          locale: accountLocale,
        }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        errors?: FormErrors;
      };

      if (!response.ok || !payload.success) {
        setProfileErrors(payload.errors ?? { general: [t.requestError] });
        return;
      }

      setEmailCodeSent(true);
      setProfileSuccess(t.emailCodeSent);
    } catch {
      setProfileErrors({
        general: [t.requestError],
      });
    } finally {
      setProfileSubmitting(false);
    }
  }

  async function handleEmailCodeConfirm() {
    setProfileSubmitting(true);
    setProfileErrors({});
    setProfileSuccess("");

    try {
      const response = await fetch("/api/account/profile/email/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: profileEmail,
          code: emailCode,
        }),
      });

      const payload = (await response.json()) as AuthResponse & {
        success?: boolean;
      };

      if (!response.ok || !payload.success || !payload.user) {
        setProfileErrors(payload.errors ?? { general: [t.requestError] });
        return;
      }

      sessionChangeRef.current(payload.user);
      setEmailCode("");
      setEmailCodeSent(false);
      setProfileSuccess(t.profileSaved);
    } catch {
      setProfileErrors({
        general: [t.requestError],
      });
    } finally {
      setProfileSubmitting(false);
    }
  }

  function handleLocaleSelect(nextLocale: Locale) {
    setAccountLocale(nextLocale);
    writeStoredLocale(nextLocale);
    setLanguageMenuOpen(false);
  }

  function handleThemeToggle() {
    const nextTheme: ClientTheme = accountTheme === "light" ? "dark" : "light";
    setAccountTheme(nextTheme);
    applyClientTheme(nextTheme);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-2 py-2 sm:items-center sm:px-4">
      <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[1.75rem] border border-slate-800 bg-[#050816] p-4 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">
            {user ? t.account : mode === "login" ? t.login : t.register}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-300">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {!sessionReady ? (
          <div className="rounded-2xl border border-slate-700 bg-[#0f1b2e] p-6 text-sm text-slate-400">
            {t.loading}
          </div>
        ) : user ? (
          <div className="flex min-h-0 flex-1 flex-col gap-6">
            <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap sm:justify-start">
              <button
                type="button"
                onClick={() => setActiveTab("orders")}
                className={`inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-sm font-semibold sm:w-auto ${
                  activeTab === "orders"
                    ? "bg-[#2563EB] text-white"
                    : "bg-[#1a2844] text-slate-300"
                }`}
              >
                {t.orders}
              </button>
              <div ref={languageMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setLanguageMenuOpen((current) => !current)}
                  aria-expanded={languageMenuOpen}
                  aria-haspopup="menu"
                  className="inline-flex w-full items-center justify-center rounded-full border border-slate-700 bg-[#0f1b2e] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 transition hover:bg-slate-800 hover:text-white sm:w-auto"
                >
                  {t.languages}
                </button>
                {languageMenuOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.55rem)] z-10 min-w-[10rem] overflow-hidden rounded-2xl border border-slate-700 bg-[#0f1b2e] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.38)] sm:left-0 sm:right-auto">
                    {(["es", "nl", "en", "pt"] as Locale[]).map((language) => (
                      <button
                        key={language}
                        type="button"
                        onClick={() => handleLocaleSelect(language)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.18em] transition ${
                          accountLocale === language
                            ? "bg-cyan-500 text-slate-950"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}
                        aria-label={`${t.languages}: ${language}`}
                      >
                        <span>{language}</span>
                        {accountLocale === language ? <span>•</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={`inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-sm font-semibold sm:w-auto ${
                  activeTab === "profile"
                    ? "bg-[#2563EB] text-white"
                    : "bg-[#1a2844] text-slate-300"
                }`}
              >
                {t.editInfo}
              </button>
              <Link
                href="/terms"
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center rounded-full bg-[#1a2844] px-4 py-2 text-center text-sm font-semibold text-slate-300 transition hover:bg-[#223556] hover:text-white sm:w-auto"
              >
                {t.termsButton}
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={submitting}
                className="inline-flex w-full items-center justify-center rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
              >
                {t.logout}
              </button>
              <div className="col-span-2 flex justify-center sm:col-auto sm:justify-start">
                <label className="account-theme-switch" title={t.themeLabel}>
                  <input
                    type="checkbox"
                    className="account-theme-switch__checkbox"
                    checked={accountTheme === "light"}
                    onChange={handleThemeToggle}
                    aria-label={t.lightMode}
                  />
                  <span
                    className="account-theme-switch__slider account-theme-switch__slider--round"
                    aria-hidden="true"
                  >
                    <span className="account-theme-switch__stars">
                      <span className="account-theme-switch__star account-theme-switch__star--1" />
                      <span className="account-theme-switch__star account-theme-switch__star--2" />
                      <span className="account-theme-switch__star account-theme-switch__star--3" />
                      <span className="account-theme-switch__star account-theme-switch__star--4" />
                    </span>
                    <span className="account-theme-switch__cloud account-theme-switch__cloud--light account-theme-switch__cloud--1" />
                    <span className="account-theme-switch__cloud account-theme-switch__cloud--light account-theme-switch__cloud--2" />
                    <span className="account-theme-switch__cloud account-theme-switch__cloud--light account-theme-switch__cloud--3" />
                    <span className="account-theme-switch__cloud account-theme-switch__cloud--dark account-theme-switch__cloud--4" />
                    <span className="account-theme-switch__cloud account-theme-switch__cloud--dark account-theme-switch__cloud--5" />
                    <span className="account-theme-switch__cloud account-theme-switch__cloud--dark account-theme-switch__cloud--6" />
                    <span className="account-theme-switch__sun-moon">
                      <span className="account-theme-switch__light-ray account-theme-switch__light-ray--1" />
                      <span className="account-theme-switch__light-ray account-theme-switch__light-ray--2" />
                      <span className="account-theme-switch__light-ray account-theme-switch__light-ray--3" />
                      <span className="account-theme-switch__moon-dot account-theme-switch__moon-dot--1" />
                      <span className="account-theme-switch__moon-dot account-theme-switch__moon-dot--2" />
                      <span className="account-theme-switch__moon-dot account-theme-switch__moon-dot--3" />
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {activeTab === "profile" ? (
              <div className="scrollbar-hidden min-h-0 overflow-y-auto pr-1">
                <div className="space-y-4">
                  {profileErrors.general?.length ? (
                    <div className="rounded-2xl bg-rose-950 px-4 py-3 text-sm text-rose-300">
                      {profileErrors.general[0]}
                    </div>
                  ) : null}

                  {profileSuccess ? (
                    <div className="rounded-2xl bg-emerald-950 px-4 py-3 text-sm text-emerald-300">
                      {profileSuccess}
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-[#0f1b2e] border border-slate-700 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {t.editInfo}
                      </p>
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            {t.name}
                          </label>
                          <input
                            type="text"
                            value={profileName}
                            onChange={(event) => setProfileName(event.target.value)}
                            className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                          />
                          {collectFieldError(profileErrors, "name") ? (
                            <p className="mt-2 text-xs text-rose-300">
                              {collectFieldError(profileErrors, "name")}
                            </p>
                          ) : null}
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            {t.phone}
                          </label>
                          <input
                            type="tel"
                            value={profilePhone}
                            onChange={(event) => setProfilePhone(event.target.value)}
                            className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                          />
                          {collectFieldError(profileErrors, "phone") ? (
                            <p className="mt-2 text-xs text-rose-300">
                              {collectFieldError(profileErrors, "phone")}
                            </p>
                          ) : null}
                        </div>

                        <div>
                          <input
                            type="email"
                            value={profileEmail}
                            onChange={(event) => {
                              setProfileEmail(event.target.value);
                              setEmailCodeSent(false);
                              setEmailCode("");
                            }}
                            className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                          />
                          {collectFieldError(profileErrors, "email") ? (
                            <p className="mt-2 text-xs text-rose-300">
                              {collectFieldError(profileErrors, "email")}
                            </p>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleEmailCodeRequest()}
                          disabled={profileSubmitting || profileEmail.trim() === user.email}
                          className="rounded-full border border-cyan-500/40 bg-[#050816] px-4 py-3 text-sm font-semibold text-cyan-300 transition hover:border-cyan-400 hover:text-cyan-200 disabled:opacity-50"
                        >
                          {t.changeEmailCode}
                        </button>

                        {emailCodeSent ? (
                          <div className="space-y-3 rounded-2xl border border-slate-700 bg-[#050816] p-4">
                            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                              {t.code}
                            </label>
                            <input
                              type="text"
                              value={emailCode}
                              onChange={(event) => setEmailCode(event.target.value)}
                              className="w-full rounded-2xl border border-slate-700 bg-[#0f1b2e] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                            />
                            {collectFieldError(profileErrors, "code") ? (
                              <p className="text-xs text-rose-300">
                                {collectFieldError(profileErrors, "code")}
                              </p>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => void handleEmailCodeConfirm()}
                              disabled={profileSubmitting || emailCode.trim().length === 0}
                              className="rounded-full bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
                            >
                              {t.confirmEmailCode}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[#0f1b2e] border border-slate-700 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {t.address}
                      </p>
                      <div className="mt-4 space-y-4">
                        <div>
                          <AddressAutocompleteField
                            value={profileAddress}
                            onChange={setProfileAddress}
                            placeholder={t.address}
                            locale={accountLocale}
                            className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                          />
                          {collectFieldError(profileErrors, "address") ? (
                            <p className="mt-2 text-xs text-rose-300">
                              {collectFieldError(profileErrors, "address")}
                            </p>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleProfileSave()}
                          disabled={profileSubmitting}
                          className="rounded-full bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
                        >
                          {profileSubmitting ? t.saving : t.saveInfo}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-[#0f1b2e] p-4 text-sm text-slate-400">
                    <p className="font-semibold text-white">
                      {t.memberSince}: {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                    {latestOrder ? (
                      <p className="mt-2">
                        <strong>{t.latestStatus}:</strong> {latestOrder.status}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <OrdersPanel
                clientTheme={accountTheme}
                locale={accountLocale}
                latestOrder={latestOrder}
                orders={orders}
                products={products}
                onOpenProduct={onOpenProduct}
                loading={!ordersLoaded || ordersLoading}
                loadingMore={ordersLoadingMore}
                hasMore={ordersHasMore}
                pendingOrderId={orderPendingId}
                pendingAction={orderPendingAction}
                notice={orderNotice}
                onLoadMore={() => {
                  void loadMoreOrders();
                }}
                onClose={onClose}
                onCancelOrder={handleCancelOrder}
                onAddItems={handleAddItems}
                onUpdateContact={handleUpdateContact}
                onReportIssue={handleReportIssue}
              />
            )}
          </div>
        ) : (
          <div className="scrollbar-hidden space-y-5 overflow-y-auto pr-1">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setAuthErrors({});
                }}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
                  mode === "login" ? "bg-[#2563EB] text-white" : "bg-[#1a2844] text-slate-300"
                }`}
              >
                {t.login}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setAuthErrors({});
                }}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
                  mode === "register"
                    ? "bg-[#2563EB] text-white"
                    : "bg-[#1a2844] text-slate-300"
                }`}
              >
                {t.register}
              </button>
            </div>

            {authErrors.general?.length ? (
              <div className="rounded-2xl bg-rose-950 px-4 py-3 text-sm text-rose-300">
                {authErrors.general[0]}
              </div>
            ) : null}

            {mode === "login" ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleAuthSubmit("/api/auth/login", {
                    email: loginEmail,
                    password: loginPassword,
                  });
                }}
              >
                <div>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    placeholder={t.email}
                    className="w-full rounded-xl border border-slate-600 bg-[#0f1b2e] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#2563EB]"
                  />
                  {collectFieldError(authErrors, "email") ? (
                    <p className="mt-1 text-sm text-rose-600">
                      {collectFieldError(authErrors, "email")}
                    </p>
                  ) : null}
                </div>

                <div>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    placeholder={t.password}
                    className="w-full rounded-xl border border-slate-600 bg-[#0f1b2e] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#2563EB]"
                  />
                  {collectFieldError(authErrors, "password") ? (
                    <p className="mt-1 text-sm text-rose-600">
                      {collectFieldError(authErrors, "password")}
                    </p>
                  ) : null}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-[#2563EB] py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {t.login}
                </button>
              </form>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleAuthSubmit("/api/auth/register", {
                    name: registerName,
                    email: registerEmail,
                    password: registerPassword,
                    confirmPassword: registerConfirmPassword,
                    acceptedTerms: registerAcceptedTerms,
                  });
                }}
              >
                <div>
                  <input
                    type="text"
                    value={registerName}
                    onChange={(event) => setRegisterName(event.target.value)}
                    placeholder={t.name}
                    className="w-full rounded-xl border border-slate-600 bg-[#0f1b2e] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#2563EB]"
                  />
                  {collectFieldError(authErrors, "name") ? (
                    <p className="mt-1 text-sm text-rose-600">
                      {collectFieldError(authErrors, "name")}
                    </p>
                  ) : null}
                </div>

                <div>
                  <input
                    type="email"
                    value={registerEmail}
                    onChange={(event) => setRegisterEmail(event.target.value)}
                    placeholder={t.email}
                    className="w-full rounded-xl border border-slate-600 bg-[#0f1b2e] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#2563EB]"
                  />
                  {collectFieldError(authErrors, "email") ? (
                    <p className="mt-1 text-sm text-rose-600">
                      {collectFieldError(authErrors, "email")}
                    </p>
                  ) : null}
                </div>

                <div>
                  <input
                    type="password"
                    value={registerPassword}
                    onChange={(event) => setRegisterPassword(event.target.value)}
                    placeholder={t.password}
                    className="w-full rounded-xl border border-slate-600 bg-[#0f1b2e] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#2563EB]"
                  />
                  {collectFieldError(authErrors, "password") ? (
                    <p className="mt-1 text-sm text-rose-600">
                      {collectFieldError(authErrors, "password")}
                    </p>
                  ) : null}
                </div>

                <div>
                  <input
                    type="password"
                    value={registerConfirmPassword}
                    onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                    placeholder={t.confirmPassword}
                    className="w-full rounded-xl border border-slate-600 bg-[#0f1b2e] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#2563EB]"
                  />
                  {collectFieldError(authErrors, "confirmPassword") ? (
                    <p className="mt-1 text-sm text-rose-600">
                      {collectFieldError(authErrors, "confirmPassword")}
                    </p>
                  ) : null}
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-slate-700 bg-[#0f1b2e] px-4 py-3 text-sm text-slate-400">
                  <input
                    type="checkbox"
                    checked={registerAcceptedTerms}
                    onChange={(event) => setRegisterAcceptedTerms(event.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    {t.acceptTerms}{" "}
                    <Link href="/terms" target="_blank" className="font-semibold text-[#2563EB]">
                      {t.termsLink}
                    </Link>
                  </span>
                </label>
                {collectFieldError(authErrors, "acceptedTerms") ? (
                  <p className="mt-1 text-sm text-rose-600">
                    {collectFieldError(authErrors, "acceptedTerms")}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting || !registerAcceptedTerms}
                  className="w-full rounded-xl bg-[#2563EB] py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {t.register}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
