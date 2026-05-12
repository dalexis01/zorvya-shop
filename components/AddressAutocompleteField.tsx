"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { getDeliveryAddressSuggestions } from "@/helpers/delivery";
import type { Locale } from "@/lib/shop/types";

type AddressAutocompleteFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className: string;
  locale: Locale;
  disabled?: boolean;
  maxSuggestions?: number;
  panelClassName?: string;
  suggestionClassName?: string;
  headerClassName?: string;
  dividerClassName?: string;
  badgeClassName?: string;
  emptyStateClassName?: string;
  actionRowContent?: ReactNode;
  onSuggestionsChange?: (state: {
    query: string;
    suggestions: string[];
    isLoading: boolean;
  }) => void;
};

const texts = {
  es: {
    valid: "Valida",
    searching: "Buscando",
    header: "Buscador de direcciones reales",
    searchingDirections: "Buscando direcciones reales...",
    empty:
      "No encontramos una direccion exacta con esa busqueda. Antes del envio un agente se pondra en contacto con usted.",
    real: "Real",
    shareLocation: "Compartir ubicacion",
    locating: "Ubicando...",
    confirmAddress: "Confirmar direccion detectada",
    useAddress: "Usar esta direccion",
    cancel: "Cancelar",
    locationUnsupported: "Tu navegador no permite compartir ubicacion.",
    locationDenied: "No pudimos leer tu ubicacion actual.",
  },
  nl: {
    valid: "Geldig",
    searching: "Zoeken",
    header: "Zoeker voor echte adressen",
    searchingDirections: "Echte adressen zoeken...",
    empty:
      "We konden dit adres niet exact berekenen. Voor levering neemt een agent eerst contact met u op.",
    real: "Echt",
    shareLocation: "Locatie delen",
    locating: "Locatie ophalen...",
    confirmAddress: "Bevestig het gevonden adres",
    useAddress: "Dit adres gebruiken",
    cancel: "Annuleren",
    locationUnsupported: "Uw browser ondersteunt locatie delen niet.",
    locationDenied: "We konden uw huidige locatie niet lezen.",
  },
  en: {
    valid: "Valid",
    searching: "Searching",
    header: "Real address finder",
    searchingDirections: "Searching real addresses...",
    empty:
      "We could not calculate this address exactly. An agent will contact you before delivery.",
    real: "Real",
    shareLocation: "Share location",
    locating: "Locating...",
    confirmAddress: "Confirm detected address",
    useAddress: "Use this address",
    cancel: "Cancel",
    locationUnsupported: "Your browser does not support location sharing.",
    locationDenied: "We could not read your current location.",
  },
  pt: {
    valid: "Valido",
    searching: "Buscando",
    header: "Buscador de enderecos reais",
    searchingDirections: "Buscando enderecos reais...",
    empty:
      "Nao conseguimos calcular este endereco com exatidao. Um agente entrara em contato antes da entrega.",
    real: "Real",
    shareLocation: "Compartilhar localizacao",
    locating: "Localizando...",
    confirmAddress: "Confirmar endereco detectado",
    useAddress: "Usar este endereco",
    cancel: "Cancelar",
    locationUnsupported: "Seu navegador nao permite compartilhar localizacao.",
    locationDenied: "Nao conseguimos ler sua localizacao atual.",
  },
} as const;

export default function AddressAutocompleteField({
  value,
  onChange,
  placeholder,
  className,
  locale,
  disabled = false,
  maxSuggestions = 6,
  panelClassName = "border border-slate-700 bg-[#050816]",
  suggestionClassName = "text-slate-200 hover:bg-[#0a1020]",
  headerClassName = "border-slate-800 text-slate-500",
  dividerClassName = "divide-slate-800",
  badgeClassName = "text-cyan-300",
  emptyStateClassName = "text-slate-500",
  actionRowContent,
  onSuggestionsChange,
}: AddressAutocompleteFieldProps) {
  const t = texts[locale];
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [selectedValue, setSelectedValue] = useState("");
  const [locationError, setLocationError] = useState("");
  const [detectedAddress, setDetectedAddress] = useState("");
  const localSuggestions = useMemo(
    () => getDeliveryAddressSuggestions(value, maxSuggestions),
    [maxSuggestions, value]
  );
  const [remoteState, setRemoteState] = useState<{
    query: string;
    suggestions: string[];
  }>({
    query: "",
    suggestions: [],
  });
  const suggestions = useMemo(() => {
    const remoteSuggestions = remoteState.query === value.trim() ? remoteState.suggestions : [];

    return Array.from(new Set([...remoteSuggestions, ...localSuggestions])).slice(
      0,
      maxSuggestions
    );
  }, [localSuggestions, maxSuggestions, remoteState, value]);
  const hasQuery = value.trim().length >= 2;
  const shouldShowSuggestions = !disabled && isFocused && hasQuery;

  useEffect(() => {
    onSuggestionsChange?.({
      query: value.trim(),
      suggestions,
      isLoading,
    });
  }, [isLoading, onSuggestionsChange, suggestions, value]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const trimmedValue = value.trim();

    if (disabled || trimmedValue.length < 2) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/address-suggestions?q=${encodeURIComponent(value.trim())}&locale=${locale}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const payload = (await response.json()) as {
          suggestions?: string[];
        };

        setRemoteState({
          query: trimmedValue,
          suggestions: payload.suggestions ?? [],
        });
      } catch {
        setRemoteState({
          query: trimmedValue,
          suggestions: [],
        });
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [disabled, locale, value]);

  const useDetectedAddress = () => {
    if (!detectedAddress) {
      return;
    }

    onChange(detectedAddress);
    setSelectedValue(detectedAddress.trim());
    setDetectedAddress("");
    setLocationError("");
    setIsFocused(false);
  };

  const handleShareLocation = () => {
    if (disabled || isLocating) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError(t.locationUnsupported);
      return;
    }

    setIsLocating(true);
    setLocationError("");
    setDetectedAddress("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch(
            `/api/reverse-geocode?latitude=${encodeURIComponent(
              String(position.coords.latitude)
            )}&longitude=${encodeURIComponent(String(position.coords.longitude))}&locale=${locale}`,
            {
              cache: "no-store",
            }
          );

          const payload = (await response.json()) as {
            success?: boolean;
            address?: string;
            error?: string;
          };

          if (!response.ok || !payload.success || !payload.address) {
            throw new Error(payload.error || t.locationDenied);
          }

          setDetectedAddress(payload.address);
          setIsFocused(false);
        } catch (error) {
          setLocationError(error instanceof Error ? error.message : t.locationDenied);
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setLocationError(t.locationDenied);
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div ref={wrapperRef} className="relative space-y-2">
      <div className="relative">
        <input
          type="text"
          value={value}
          onFocus={() => setIsFocused(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setSelectedValue("");
            setDetectedAddress("");
            setLocationError("");
            setIsFocused(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
        />
        <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
          {selectedValue && selectedValue === value.trim() ? (
            <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
              {t.valid}
            </span>
          ) : isLoading ? (
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              {t.searching}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {actionRowContent}
        </div>
        <button
          type="button"
          onClick={handleShareLocation}
          disabled={disabled || isLocating}
          className="rounded-full border border-slate-600 bg-[#0a1020] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300 transition hover:border-cyan-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLocating ? t.locating : t.shareLocation}
        </button>
      </div>

      {locationError ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {locationError}
        </div>
      ) : null}

      {detectedAddress ? (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          <p className="font-semibold">{t.confirmAddress}</p>
          <p className="mt-2">{detectedAddress}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={useDetectedAddress}
              className="rounded-full bg-cyan-400 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-950"
            >
              {t.useAddress}
            </button>
            <button
              type="button"
              onClick={() => setDetectedAddress("")}
              className="rounded-full border border-slate-600 bg-[#050816] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      ) : null}

      {shouldShowSuggestions ? (
        <div
          className={`absolute inset-x-0 top-[calc(100%+4.8rem)] z-40 overflow-hidden rounded-2xl shadow-[0_18px_50px_rgba(0,0,0,0.28)] ${panelClassName}`}
        >
          <div
            className={`border-b px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] ${headerClassName}`}
          >
            {t.header}
          </div>
          {suggestions.length > 0 ? (
            <div className={`divide-y ${dividerClassName}`}>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(suggestion);
                    setSelectedValue(suggestion.trim());
                    setDetectedAddress("");
                    setLocationError("");
                    setIsFocused(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition ${suggestionClassName}`}
                >
                  <span>{suggestion}</span>
                  <span
                    className={`shrink-0 text-[10px] uppercase tracking-[0.18em] ${badgeClassName}`}
                  >
                    {t.real}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className={`px-4 py-4 text-sm ${emptyStateClassName}`}>
              {isLoading ? t.searchingDirections : t.empty}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
