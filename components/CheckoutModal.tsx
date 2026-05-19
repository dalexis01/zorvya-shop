"use client";

import { useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { assessDeliveryAddress } from "@/helpers/delivery";
import AddressAutocompleteField from "@/components/AddressAutocompleteField";

import {
  getMaxPickupDate,
  isWeekday,
  PICKUP_ADDRESS,
  PICKUP_TIME_OPTIONS,
} from "@/lib/shop/checkout";
import {
  formatCurrencySrd as formatSrd,
  formatCurrencyUsd as formatUsd,
} from "@/lib/shop/number-format";
import { calculateOrderPayment } from "@/lib/shop/payments";
import type {
  CheckoutCustomerData,
  Locale,
  PayPalDisplayCurrency,
  PaymentMethod,
} from "@/lib/shop/types";

type Texts = {
  [key in Locale]: {
    title: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    delivery: string;
    pickup: string;
    pickupDescription: string;
    pickupAddress: string;
    selectDate: string;
    selectTime: string;
    requestAgentCall: string;
    requestAgentCallDescription: string;
    continue: string;
    close: string;
    validation: string;
    addressInvalid: string;
    deliveryCalculating: string;
    deliveryEstimate: (fee: number) => string;
    deliveryFree: string;
    deliveryReview: string;
    deliveryUnavailable: string;
    paymentTitle: string;
    paymentCash: string;
    paymentPaypal: string;
    paymentPaypalHint: string;
    paymentCurrencyTitle: string;
    paymentInSrd: string;
    paymentInUsd: string;
    paymentPaypalLocked: string;
    paymentItems: string;
    paymentDelivery: string;
    paymentFee: string;
    paymentTotal: string;
  };
};

type DeliveryQuoteResponse = {
  distanceKm: number;
  fee: number;
  isFree: boolean;
  allowsDelivery: boolean;
  isValidSurinameAddress: boolean;
  requiresAgentReview: boolean;
  freeDeliveryMinimum: number | null;
};

function buildInitialDeliveryQuote(
  initialData?: Partial<CheckoutCustomerData>
): DeliveryQuoteResponse | null {
  if (!initialData || initialData.deliveryType !== "delivery") {
    return null;
  }

  if (initialData.requestedAgentCall && typeof initialData.deliveryFee !== "number") {
    return {
      distanceKm: initialData.deliveryDistanceKm ?? 0,
      fee: 0,
      isFree: false,
      allowsDelivery: true,
      isValidSurinameAddress: true,
      requiresAgentReview: true,
      freeDeliveryMinimum: null,
    };
  }

  if (typeof initialData.deliveryFee === "number") {
    return {
      distanceKm: initialData.deliveryDistanceKm ?? 0,
      fee: initialData.deliveryFee,
      isFree: initialData.deliveryFee <= 0,
      allowsDelivery: true,
      isValidSurinameAddress: true,
      requiresAgentReview: false,
      freeDeliveryMinimum: null,
    };
  }

  return null;
}

const texts: Texts = {
  es: {
    title: "Checkout",
    name: "Nombre y apellido",
    phone: "Numero de telefono",
    email: "Correo electronico",
    address: "Direccion completa",
    delivery: "Delivery a domicilio",
    pickup: "Programar recogida del paquete",
    pickupDescription: "Seleccione fecha y hora de recogida dentro de los proximos 7 dias habiles.",
    pickupAddress: "Direccion de recogida: Anton Drachtenweg 146",
    selectDate: "Seleccionar fecha",
    selectTime: "Seleccionar hora",
    requestAgentCall: "Solicitar hablar con un agente",
    requestAgentCallDescription:
      "La orden se confirmara normalmente y un agente llamara para confirmar los detalles.",
    continue: "Continuar",
    close: "Cerrar",
    validation: "Complete todos los campos obligatorios.",
    addressInvalid: "Solo permitimos direcciones reales de Suriname.",
    deliveryCalculating: "Calculando la distancia real del delivery...",
    deliveryEstimate: (fee) => `${formatSrd(fee)}`,
    deliveryFree: "Tu carrito ya desbloqueo delivery gratis para esta direccion.",
    deliveryReview:
      "Su direccion no se pudo calcular con exito. Antes del envio un agente se pondra en contacto con usted.",
    deliveryUnavailable: "Todavia no tenemos delivery disponible en tu zona.",
    paymentTitle: "Metodo de pago",
    paymentCash: "Pagar en efectivo al recibir el paquete",
    paymentPaypal: "Pagar AHORA con PayPal",
    paymentPaypalHint:
      "Si desea ahorrar dinero seleccione pagar en efectivo al repartidor despues de recibir el paquete y asi evita las comisiones que cobra PayPal.",
    paymentCurrencyTitle: "Elegir moneda",
    paymentInSrd: "SRD",
    paymentInUsd: "USD",
    paymentPaypalLocked:
      "PayPal solo esta disponible cuando el total del delivery ya se pudo calcular con exactitud.",
    paymentItems: "Articulos",
    paymentDelivery: "Envio",
    paymentFee: "Fee de PayPal",
    paymentTotal: "Total",
  },
  nl: {
    title: "Afrekenen",
    name: "Naam en achternaam",
    phone: "Telefoonnummer",
    email: "E-mail",
    address: "Volledig adres",
    delivery: "Thuisbezorging",
    pickup: "Afhaling plannen",
    pickupDescription: "Selecteer datum en tijd binnen de volgende 7 werkdagen.",
    pickupAddress: "Afhaaladres: Anton Drachtenweg 146",
    selectDate: "Datum selecteren",
    selectTime: "Tijd selecteren",
    requestAgentCall: "Met een agent spreken",
    requestAgentCallDescription:
      "De bestelling wordt normaal bevestigd en een agent belt om de details te bevestigen.",
    continue: "Doorgaan",
    close: "Sluiten",
    validation: "Vul alle verplichte velden in.",
    addressInvalid: "Alleen echte adressen in Suriname zijn toegestaan.",
    deliveryCalculating: "De echte leveringsafstand wordt berekend...",
    deliveryEstimate: (fee) => `${formatSrd(fee)}`,
    deliveryFree: "Je winkelwagen heeft gratis levering voor dit adres vrijgespeeld.",
    deliveryReview:
      "Uw adres kon niet exact worden berekend. Voor de levering neemt een agent eerst contact met u op.",
    deliveryUnavailable: "We hebben nog geen levering beschikbaar in jouw zone.",
    paymentTitle: "Betaalmethode",
    paymentCash: "Contant betalen bij ontvangst",
    paymentPaypal: "NU betalen met PayPal",
    paymentPaypalHint:
      "Als u geld wilt besparen, kies dan voor contant betalen bij de bezorger na ontvangst van het pakket en vermijd zo de PayPal-kosten.",
    paymentCurrencyTitle: "Kies valuta",
    paymentInSrd: "SRD",
    paymentInUsd: "USD",
    paymentPaypalLocked:
      "PayPal is alleen beschikbaar wanneer de leveringskost exact kon worden berekend.",
    paymentItems: "Artikelen",
    paymentDelivery: "Levering",
    paymentFee: "PayPal-fee",
    paymentTotal: "Totaal",
  },
  en: {
    title: "Checkout",
    name: "Name and surname",
    phone: "Phone number",
    email: "Email",
    address: "Full address",
    delivery: "Home delivery",
    pickup: "Schedule package pickup",
    pickupDescription: "Choose a pickup date and time within the next 7 business days.",
    pickupAddress: "Pickup address: Anton Drachtenweg 146",
    selectDate: "Select date",
    selectTime: "Select time",
    requestAgentCall: "Request to speak with an agent",
    requestAgentCallDescription:
      "The order will be confirmed normally and an agent will call to confirm the details.",
    continue: "Continue",
    close: "Close",
    validation: "Complete all required fields.",
    addressInvalid: "We only allow real addresses in Suriname.",
    deliveryCalculating: "Calculating the real delivery distance...",
    deliveryEstimate: (fee) => `${formatSrd(fee)}`,
    deliveryFree: "Your cart already unlocked free delivery for this address.",
    deliveryReview:
      "Your address could not be calculated exactly. An agent will contact you before delivery.",
    deliveryUnavailable: "We do not have delivery available in your area yet.",
    paymentTitle: "Payment method",
    paymentCash: "Pay cash on delivery",
    paymentPaypal: "Pay NOW with PayPal",
    paymentPaypalHint:
      "If you want to save money, choose to pay cash to the delivery agent after receiving the package and avoid the PayPal fees.",
    paymentCurrencyTitle: "Choose currency",
    paymentInSrd: "SRD",
    paymentInUsd: "USD",
    paymentPaypalLocked:
      "PayPal is only available once the delivery total can be calculated exactly.",
    paymentItems: "Items",
    paymentDelivery: "Delivery",
    paymentFee: "PayPal fee",
    paymentTotal: "Total",
  },
  pt: {
    title: "Checkout",
    name: "Nome e sobrenome",
    phone: "Numero de telefone",
    email: "E-mail",
    address: "Endereco completo",
    delivery: "Entrega em domicilio",
    pickup: "Agendar retirada do pacote",
    pickupDescription: "Selecione data e hora dentro dos proximos 7 dias uteis.",
    pickupAddress: "Endereco de retirada: Anton Drachtenweg 146",
    selectDate: "Selecionar data",
    selectTime: "Selecionar hora",
    requestAgentCall: "Solicitar falar com um agente",
    requestAgentCallDescription:
      "O pedido sera confirmado normalmente e um agente ligara para confirmar os detalhes.",
    continue: "Continuar",
    close: "Fechar",
    validation: "Preencha todos os campos obrigatorios.",
    addressInvalid: "So permitimos enderecos reais no Suriname.",
    deliveryCalculating: "Calculando a distancia real da entrega...",
    deliveryEstimate: (fee) => `${formatSrd(fee)}`,
    deliveryFree: "Seu carrinho ja desbloqueou entrega gratis para este endereco.",
    deliveryReview:
      "Nao foi possivel calcular seu endereco com exatidao. Um agente entrara em contato antes da entrega.",
    deliveryUnavailable: "Ainda nao temos entrega disponivel na sua area.",
    paymentTitle: "Metodo de pagamento",
    paymentCash: "Pagar em dinheiro ao receber",
    paymentPaypal: "Pagar AGORA com PayPal",
    paymentPaypalHint:
      "Se deseja economizar dinheiro, selecione pagar em dinheiro ao entregador apos receber o pacote e assim evita as comissoes cobradas pelo PayPal.",
    paymentCurrencyTitle: "Escolher moeda",
    paymentInSrd: "SRD",
    paymentInUsd: "USD",
    paymentPaypalLocked:
      "O PayPal so fica disponivel quando o total da entrega ja foi calculado com exatidao.",
    paymentItems: "Artigos",
    paymentDelivery: "Entrega",
    paymentFee: "Taxa do PayPal",
    paymentTotal: "Total",
  },
};

interface CheckoutModalProps {
  locale: Locale;
  subtotal: number;
  containsHeavyItems?: boolean;
  initialData?: Partial<CheckoutCustomerData>;
  onClose: () => void;
  onSubmit: (data: CheckoutCustomerData) => void;
}

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function CheckoutModal({
  locale,
  subtotal,
  containsHeavyItems = false,
  initialData,
  onClose,
  onSubmit,
}: CheckoutModalProps) {
  const t = texts[locale];
  const [name, setName] = useState(initialData?.name ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [address, setAddress] = useState(initialData?.address ?? "");
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">(
    initialData?.deliveryType ?? "delivery"
  );
  const [pickupDate, setPickupDate] = useState<Date | null>(initialData?.pickupDate ?? null);
  const [pickupTime, setPickupTime] = useState(initialData?.pickupTime ?? "");
  const [requestedAgentCall, setRequestedAgentCall] = useState(
    initialData?.requestedAgentCall ?? false
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initialData?.paymentMethod ?? "cash"
  );
  const [paypalDisplayCurrency, setPaypalDisplayCurrency] = useState<PayPalDisplayCurrency>(
    initialData?.paypalDisplayCurrency ?? "SRD"
  );
  const [validationMessage, setValidationMessage] = useState("");
  const [isResolvingDeliveryQuote, setIsResolvingDeliveryQuote] = useState(false);
  const [serverDeliveryQuote, setServerDeliveryQuote] = useState<DeliveryQuoteResponse | null>(
    () => buildInitialDeliveryQuote(initialData)
  );

  const maxDate = useMemo(() => getMaxPickupDate(), []);
  const addressAssessment = useMemo(() => assessDeliveryAddress(address), [address]);
  const isValidSurinameAddress = addressAssessment.isValidSurinameAddress;
  const allowsDelivery =
    (serverDeliveryQuote?.allowsDelivery ?? false) ||
    (serverDeliveryQuote?.requiresAgentReview ?? false);

  useEffect(() => {
    const trimmedAddress = address.trim();

    if (!addressAssessment.isValidSurinameAddress || trimmedAddress.length < 5) {
      setServerDeliveryQuote(null);
      setIsResolvingDeliveryQuote(false);
      return;
    }

    setIsResolvingDeliveryQuote(true);

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/delivery-quote?address=${encodeURIComponent(trimmedAddress)}&locale=${locale}&subtotal=${encodeURIComponent(String(subtotal))}&hasHeavy=${containsHeavyItems ? "true" : "false"}`,
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
  }, [address, addressAssessment.isValidSurinameAddress, containsHeavyItems, locale, subtotal]);

  const handleDeliveryTypeChange = (nextType: "delivery" | "pickup") => {
    if (nextType === "delivery" && !isValidSurinameAddress) {
      setValidationMessage(
        t.addressInvalid
      );
      return;
    }

    if (
      nextType === "delivery" &&
      serverDeliveryQuote &&
      !serverDeliveryQuote.requiresAgentReview &&
      !allowsDelivery
    ) {
      setValidationMessage(t.deliveryUnavailable);
      return;
    }

    setDeliveryType(nextType);

    if (nextType === "delivery") {
      setRequestedAgentCall(false);
      setPickupDate(null);
      setPickupTime("");
      setValidationMessage("");
    }
  };

  const effectiveDeliveryType =
    deliveryType === "delivery" &&
    serverDeliveryQuote &&
    !serverDeliveryQuote.requiresAgentReview &&
    !allowsDelivery
      ? "pickup"
      : deliveryType;
  const estimatedDeliveryFee =
    effectiveDeliveryType === "delivery" &&
    serverDeliveryQuote &&
    !serverDeliveryQuote.requiresAgentReview
      ? serverDeliveryQuote.fee
      : 0;
  const paymentPreview = useMemo(
    () =>
      calculateOrderPayment({
        baseTotalSrd: subtotal + estimatedDeliveryFee,
        paymentMethod,
        paypalDisplayCurrency,
      }),
    [estimatedDeliveryFee, paymentMethod, paypalDisplayCurrency, subtotal]
  );
  const selectedPaymentBreakdown = useMemo(() => {
    const useUsd = paymentMethod === "paypal" && paypalDisplayCurrency === "USD";
    const exchangeRate = paymentPreview.exchangeRateSrdPerUsd ?? 38;
    const convert = (value: number) => (useUsd ? value / exchangeRate : value);
    const format = (value: number) =>
      useUsd ? formatUsd(convert(value)) : formatSrd(value);

    return {
      items: format(subtotal),
      delivery: format(estimatedDeliveryFee),
      fee: format(paymentMethod === "paypal" ? paymentPreview.feeAmountSrd : 0),
      total: format(paymentMethod === "paypal" ? paymentPreview.grandTotalSrd : subtotal + estimatedDeliveryFee),
    };
  }, [estimatedDeliveryFee, paymentMethod, paymentPreview, paypalDisplayCurrency, subtotal]);
  const canUsePayPalForCurrentCheckout =
    effectiveDeliveryType === "pickup" ||
    Boolean(
      serverDeliveryQuote &&
        !isResolvingDeliveryQuote &&
        !serverDeliveryQuote.requiresAgentReview &&
        allowsDelivery
    );
  const paypalSelectionIsValid = paymentMethod !== "paypal" || canUsePayPalForCurrentCheckout;

  const isFormValid =
    name.trim().length >= 2 &&
    phone.trim().length >= 7 &&
    isValidEmailAddress(email) &&
    paypalSelectionIsValid &&
    (effectiveDeliveryType === "delivery"
      ? isValidSurinameAddress && !isResolvingDeliveryQuote && Boolean(serverDeliveryQuote)
      : Boolean(pickupDate && pickupTime));

  const handleSubmit = () => {
    if (effectiveDeliveryType === "delivery" && !isValidSurinameAddress) {
      setValidationMessage(t.addressInvalid);
      return;
    }

    if (effectiveDeliveryType === "delivery" && (isResolvingDeliveryQuote || !serverDeliveryQuote)) {
      setValidationMessage(t.deliveryCalculating);
      return;
    }

    if (
      effectiveDeliveryType === "delivery" &&
      serverDeliveryQuote &&
      !serverDeliveryQuote.requiresAgentReview &&
      !allowsDelivery
    ) {
      setDeliveryType("pickup");
      setValidationMessage(t.deliveryUnavailable);
      return;
    }

    if (!isFormValid) {
      setValidationMessage(t.validation);
      return;
    }

    if (paymentMethod === "paypal" && !canUsePayPalForCurrentCheckout) {
      setValidationMessage(t.paymentPaypalLocked);
      return;
    }

    setValidationMessage("");

    const requiresAgentReview =
      effectiveDeliveryType === "delivery" && Boolean(serverDeliveryQuote?.requiresAgentReview);

    onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: effectiveDeliveryType === "delivery" ? address.trim() : "",
      deliveryType: effectiveDeliveryType,
      pickupDate: effectiveDeliveryType === "pickup" ? pickupDate ?? undefined : undefined,
      pickupTime: effectiveDeliveryType === "pickup" ? pickupTime : undefined,
      requestedAgentCall:
        effectiveDeliveryType === "pickup"
          ? requestedAgentCall
          : requiresAgentReview,
      containsHeavyItems,
      deliveryDistanceKm:
        effectiveDeliveryType === "delivery" &&
        serverDeliveryQuote &&
        !requiresAgentReview &&
        serverDeliveryQuote.distanceKm > 0
          ? serverDeliveryQuote.distanceKm
          : undefined,
      deliveryFee:
        effectiveDeliveryType === "delivery" &&
        serverDeliveryQuote &&
        !requiresAgentReview
          ? serverDeliveryQuote.fee
          : undefined,
      paymentMethod,
      paypalDisplayCurrency: paymentMethod === "paypal" ? paypalDisplayCurrency : null,
      paymentFeeRate: paymentPreview.feeRate,
      paymentFeeAmountSrd: paymentPreview.feeAmountSrd,
      paymentGrandTotalSrd: paymentPreview.grandTotalSrd,
      paymentPayableUsd: paymentPreview.payableUsd,
      exchangeRateSrdPerUsd: paymentPreview.exchangeRateSrdPerUsd,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-2 py-2 sm:items-center sm:px-4 sm:py-4">
      <div className="scrollbar-hidden max-h-[calc(100dvh-0.5rem)] w-full max-w-[min(100vw-0.5rem,40rem)] overflow-y-auto rounded-[1.45rem] border border-slate-800 bg-[#050816] p-3.5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:max-h-[calc(100dvh-1rem)] sm:max-w-[min(100vw-0.75rem,40rem)] sm:rounded-[2rem] sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white sm:text-lg">{t.title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
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

        <div className="space-y-4">
          <input
            type="text"
            placeholder={t.name}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-3.5 py-2.5 text-base text-white outline-none transition focus:border-cyan-400 sm:px-4 sm:py-3 sm:text-sm"
          />

          <input
            type="tel"
            placeholder={t.phone}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-3.5 py-2.5 text-base text-white outline-none transition focus:border-cyan-400 sm:px-4 sm:py-3 sm:text-sm"
          />

          <input
            type="email"
            placeholder={t.email}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-3.5 py-2.5 text-base text-white outline-none transition focus:border-cyan-400 sm:px-4 sm:py-3 sm:text-sm"
          />

          <AddressAutocompleteField
            placeholder={t.address}
            value={address}
            locale={locale}
            onChange={(nextValue) => {
              setAddress(nextValue);
              setValidationMessage("");
            }}
            className="w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-3.5 py-2.5 pr-12 text-base text-white outline-none transition focus:border-cyan-400 sm:px-4 sm:py-3 sm:pr-12 sm:text-sm"
          />

          {!isValidSurinameAddress && address.trim().length > 0 ? (
            <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {t.addressInvalid}
            </p>
          ) : null}

          {isValidSurinameAddress && deliveryType === "delivery" && isResolvingDeliveryQuote ? (
            <p className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
              {t.deliveryCalculating}
            </p>
          ) : null}

          {serverDeliveryQuote?.isValidSurinameAddress && serverDeliveryQuote.requiresAgentReview ? (
            <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {t.deliveryReview}
            </p>
          ) : null}

          {serverDeliveryQuote?.isValidSurinameAddress &&
          !serverDeliveryQuote.requiresAgentReview &&
          serverDeliveryQuote.distanceKm > 0 &&
          !allowsDelivery ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <p>{t.deliveryUnavailable}</p>
            </div>
          ) : null}

          <div className="space-y-3 rounded-2xl border border-slate-800 bg-[#0a1020] p-3.5 sm:p-4">
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-2.5 transition sm:px-4 sm:py-3 ${
                effectiveDeliveryType === "delivery"
                  ? "border-pink-400 bg-pink-500/12 text-white"
                  : "border-slate-700 bg-[#050816] text-slate-200 hover:border-slate-500"
              } ${
                !isValidSurinameAddress ||
                (serverDeliveryQuote !== null &&
                  !serverDeliveryQuote.requiresAgentReview &&
                  !allowsDelivery)
                  ? "cursor-not-allowed opacity-60"
                  : ""
              }`}
            >
              <input
                type="radio"
                name="deliveryType"
                value="delivery"
                checked={effectiveDeliveryType === "delivery"}
                onChange={() => handleDeliveryTypeChange("delivery")}
                className="checkout-choice__input"
                disabled={
                  !isValidSurinameAddress ||
                  (serverDeliveryQuote !== null &&
                    !serverDeliveryQuote.requiresAgentReview &&
                    !allowsDelivery)
                }
              />
              <span className="checkout-choice__control" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13px] text-slate-200 sm:text-sm">{t.delivery}</span>
                {serverDeliveryQuote?.isValidSurinameAddress &&
                allowsDelivery &&
                !serverDeliveryQuote.requiresAgentReview &&
                serverDeliveryQuote.distanceKm > 0 ? (
                  <span className="mt-1 text-[11px] font-medium leading-4 text-cyan-100 sm:text-xs">
                    {t.deliveryEstimate(serverDeliveryQuote.fee)} · {serverDeliveryQuote.distanceKm.toFixed(1)} km
                  </span>
                ) : null}
              </span>
            </label>

            <label
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-2.5 transition sm:px-4 sm:py-3 ${
                effectiveDeliveryType === "pickup"
                  ? "border-pink-400 bg-pink-500/12 text-white"
                  : "border-slate-700 bg-[#050816] text-slate-200 hover:border-slate-500"
              }`}
            >
              <input
                type="radio"
                name="deliveryType"
                value="pickup"
                checked={effectiveDeliveryType === "pickup"}
                onChange={() => handleDeliveryTypeChange("pickup")}
                className="checkout-choice__input"
              />
              <span className="checkout-choice__control" aria-hidden="true" />
              <span className="text-[13px] text-slate-200 sm:text-sm">{t.pickup}</span>
            </label>
          </div>

          {effectiveDeliveryType === "pickup" ? (
            <div className="space-y-4 rounded-2xl border border-slate-800 bg-[#0a1020] p-3.5 sm:p-4">
              <p className="text-sm text-slate-400">{t.pickupDescription}</p>
              <p className="rounded-2xl border border-slate-800 bg-[#050816] px-4 py-3 text-sm font-medium text-slate-200">
                {t.pickupAddress.replace("Anton Drachtenweg 146", PICKUP_ADDRESS)}
              </p>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  {t.selectDate}
                </label>
                <DatePicker
                  selected={pickupDate}
                  onChange={(date: Date | null) => setPickupDate(date)}
                  filterDate={isWeekday}
                  minDate={new Date()}
                  maxDate={maxDate}
                  className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-3.5 py-2.5 text-base text-white outline-none transition focus:border-cyan-400 sm:px-4 sm:py-3 sm:text-sm"
                  placeholderText={t.selectDate}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  {t.selectTime}
                </label>
                <select
                  value={pickupTime}
                  onChange={(event) => setPickupTime(event.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-3.5 py-2.5 text-base text-white outline-none transition focus:border-cyan-400 sm:px-4 sm:py-3 sm:text-sm"
                >
                  <option value="">{t.selectTime}</option>
                  {PICKUP_TIME_OPTIONS.map((timeOption) => (
                    <option key={timeOption.value} value={timeOption.value}>
                      {timeOption.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-teal-500/20 bg-teal-500/10 p-3.5 sm:p-4">
                <input
                  type="checkbox"
                  checked={requestedAgentCall}
                  onChange={(event) => setRequestedAgentCall(event.target.checked)}
                  className="mt-1"
                />
                <span className="space-y-1 text-sm">
                  <span className="block font-semibold text-white">
                    {t.requestAgentCall}
                  </span>
                  <span className="block text-slate-300">
                    {t.requestAgentCallDescription}
                  </span>
                </span>
              </label>
            </div>
          ) : null}

          <div className="space-y-4 rounded-2xl border border-slate-800 bg-[#0a1020] p-3.5 sm:p-4">
            <p className="text-sm font-semibold text-white">{t.paymentTitle}</p>

            <div className="grid gap-3">
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-2.5 transition sm:px-4 sm:py-3 ${
                  paymentMethod === "cash"
                    ? "border-pink-400 bg-pink-500/12 text-white"
                    : "border-slate-700 bg-[#050816] text-slate-200 hover:border-slate-500"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cash"
                  checked={paymentMethod === "cash"}
                  onChange={() => setPaymentMethod("cash")}
                  className="checkout-choice__input"
                />
                <span className="checkout-choice__control" aria-hidden="true" />
                <span className="text-[13px] font-semibold sm:text-sm">{t.paymentCash}</span>
              </label>

              <label
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-2.5 transition sm:px-4 sm:py-3 ${
                  paymentMethod === "paypal"
                    ? "border-pink-400 bg-pink-500/12 text-white"
                    : "border-slate-700 bg-[#050816] text-slate-200 hover:border-slate-500"
                } ${!canUsePayPalForCurrentCheckout && paymentMethod !== "paypal" ? "opacity-60" : ""}`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="paypal"
                  checked={paymentMethod === "paypal"}
                  onChange={() => setPaymentMethod("paypal")}
                  className="checkout-choice__input"
                  disabled={!canUsePayPalForCurrentCheckout && paymentMethod !== "paypal"}
                />
                <span className="checkout-choice__control" aria-hidden="true" />
                <span className="text-sm font-semibold">{t.paymentPaypal}</span>
              </label>
            </div>

            {paymentMethod === "paypal" ? (
              <div className="space-y-3 rounded-2xl border border-pink-500/20 bg-pink-500/10 p-4">
                <div className="rounded-2xl border border-amber-400/30 bg-amber-400/12 px-4 py-3 text-sm text-amber-100">
                  {t.paymentPaypalHint}
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-pink-100">
                  {t.paymentCurrencyTitle}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                      paypalDisplayCurrency === "SRD"
                        ? "border-pink-400 bg-[#220715] text-white"
                        : "border-slate-700 bg-[#050816] text-slate-200 hover:border-slate-500"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paypalDisplayCurrency"
                      value="SRD"
                      checked={paypalDisplayCurrency === "SRD"}
                      onChange={() => setPaypalDisplayCurrency("SRD")}
                      className="checkout-choice__input"
                    />
                    <span className="checkout-choice__control" aria-hidden="true" />
                    <span className="text-sm font-semibold">{t.paymentInSrd}</span>
                  </label>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                      paypalDisplayCurrency === "USD"
                        ? "border-pink-400 bg-[#220715] text-white"
                        : "border-slate-700 bg-[#050816] text-slate-200 hover:border-slate-500"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paypalDisplayCurrency"
                      value="USD"
                      checked={paypalDisplayCurrency === "USD"}
                      onChange={() => setPaypalDisplayCurrency("USD")}
                      className="checkout-choice__input"
                    />
                    <span className="checkout-choice__control" aria-hidden="true" />
                    <span className="text-sm font-semibold">{t.paymentInUsd}</span>
                  </label>
                </div>
              </div>
            ) : null}

            {paymentMethod === "paypal" && !canUsePayPalForCurrentCheckout ? (
              <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {t.paymentPaypalLocked}
              </p>
            ) : null}

            <div className="rounded-2xl border border-slate-800 bg-[#050816] px-4 py-3">
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>{t.paymentItems}</span>
                  <span className="font-semibold text-white">{selectedPaymentBreakdown.items}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t.paymentDelivery}</span>
                  <span className="font-semibold text-white">{selectedPaymentBreakdown.delivery}</span>
                </div>
                {paymentMethod === "paypal" ? (
                  <div className="flex items-center justify-between">
                    <span>{t.paymentFee}</span>
                    <span className="font-semibold text-white">{selectedPaymentBreakdown.fee}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                  <span className="font-semibold text-white">{t.paymentTotal}</span>
                  <span className="font-semibold text-white">{selectedPaymentBreakdown.total}</span>
                </div>
              </div>
            </div>
          </div>

          {validationMessage ? (
            <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {validationMessage}
            </p>
          ) : null}

          <button
            onClick={handleSubmit}
            disabled={!isFormValid}
            className="w-full rounded-2xl bg-cyan-500 py-3 text-sm font-semibold text-slate-950 disabled:bg-slate-700 disabled:text-slate-300"
          >
            {t.continue}
          </button>
        </div>
      </div>
    </div>
  );
}
