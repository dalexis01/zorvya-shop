import "server-only";

import {
  assessDeliveryAddress,
  calculateDeliveryFee,
  estimateDeliveryDistance,
} from "@/helpers/delivery";
import { getPickupValidationError } from "@/lib/shop/checkout";
import { TERMS_VERSION } from "@/lib/shop/config";
import {
  normalizePayPalDisplayCurrency,
  normalizePaymentMethod,
} from "@/lib/shop/payments";
import type {
  DeliveryType,
  NormalizedOrderInput,
  OrderLineItem,
  PayPalDisplayCurrency,
  PaymentMethod,
  ProductIdentifier,
} from "@/lib/shop/types";

type FieldErrors = Record<string, string[]>;

function addFieldError(errors: FieldErrors, field: string, message: string) {
  if (!errors[field]) {
    errors[field] = [];
  }

  errors[field].push(message);
}

function trimText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string) {
  const trimmedPhone = phone.trim();
  const hasLeadingPlus = trimmedPhone.startsWith("+");
  const digitsOnly = trimmedPhone.replace(/[^\d]/g, "");

  return `${hasLeadingPlus ? "+" : ""}${digitsOnly}`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isStrongPassword(value: string) {
  return (
    value.length >= 8 &&
    /[A-Za-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

function roundCurrency(amount: number) {
  return Math.round(amount * 100) / 100;
}

function normalizeProductId(value: unknown): ProductIdentifier | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return undefined;
}

function normalizeItems(input: unknown) {
  if (!Array.isArray(input)) {
    return null;
  }

  const normalizedItems: OrderLineItem[] = [];

  for (const item of input) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const rawItem = item as Record<string, unknown>;
    const itemName = isNonEmptyString(rawItem.name) ? trimText(rawItem.name) : "";
    const itemQuantity = Number(rawItem.quantity);
    const itemPrice = Number(rawItem.price);

    if (
      !itemName ||
      !Number.isInteger(itemQuantity) ||
      itemQuantity < 1 ||
      !Number.isFinite(itemPrice) ||
      itemPrice <= 0
    ) {
      return null;
    }

    normalizedItems.push({
      productId: normalizeProductId(rawItem.productId),
      name: itemName,
      price: roundCurrency(itemPrice),
      quantity: itemQuantity,
      image: typeof rawItem.image === "string" ? rawItem.image : undefined,
      selectedVariantId:
        typeof rawItem.selectedVariantId === "string" ? rawItem.selectedVariantId : undefined,
      selectedVariantName:
        typeof rawItem.selectedVariantName === "string"
          ? trimText(rawItem.selectedVariantName)
          : undefined,
      selectedColor:
        typeof rawItem.selectedColor === "string" ? trimText(rawItem.selectedColor) : undefined,
    });
  }

  return normalizedItems;
}

export function validateAdditionalItemsPayload(payload: unknown) {
  const errors: FieldErrors = {};
  const items = normalizeItems(payload);

  if (!items || items.length === 0) {
    addFieldError(errors, "products", "Debe seleccionar al menos un producto valido.");
    return {
      success: false as const,
      errors,
    };
  }

  return {
    success: true as const,
    data: items,
  };
}

export function validateOrderContactUpdatePayload(payload: unknown) {
  const errors: FieldErrors = {};

  if (!payload || typeof payload !== "object") {
    return {
      success: false as const,
      errors: { general: ["La informacion enviada no es valida."] },
    };
  }

  const body = payload as Record<string, unknown>;
  const phone =
    typeof body.phone === "string" ? trimText(body.phone) : undefined;
  const address =
    typeof body.address === "string" ? trimText(body.address) : undefined;

  if (phone !== undefined && phone.length < 7) {
    addFieldError(errors, "phone", "Debe indicar un telefono valido.");
  }

  if (address !== undefined && address.length < 5) {
    addFieldError(errors, "address", "Debe indicar una direccion valida.");
  }

  if (address !== undefined && address.length >= 5) {
    const assessment = assessDeliveryAddress(address);

    if (!assessment.isValidSurinameAddress) {
      addFieldError(errors, "address", "Solo se permiten direcciones reales de Suriname.");
    }
  }

  if (phone === undefined && address === undefined) {
    addFieldError(errors, "general", "Debe indicar al menos un cambio valido.");
  }

  if (Object.keys(errors).length > 0) {
    return { success: false as const, errors };
  }

  return {
    success: true as const,
    data: {
      phone,
      address,
    },
  };
}

export function validateOrderIssuePayload(payload: unknown) {
  const errors: FieldErrors = {};

  if (!payload || typeof payload !== "object") {
    return {
      success: false as const,
      errors: { general: ["La informacion enviada no es valida."] },
    };
  }

  const body = payload as Record<string, unknown>;
  const message = isNonEmptyString(body.message) ? trimText(body.message) : "";

  if (message.length < 10) {
    addFieldError(
      errors,
      "message",
      "Debe indicar un mensaje mas claro sobre el problema."
    );
  }

  if (Object.keys(errors).length > 0) {
    return { success: false as const, errors };
  }

  return {
    success: true as const,
    data: {
      message,
    },
  };
}

export function validateAdminOrderCancellationPayload(payload: unknown) {
  const errors: FieldErrors = {};

  if (!payload || typeof payload !== "object") {
    return {
      success: false as const,
      errors: { general: ["La informacion enviada no es valida."] },
    };
  }

  const body = payload as Record<string, unknown>;
  const reason = isNonEmptyString(body.reason) ? trimText(body.reason) : "";

  if (reason.length < 5) {
    addFieldError(errors, "reason", "Debe indicar un motivo valido.");
  }

  if (reason.length > 240) {
    addFieldError(errors, "reason", "El motivo es demasiado largo.");
  }

  if (Object.keys(errors).length > 0) {
    return { success: false as const, errors };
  }

  return {
    success: true as const,
    data: {
      reason,
    },
  };
}

export function validateRegistrationPayload(payload: unknown) {
  const errors: FieldErrors = {};

  if (!payload || typeof payload !== "object") {
    return {
      success: false as const,
      errors: { general: ["La informacion enviada no es valida."] },
    };
  }

  const body = payload as Record<string, unknown>;
  const name = isNonEmptyString(body.name) ? trimText(body.name) : "";
  const email = isNonEmptyString(body.email) ? normalizeEmail(body.email) : "";
  const phone = isNonEmptyString(body.phone) ? trimText(body.phone) : "";
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword =
    typeof body.confirmPassword === "string" ? body.confirmPassword : "";
  const acceptedTerms = body.acceptedTerms === true;

  if (name.length < 2) {
    addFieldError(errors, "name", "El nombre debe tener al menos 2 caracteres.");
  }

  if (!email || !isValidEmail(email)) {
    addFieldError(errors, "email", "Debe indicar un correo valido.");
  }

  if (normalizePhone(phone).replace(/\D/g, "").length < 7) {
    addFieldError(errors, "phone", "Debe indicar un telefono valido.");
  }

  if (!isStrongPassword(password)) {
    addFieldError(
      errors,
      "password",
      "La contrasena debe tener 8 caracteres, letra, numero y simbolo."
    );
  }

  if (password !== confirmPassword) {
    addFieldError(errors, "confirmPassword", "Las contrasenas no coinciden.");
  }

  if (!acceptedTerms) {
    addFieldError(
      errors,
      "acceptedTerms",
      "Debe aceptar los terminos y condiciones de uso."
    );
  }

  if (Object.keys(errors).length > 0) {
    return { success: false as const, errors };
  }

  return {
    success: true as const,
    data: {
      name,
      email,
      phone,
      password,
      acceptedTermsAt: new Date().toISOString(),
      acceptedTermsVersion: TERMS_VERSION,
    },
  };
}

export function validateLoginPayload(payload: unknown) {
  const errors: FieldErrors = {};

  if (!payload || typeof payload !== "object") {
    return {
      success: false as const,
      errors: { general: ["La informacion enviada no es valida."] },
    };
  }

  const body = payload as Record<string, unknown>;
  const email = isNonEmptyString(body.email) ? trimText(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || email.length < 4) {
    addFieldError(errors, "email", "Debe indicar un correo o telefono valido.");
  }

  if (!password) {
    addFieldError(errors, "password", "Debe indicar la contrasena.");
  }

  if (Object.keys(errors).length > 0) {
    return { success: false as const, errors };
  }

  return {
    success: true as const,
    data: {
      email,
      password,
    },
  };
}

export function validateVerificationCodePayload(payload: unknown) {
  const errors: FieldErrors = {};

  if (!payload || typeof payload !== "object") {
    return {
      success: false as const,
      errors: { general: ["La informacion enviada no es valida."] },
    };
  }

  const body = payload as Record<string, unknown>;
  const email = isNonEmptyString(body.email) ? normalizeEmail(body.email) : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!email || !isValidEmail(email)) {
    addFieldError(errors, "email", "Debe indicar un correo valido.");
  }

  if (!/^\d{6}$/.test(code)) {
    addFieldError(errors, "code", "Debe indicar un codigo de 6 digitos.");
  }

  if (Object.keys(errors).length > 0) {
    return { success: false as const, errors };
  }

  return {
    success: true as const,
    data: {
      email,
      code,
    },
  };
}

export function validatePasswordResetRequestPayload(payload: unknown) {
  const errors: FieldErrors = {};

  if (!payload || typeof payload !== "object") {
    return {
      success: false as const,
      errors: { general: ["La informacion enviada no es valida."] },
    };
  }

  const body = payload as Record<string, unknown>;
  const email = isNonEmptyString(body.email) ? normalizeEmail(body.email) : "";

  if (!email || !isValidEmail(email)) {
    addFieldError(errors, "email", "Debe indicar un correo valido.");
  }

  if (Object.keys(errors).length > 0) {
    return { success: false as const, errors };
  }

  return {
    success: true as const,
    data: {
      email,
    },
  };
}

export function validatePasswordResetConfirmPayload(payload: unknown) {
  const errors: FieldErrors = {};

  if (!payload || typeof payload !== "object") {
    return {
      success: false as const,
      errors: { general: ["La informacion enviada no es valida."] },
    };
  }

  const body = payload as Record<string, unknown>;
  const email = isNonEmptyString(body.email) ? normalizeEmail(body.email) : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword =
    typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  if (!email || !isValidEmail(email)) {
    addFieldError(errors, "email", "Debe indicar un correo valido.");
  }

  if (!/^\d{6}$/.test(code)) {
    addFieldError(errors, "code", "Debe indicar un codigo de 6 digitos.");
  }

  if (!isStrongPassword(password)) {
    addFieldError(
      errors,
      "password",
      "La contrasena debe tener 8 caracteres, letra, numero y simbolo."
    );
  }

  if (password !== confirmPassword) {
    addFieldError(errors, "confirmPassword", "Las contrasenas no coinciden.");
  }

  if (Object.keys(errors).length > 0) {
    return { success: false as const, errors };
  }

  return {
    success: true as const,
    data: {
      email,
      code,
      password,
    },
  };
}

export function validateOrderPayload(
  payload: unknown,
  options?: { fallbackEmail?: string }
) {
  const errors: FieldErrors = {};

  if (!payload || typeof payload !== "object") {
    return {
      success: false as const,
      errors: { general: ["La orden enviada no es valida."] },
    };
  }

  const body = payload as Record<string, unknown>;
  // Accept both "name" (web) and "customerName" (mobile app) formats
  const customerName = isNonEmptyString(body.name) ? trimText(body.name)
    : isNonEmptyString(body.customerName) ? trimText(body.customerName as string) : "";
  const customerPhone = isNonEmptyString(body.phone) ? trimText(body.phone)
    : isNonEmptyString(body.customerPhone) ? trimText(body.customerPhone as string) : "";
  const customerAddress = isNonEmptyString(body.address) ? trimText(body.address)
    : isNonEmptyString(body.customerAddress) ? trimText(body.customerAddress as string) : "";
  const rawEmail = isNonEmptyString(body.email) ? normalizeEmail(body.email)
    : isNonEmptyString(body.customerEmail) ? normalizeEmail(body.customerEmail as string) : "";
  const customerEmail = rawEmail || options?.fallbackEmail || "";
  const deliveryType: DeliveryType =
    body.deliveryType === "pickup" ? "pickup" : "delivery";
  const pickupDate =
    deliveryType === "pickup" && typeof body.pickupDate === "string"
      ? body.pickupDate
      : null;
  const pickupTime =
    deliveryType === "pickup" && typeof body.pickupTime === "string"
      ? body.pickupTime
      : null;
  const requestedAgentCall = Boolean(body.requestedAgentCall);
  const paymentMethod: PaymentMethod = normalizePaymentMethod(body.paymentMethod);
  const paypalDisplayCurrency: PayPalDisplayCurrency | null =
    paymentMethod === "paypal" ? normalizePayPalDisplayCurrency(body.paypalDisplayCurrency) : null;
  const items = normalizeItems(body.products ?? body.items);

  if (customerName.length < 2) {
    addFieldError(errors, "name", "Debe indicar el nombre del cliente.");
  }

  if (customerPhone.length < 7) {
    addFieldError(errors, "phone", "Debe indicar un telefono valido.");
  }

  if (!customerAddress || customerAddress.length < 5) {
    addFieldError(errors, "address", "Debe indicar la direccion del pedido.");
  }

  const deliveryAssessment = assessDeliveryAddress(customerAddress);

  if (customerAddress && customerAddress.length >= 5 && !deliveryAssessment.isValidSurinameAddress) {
    addFieldError(errors, "address", "Solo se permiten direcciones reales de Suriname.");
  }

  // Email is optional for guest orders — only validate format if provided
  if (customerEmail && !isValidEmail(customerEmail)) {
    addFieldError(errors, "email", "El formato del correo no es valido.");
  }

  if (!items || items.length === 0) {
    addFieldError(errors, "products", "La orden debe incluir al menos un producto.");
  }

  if (deliveryType === "pickup") {
    const pickupError = getPickupValidationError(pickupDate, pickupTime);
    if (pickupError) {
      addFieldError(errors, "pickup", pickupError);
    }
  }

  if (Object.keys(errors).length > 0 || !items) {
    return { success: false as const, errors };
  }

  const subtotal = roundCurrency(
    items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  );
  const deliveryFee =
    deliveryType === "delivery"
      ? calculateDeliveryFee(estimateDeliveryDistance(customerAddress), subtotal).fee
      : 0;
  const total = roundCurrency(subtotal + deliveryFee);

  const normalizedInput: NormalizedOrderInput = {
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    deliveryType,
    pickupDate,
    pickupTime,
    requestedAgentCall,
    items,
    subtotal,
    deliveryDistanceKm: deliveryType === "delivery" ? estimateDeliveryDistance(customerAddress) : null,
    deliveryFee: roundCurrency(deliveryFee),
    total,
    paymentMethod,
    paypalDisplayCurrency,
    paymentFeeRate: 0,
    paymentFeeAmountSrd: 0,
    paymentGrandTotalSrd: total,
    paymentPayableUsd: null,
    exchangeRateSrdPerUsd: null,
  };

  return {
    success: true as const,
    data: normalizedInput,
  };
}
