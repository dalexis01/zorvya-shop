import type {
  OrderPaymentInfo,
  PayPalDisplayCurrency,
  PaymentMethod,
} from "@/lib/shop/types";

export const PAYPAL_FEE_RATE = 0.1;
export const SRD_PER_USD = 38;

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function normalizePaymentMethod(value: unknown): PaymentMethod {
  return value === "paypal" ? "paypal" : "cash";
}

export function normalizePayPalDisplayCurrency(value: unknown): PayPalDisplayCurrency {
  return value === "USD" ? "USD" : "SRD";
}

export function calculateOrderPayment(input: {
  baseTotalSrd: number;
  paymentMethod: PaymentMethod;
  paypalDisplayCurrency?: PayPalDisplayCurrency | null;
}) {
  const baseTotalSrd = roundCurrency(Math.max(0, input.baseTotalSrd));

  if (input.paymentMethod !== "paypal") {
    return {
      method: "cash" as const,
      paypalDisplayCurrency: null,
      exchangeRateSrdPerUsd: null,
      feeRate: 0,
      feeAmountSrd: 0,
      grandTotalSrd: baseTotalSrd,
      payableUsd: null,
    };
  }

  const feeAmountSrd = roundCurrency(baseTotalSrd * PAYPAL_FEE_RATE);
  const grandTotalSrd = roundCurrency(baseTotalSrd + feeAmountSrd);
  const payableUsd = roundCurrency(grandTotalSrd / SRD_PER_USD);

  return {
    method: "paypal" as const,
    paypalDisplayCurrency: input.paypalDisplayCurrency ?? "SRD",
    exchangeRateSrdPerUsd: SRD_PER_USD,
    feeRate: PAYPAL_FEE_RATE,
    feeAmountSrd,
    grandTotalSrd,
    payableUsd,
  };
}

export function createOrderPaymentInfo(input: {
  paymentMethod: PaymentMethod;
  paypalDisplayCurrency?: PayPalDisplayCurrency | null;
  baseTotalSrd: number;
  feeRate: number;
  feeAmountSrd: number;
  grandTotalSrd: number;
  payableUsd: number | null;
  exchangeRateSrdPerUsd: number | null;
  state?: OrderPaymentInfo["state"];
  paypalOrderId?: string | null;
  paypalAuthorizationId?: string | null;
  paypalAuthorizationStatus?: string | null;
  paypalCaptureId?: string | null;
  paypalCaptureStatus?: string | null;
  authorizedAt?: string | null;
  capturedAt?: string | null;
  voidedAt?: string | null;
  failureReason?: string | null;
}): OrderPaymentInfo {
  return {
    method: input.paymentMethod,
    paypalDisplayCurrency:
      input.paymentMethod === "paypal" ? input.paypalDisplayCurrency ?? "SRD" : null,
    exchangeRateSrdPerUsd:
      input.paymentMethod === "paypal" ? input.exchangeRateSrdPerUsd ?? SRD_PER_USD : null,
    feeRate: roundCurrency(input.feeRate),
    feeAmountSrd: roundCurrency(input.feeAmountSrd),
    baseTotalSrd: roundCurrency(input.baseTotalSrd),
    grandTotalSrd: roundCurrency(input.grandTotalSrd),
    payableUsd:
      input.paymentMethod === "paypal" && typeof input.payableUsd === "number"
        ? roundCurrency(input.payableUsd)
        : null,
    paypalOrderId: input.paypalOrderId ?? null,
    paypalAuthorizationId: input.paypalAuthorizationId ?? null,
    paypalAuthorizationStatus: input.paypalAuthorizationStatus ?? null,
    paypalCaptureId: input.paypalCaptureId ?? null,
    paypalCaptureStatus: input.paypalCaptureStatus ?? null,
    state:
      input.state ??
      (input.paymentMethod === "paypal" ? "pending_authorization" : "not_applicable"),
    authorizedAt: input.authorizedAt ?? null,
    capturedAt: input.capturedAt ?? null,
    voidedAt: input.voidedAt ?? null,
    failureReason: input.failureReason ?? null,
  };
}
