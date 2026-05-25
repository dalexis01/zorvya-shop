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
  nextStep?: "verify-email" | "reset-password";
  email?: string;
  message?: string;
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

type AuthMode = "login" | "register" | "verify-email" | "forgot-password" | "reset-password";

type OrderActionResult = {
  success: boolean;
  errorMessage?: string;
};

const texts = {
  es: {
    account: "Cuenta",
    login: "Iniciar sesion",
    register: "Crear cuenta",
    forgotPassword: "Olvide mi contrasena",
    verifyEmail: "Verificar cuenta",
    resetPassword: "Restablecer contrasena",
    profile: "Perfil",
    orders: "Ordenes",
    logout: "Cerrar sesion",
    name: "Nombre",
    email: "Correo",
    phone: "Telefono",
    address: "Direccion",
    password: "Contrasena",
    confirmPassword: "Confirmar contrasena",
    codeSent: "Te enviamos un codigo de seguridad a tu correo.",
    sendCode: "Enviar codigo",
    verifyCode: "Verificar codigo",
    backToLogin: "Volver a iniciar sesion",
    newPassword: "Nueva contrasena",
    recoveryHint: "Escribe tu correo y te enviaremos un codigo real para recuperar la cuenta.",
    verifyHint: "Ingresa el codigo que enviamos a tu correo para activar tu cuenta.",
    resetHint: "Ingresa el codigo y crea tu nueva contrasena.",
    phoneRequired: "Telefono",
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
    forgotPassword: "Wachtwoord vergeten",
    verifyEmail: "Account verifieren",
    resetPassword: "Wachtwoord herstellen",
    profile: "Profiel",
    orders: "Bestellingen",
    logout: "Uitloggen",
    name: "Naam",
    email: "E-mail",
    phone: "Telefoon",
    address: "Adres",
    password: "Wachtwoord",
    confirmPassword: "Wachtwoord bevestigen",
    codeSent: "We hebben een beveiligingscode naar je e-mail gestuurd.",
    sendCode: "Code verzenden",
    verifyCode: "Code verifieren",
    backToLogin: "Terug naar inloggen",
    newPassword: "Nieuw wachtwoord",
    recoveryHint: "Vul je e-mail in en we sturen een echte code om je account te herstellen.",
    verifyHint: "Voer de code in die we naar je e-mail hebben gestuurd om je account te activeren.",
    resetHint: "Voer de code in en maak je nieuwe wachtwoord.",
    phoneRequired: "Telefoon",
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
    forgotPassword: "Forgot password",
    verifyEmail: "Verify account",
    resetPassword: "Reset password",
    profile: "Profile",
    orders: "Orders",
    logout: "Log out",
    name: "Name",
    email: "Email",
    phone: "Phone",
    address: "Address",
    password: "Password",
    confirmPassword: "Confirm password",
    codeSent: "We sent a security code to your email.",
    sendCode: "Send code",
    verifyCode: "Verify code",
    backToLogin: "Back to log in",
    newPassword: "New password",
    recoveryHint: "Enter your email and we will send a real code to recover your account.",
    verifyHint: "Enter the code we sent to your email to activate your account.",
    resetHint: "Enter the code and create your new password.",
    phoneRequired: "Phone",
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
    forgotPassword: "Esqueci minha senha",
    verifyEmail: "Verificar conta",
    resetPassword: "Redefinir senha",
    profile: "Perfil",
    orders: "Pedidos",
    logout: "Sair",
    name: "Nome",
    email: "E-mail",
    phone: "Telefone",
    address: "Endereco",
    password: "Senha",
    confirmPassword: "Confirmar senha",
    codeSent: "Enviamos um codigo de seguranca para seu e-mail.",
    sendCode: "Enviar codigo",
    verifyCode: "Verificar codigo",
    backToLogin: "Voltar ao login",
    newPassword: "Nova senha",
    recoveryHint: "Digite seu e-mail e enviaremos um codigo real para recuperar sua conta.",
    verifyHint: "Digite o codigo enviado ao seu e-mail para ativar sua conta.",
    resetHint: "Digite o codigo e crie sua nova senha.",
    phoneRequired: "Telefone",
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
  initialReceiptOrderId?: string | null;
  initialIssueOrderId?: string | null;
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
  initialReceiptOrderId = null,
  initialIssueOrderId = null,
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
  const [mode, setMode] = useState<AuthMode>("login");
  const [activeTab, setActiveTab] = useState<"profile" | "orders">(
    user ? "orders" : "profile"
  );
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerAcceptedTerms, setRegisterAcceptedTerms] = useState(false);
  const [authErrors, setAuthErrors] = useState<FormErrors>({});
  const [authInfo, setAuthInfo] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
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
    if ((initialReceiptOrderId || initialIssueOrderId) && user) {
      setActiveTab("orders");
    }
  }, [initialIssueOrderId, initialReceiptOrderId, user]);

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
    setAuthInfo("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...body,
          locale,
        }),
      });

      const payload = (await response.json()) as AuthResponse;

      if (response.ok && payload.nextStep === "verify-email" && payload.email) {
        setVerificationEmail(payload.email);
        setRecoveryEmail(payload.email);
        setMode("verify-email");
        setAuthInfo(payload.message ?? t.codeSent);
        setLoginPassword("");
        setRegisterPassword("");
        setRegisterConfirmPassword("");
        return;
      }

      if (!response.ok && payload.nextStep === "verify-email" && payload.email) {
        setVerificationEmail(payload.email);
        setRecoveryEmail(payload.email);
        setMode("verify-email");
        setAuthInfo(payload.message ?? t.codeSent);
        setAuthErrors(payload.errors ?? {});
        return;
      }

      if (!response.ok || !payload.user) {
        setAuthErrors(payload.errors ?? { general: [t.requestError] });
        return;
      }

      setOrderNotice(null);
      setOrdersLoaded(false);
      setOrdersHasMore(false);
      setOrdersNextCursor(null);
      setLoginPassword("");
      setRegisterPhone("");
      setRegisterPassword("");
      setRegisterConfirmPassword("");
      setRegisterAcceptedTerms(false);
      setAuthInfo(payload.message ?? "");
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

  async function handleVerifyEmail() {
    setSubmitting(true);
    setAuthErrors({});
    setAuthInfo("");

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: verificationEmail,
          code: verificationCode,
        }),
      });

      const payload = (await response.json()) as AuthResponse;

      if (!response.ok || !payload.user) {
        setAuthErrors(payload.errors ?? { general: [t.requestError] });
        return;
      }

      setAuthInfo(payload.message ?? "");
      setVerificationCode("");
      setMode("login");
      sessionChangeRef.current(payload.user);
    } catch {
      setAuthErrors({ general: [t.requestError] });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendVerification() {
    setSubmitting(true);
    setAuthErrors({});
    setAuthInfo("");

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: verificationEmail,
          locale,
        }),
      });
      const payload = (await response.json()) as AuthResponse;

      if (!response.ok) {
        setAuthErrors(payload.errors ?? { general: [t.requestError] });
        return;
      }

      setAuthInfo(payload.message ?? t.codeSent);
    } catch {
      setAuthErrors({ general: [t.requestError] });
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordResetRequest() {
    setSubmitting(true);
    setAuthErrors({});
    setAuthInfo("");

    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: recoveryEmail,
          locale,
        }),
      });
      const payload = (await response.json()) as AuthResponse;

      if (!response.ok) {
        setAuthErrors(payload.errors ?? { general: [t.requestError] });
        return;
      }

      setMode("reset-password");
      setVerificationEmail(recoveryEmail);
      setAuthInfo(payload.message ?? t.codeSent);
    } catch {
      setAuthErrors({ general: [t.requestError] });
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordResetConfirm() {
    setSubmitting(true);
    setAuthErrors({});
    setAuthInfo("");

    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: verificationEmail,
          code: resetCode,
          password: resetPassword,
          confirmPassword: resetConfirmPassword,
          locale,
        }),
      });
      const payload = (await response.json()) as AuthResponse;

      if (!response.ok || !payload.user) {
        setAuthErrors(payload.errors ?? { general: [t.requestError] });
        return;
      }

      setResetCode("");
      setResetPassword("");
      setResetConfirmPassword("");
      setAuthInfo(payload.message ?? "");
      sessionChangeRef.current(payload.user);
    } catch {
      setAuthErrors({ general: [t.requestError] });
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
            {user
              ? t.account
              : mode === "login"
                ? t.login
                : mode === "register"
                  ? t.register
                  : mode === "verify-email"
                    ? t.verifyEmail
                    : mode === "forgot-password"
                      ? t.forgotPassword
                      : t.resetPassword}
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
            <div className="account-toolbar flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-2 sm:gap-y-2">
              <button
                type="button"
                onClick={() => setActiveTab("orders")}
                className={`account-option-button account-toolbar__button ${
                  activeTab === "orders" ? "account-option-button--active" : ""
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
                  className="account-option-button account-toolbar__button"
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
                        className={`account-option-button flex w-full items-center justify-between px-3 ${
                          accountLocale === language ? "account-option-button--active" : ""
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
                className={`account-option-button account-toolbar__button ${
                  activeTab === "profile" ? "account-option-button--active" : ""
                }`}
              >
                {t.editInfo}
              </button>
              <Link
                href="/terms"
                target="_blank"
                rel="noreferrer"
                className="account-option-button account-toolbar__button text-center"
              >
                {t.termsButton}
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={submitting}
                className="account-option-button account-toolbar__button account-option-button--danger"
              >
                {t.logout}
              </button>
              <div className="flex items-center justify-center sm:justify-start">
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
                          className="account-option-button account-option-button--full"
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
                              className="account-option-button account-option-button--primary account-option-button--full"
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
                          className="account-option-button account-option-button--primary account-option-button--full"
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
                key={`${initialReceiptOrderId ?? "receipt-none"}-${initialIssueOrderId ?? "issue-none"}-${user?.id ?? "orders-panel"}`}
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
                initialReceiptOrderId={initialReceiptOrderId}
                initialIssueOrderId={initialIssueOrderId}
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
                className={`account-option-button account-option-button--full flex-1 ${
                  mode === "login" ? "account-option-button--active" : ""
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
                className={`account-option-button account-option-button--full flex-1 ${
                  mode === "register" ? "account-option-button--active" : ""
                }`}
              >
                {t.register}
              </button>
            </div>

            {authInfo ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {authInfo}
              </div>
            ) : null}

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
                  className="account-option-button account-option-button--primary account-option-button--full"
                >
                  {t.login}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot-password");
                    setRecoveryEmail(loginEmail);
                    setAuthErrors({});
                    setAuthInfo("");
                  }}
                  className="account-option-button account-option-button--full"
                >
                  {t.forgotPassword}
                </button>
              </form>
            ) : mode === "register" ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleAuthSubmit("/api/auth/register", {
                    name: registerName,
                    email: registerEmail,
                    phone: registerPhone,
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
                    type="tel"
                    value={registerPhone}
                    onChange={(event) => setRegisterPhone(event.target.value)}
                    placeholder={t.phoneRequired}
                    className="w-full rounded-xl border border-slate-600 bg-[#0f1b2e] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#2563EB]"
                  />
                  {collectFieldError(authErrors, "phone") ? (
                    <p className="mt-1 text-sm text-rose-600">
                      {collectFieldError(authErrors, "phone")}
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
                  className="account-option-button account-option-button--primary account-option-button--full"
                >
                  {t.register}
                </button>
              </form>
            ) : mode === "verify-email" ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleVerifyEmail();
                }}
              >
                <p className="text-sm text-slate-300">{t.verifyHint}</p>
                <input
                  type="email"
                  value={verificationEmail}
                  onChange={(event) => setVerificationEmail(event.target.value)}
                  placeholder={t.email}
                  className="w-full rounded-xl border border-slate-600 bg-[#0f1b2e] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#2563EB]"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder={t.code}
                  className="w-full rounded-xl border border-slate-600 bg-[#0f1b2e] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#2563EB]"
                />
                {collectFieldError(authErrors, "code") ? (
                  <p className="mt-1 text-sm text-rose-600">
                    {collectFieldError(authErrors, "code")}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={submitting}
                  className="account-option-button account-option-button--primary account-option-button--full"
                >
                  {t.verifyCode}
                </button>
                <button
                  type="button"
                  onClick={() => void handleResendVerification()}
                  disabled={submitting}
                  className="account-option-button account-option-button--full"
                >
                  {t.sendCode}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setAuthErrors({});
                    setAuthInfo("");
                  }}
                  className="account-option-button account-option-button--full"
                >
                  {t.backToLogin}
                </button>
              </form>
            ) : mode === "forgot-password" ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handlePasswordResetRequest();
                }}
              >
                <p className="text-sm text-slate-300">{t.recoveryHint}</p>
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={(event) => setRecoveryEmail(event.target.value)}
                  placeholder={t.email}
                  className="w-full rounded-xl border border-slate-600 bg-[#0f1b2e] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#2563EB]"
                />
                {collectFieldError(authErrors, "email") ? (
                  <p className="mt-1 text-sm text-rose-600">
                    {collectFieldError(authErrors, "email")}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={submitting}
                  className="account-option-button account-option-button--primary account-option-button--full"
                >
                  {t.sendCode}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setAuthErrors({});
                    setAuthInfo("");
                  }}
                  className="account-option-button account-option-button--full"
                >
                  {t.backToLogin}
                </button>
              </form>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handlePasswordResetConfirm();
                }}
              >
                <p className="text-sm text-slate-300">{t.resetHint}</p>
                <input
                  type="email"
                  value={verificationEmail}
                  onChange={(event) => setVerificationEmail(event.target.value)}
                  placeholder={t.email}
                  className="w-full rounded-xl border border-slate-600 bg-[#0f1b2e] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#2563EB]"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={resetCode}
                  onChange={(event) => setResetCode(event.target.value)}
                  placeholder={t.code}
                  className="w-full rounded-xl border border-slate-600 bg-[#0f1b2e] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#2563EB]"
                />
                {collectFieldError(authErrors, "code") ? (
                  <p className="mt-1 text-sm text-rose-600">
                    {collectFieldError(authErrors, "code")}
                  </p>
                ) : null}
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  placeholder={t.newPassword}
                  className="w-full rounded-xl border border-slate-600 bg-[#0f1b2e] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#2563EB]"
                />
                {collectFieldError(authErrors, "password") ? (
                  <p className="mt-1 text-sm text-rose-600">
                    {collectFieldError(authErrors, "password")}
                  </p>
                ) : null}
                <input
                  type="password"
                  value={resetConfirmPassword}
                  onChange={(event) => setResetConfirmPassword(event.target.value)}
                  placeholder={t.confirmPassword}
                  className="w-full rounded-xl border border-slate-600 bg-[#0f1b2e] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#2563EB]"
                />
                {collectFieldError(authErrors, "confirmPassword") ? (
                  <p className="mt-1 text-sm text-rose-600">
                    {collectFieldError(authErrors, "confirmPassword")}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="account-option-button account-option-button--primary account-option-button--full"
                >
                  {t.resetPassword}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setAuthErrors({});
                    setAuthInfo("");
                  }}
                  className="account-option-button account-option-button--full"
                >
                  {t.backToLogin}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
