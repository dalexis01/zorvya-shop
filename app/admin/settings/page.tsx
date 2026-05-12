/* eslint-disable @next/next/no-img-element */
"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

import { ACCEPTED_IMAGE_TYPES, imageFileToDataUrl } from "@/lib/shop/image-upload";
import type {
  HomepageBlock,
  HomepageCatalogSource,
  HomepageSettings,
  PayPalSettings,
  Product,
} from "@/lib/shop/admin-types";
import {
  createAnnouncementBlock,
  createBannerBlock,
  createCatalogBlock,
  createDefaultHomepageBlocks,
  createInfoBlock,
  normalizeHomepageBlocks,
  resolveHomepageBlockProducts,
} from "@/lib/shop/homepage-blocks";
import {
  createDefaultHomepageVisualStyles,
  HOMEPAGE_FONT_OPTIONS,
  hexToRgba,
  normalizeHomepageVisualStyles,
} from "@/lib/shop/homepage-visuals";
import { formatCurrencySrd } from "@/lib/shop/number-format";
import type { Locale } from "@/lib/shop/types";

const locales: Locale[] = ["es", "nl", "en", "pt"];
const catalogSourceOptions: Array<{ value: HomepageCatalogSource; label: string }> = [
  { value: "featured", label: "Destacados" },
  { value: "top", label: "Top ventas" },
  { value: "promotions", label: "Promociones" },
  { value: "newProducts", label: "Nuevos productos" },
  { value: "allProducts", label: "Todos los productos" },
  { value: "ads", label: "Anuncios en feed" },
  { value: "custom", label: "Catalogo manual" },
];
const fontWeightOptions = [
  { label: "Regular", value: 400 },
  { label: "Medium", value: 500 },
  { label: "Semi bold", value: 600 },
  { label: "Bold", value: 700 },
] as const;
const themeColorOptions = [
  { key: "primary", label: "Primario" },
  { key: "secondary", label: "Secundario" },
  { key: "accent", label: "Acento" },
  { key: "backgroundStart", label: "Fondo inicio" },
  { key: "backgroundEnd", label: "Fondo final" },
  { key: "backgroundGlow", label: "Brillo superior" },
  { key: "panel", label: "Panel principal" },
  { key: "panelAlt", label: "Panel alterno" },
  { key: "headerSurface", label: "Header" },
  { key: "searchStart", label: "Buscador inicio" },
  { key: "searchCenter", label: "Buscador centro" },
  { key: "searchEnd", label: "Buscador final" },
  { key: "marqueeStart", label: "Franja inicio" },
  { key: "marqueeCenter", label: "Franja centro" },
  { key: "marqueeEnd", label: "Franja final" },
] as const;

type SettingsResponse = {
  success?: boolean;
  settings?: HomepageSettings;
};

type ProductsResponse = {
  success?: boolean;
  products?: Product[];
};

type PayPalSettingsResponse = {
  success?: boolean;
  settings?: PayPalSettings;
  configured?: boolean;
  source?: "admin" | "env";
  error?: string;
};

function createFixedHeaderButtons() {
  return [
    { id: "languages", label: "Idiomas", target: "languages", isEnabled: true, order: 1 },
    { id: "account", label: "Cuenta", target: "account", isEnabled: true, order: 2 },
    { id: "cart", label: "Carrito", target: "cart", isEnabled: true, order: 3 },
    { id: "support", label: "Soporte", target: "support", isEnabled: true, order: 4 },
  ] as HomepageSettings["buttonOrder"];
}

function createEmptySettings(): HomepageSettings {
  return {
    brandName: "ZorvyA",
    brandTagline: "",
    logoImageUrl: "",
    logoText: "Z",
    logoSize: 44,
    headerSearchEnabled: true,
    heroImageUrl: "",
    heroPrimaryButtonHref: "#catalogo",
    heroSecondaryButtonHref: "#support",
    theme: {
      primary: "#22d3ee",
      secondary: "#2563eb",
      accent: "#f43f5e",
      backgroundStart: "#02030a",
      backgroundEnd: "#050816",
      backgroundGlow: "#0891b2",
      panel: "#050816",
      panelAlt: "#0a1020",
      headerSurface: "#030611",
      searchStart: "#0f172a",
      searchCenter: "#082f49",
      searchEnd: "#0f172a",
      marqueeStart: "#0f172a",
      marqueeCenter: "#082f49",
      marqueeEnd: "#0f172a",
    },
    styles: createDefaultHomepageVisualStyles(),
    blocks: createDefaultHomepageBlocks(),
    banners: [],
    buttonOrder: createFixedHeaderButtons(),
    sectionOrder: [],
    localizedContent: {
      es: {
        promoBarText: "",
        searchPlaceholder: "",
        heroEyebrow: "",
        heroTitle: "",
        heroDescription: "",
        heroPrimaryButtonLabel: "",
        heroSecondaryButtonLabel: "",
      },
      nl: {
        promoBarText: "",
        searchPlaceholder: "",
        heroEyebrow: "",
        heroTitle: "",
        heroDescription: "",
        heroPrimaryButtonLabel: "",
        heroSecondaryButtonLabel: "",
      },
      en: {
        promoBarText: "",
        searchPlaceholder: "",
        heroEyebrow: "",
        heroTitle: "",
        heroDescription: "",
        heroPrimaryButtonLabel: "",
        heroSecondaryButtonLabel: "",
      },
      pt: {
        promoBarText: "",
        searchPlaceholder: "",
        heroEyebrow: "",
        heroTitle: "",
        heroDescription: "",
        heroPrimaryButtonLabel: "",
        heroSecondaryButtonLabel: "",
      },
    },
    updatedAt: "",
  };
}

function createEmptyPayPalSettings(): PayPalSettings {
  return {
    enabled: false,
    accountDisplayName: "Cuenta principal PayPal",
    accountEmail: "",
    clientId: "",
    clientSecret: "",
    environment: "sandbox",
    apiBaseUrl: "",
    updatedAt: "",
  };
}

function normalizeClientSettings(
  value: Partial<HomepageSettings> | HomepageSettings | null | undefined
): HomepageSettings {
  const fallback = createEmptySettings();
  const source = value ?? {};

  return {
    ...fallback,
    ...source,
    theme: {
      ...fallback.theme,
      ...(source.theme ?? {}),
    },
    styles: normalizeHomepageVisualStyles(source.styles),
    blocks: normalizeHomepageBlocks(source.blocks, source.banners, source.sectionOrder),
    buttonOrder: createFixedHeaderButtons(),
    headerSearchEnabled: source.headerSearchEnabled ?? fallback.headerSearchEnabled,
    localizedContent: {
      es: {
        ...fallback.localizedContent.es,
        ...(source.localizedContent?.es ?? {}),
      },
      nl: {
        ...fallback.localizedContent.nl,
        ...(source.localizedContent?.nl ?? {}),
      },
      en: {
        ...fallback.localizedContent.en,
        ...(source.localizedContent?.en ?? {}),
      },
      pt: {
        ...fallback.localizedContent.pt,
        ...(source.localizedContent?.pt ?? {}),
      },
    },
  };
}

function normalizeClientPayPalSettings(
  value: Partial<PayPalSettings> | PayPalSettings | null | undefined
): PayPalSettings {
  const fallback = createEmptyPayPalSettings();
  const source = value ?? {};

  return {
    ...fallback,
    ...source,
    enabled: source.enabled ?? fallback.enabled,
    accountDisplayName: (source.accountDisplayName ?? fallback.accountDisplayName).trim(),
    accountEmail: (source.accountEmail ?? fallback.accountEmail).trim(),
    clientId: (source.clientId ?? fallback.clientId).trim(),
    clientSecret: (source.clientSecret ?? fallback.clientSecret).trim(),
    environment: source.environment === "live" ? "live" : "sandbox",
    apiBaseUrl: (source.apiBaseUrl ?? fallback.apiBaseUrl).trim(),
    updatedAt: (source.updatedAt ?? fallback.updatedAt).trim(),
  };
}

function maskSensitiveValue(value: string, visibleTail = 4) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "Sin configurar";
  }

  if (trimmed.length <= visibleTail) {
    return "•".repeat(trimmed.length);
  }

  return `${"•".repeat(Math.max(6, trimmed.length - visibleTail))}${trimmed.slice(-visibleTail)}`;
}

function renumberOrderedItems<T extends { order: number }>(items: T[]) {
  return items.map((item, index) => ({
    ...item,
    order: index + 1,
  }));
}

function moveOrderedItem<T extends { order: number }>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const nextItems = [...items];
  const currentItem = nextItems[index];

  nextItems[index] = nextItems[nextIndex];
  nextItems[nextIndex] = currentItem;

  return renumberOrderedItems(nextItems);
}

function sortOrderedItems<T extends { order: number }>(items: T[]) {
  return [...items].sort((left, right) => left.order - right.order);
}

function getBlockTone(block: HomepageBlock) {
  if (block.type === "hero") {
    return "text-cyan-300";
  }

  if (block.type === "banner") {
    return "text-rose-300";
  }

  if (block.type === "announcement") {
    return "text-amber-200";
  }

  if (block.type === "info") {
    return "text-violet-300";
  }

  switch (block.catalogSource) {
    case "featured":
      return "text-cyan-300";
    case "top":
      return "text-rose-300";
    case "promotions":
      return "text-amber-200";
    case "newProducts":
      return "text-emerald-300";
    case "ads":
      return "text-sky-300";
    default:
      return "text-slate-400";
  }
}

function getBlockTypeLabel(block: HomepageBlock) {
  if (block.type === "catalog") {
    return block.catalogSource === "custom"
      ? "catalogo manual"
      : `catalogo ${block.catalogSource ?? "custom"}`;
  }

  return block.type;
}

function parsePromoMessages(value: string | undefined) {
  return (value ?? "")
    .split(/\r?\n|\|/g)
    .map((message) => message.trim())
    .filter(Boolean);
}

function normalizePreviewText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function SettingsToggle({
  checked,
  label,
  description,
  onChange,
  enabledLabel = "Visible",
  disabledLabel = "Oculto",
}: {
  checked: boolean;
  label: string;
  description?: string;
  onChange: (value: boolean) => void;
  enabledLabel?: string;
  disabledLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-4 rounded-[1.25rem] border px-4 py-3 text-left transition ${
        checked
          ? "border-cyan-500/40 bg-cyan-500/10"
          : "border-slate-700 bg-[#050816] hover:border-slate-500"
      }`}
    >
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${checked ? "text-cyan-200" : "text-slate-500"}`}>
          {checked ? enabledLabel : disabledLabel}
        </span>
        <span
          className={`relative inline-flex h-7 w-12 rounded-full transition ${
            checked ? "bg-cyan-400" : "bg-slate-700"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
              checked ? "left-6" : "left-1"
            }`}
          />
        </span>
      </div>
    </button>
  );
}

function formatPreviewCurrency(value: number) {
  return formatCurrencySrd(value);
}

function createPreviewStars(rating: number) {
  const fullStars = Math.max(1, Math.min(5, Math.round(rating || 0)));
  return "★".repeat(fullStars).padEnd(5, "☆");
}

function getPreviewProductImage(product: Product) {
  return product.images.find((image) => image.isPrimary)?.url ?? product.images[0]?.url ?? "";
}

function PreviewHeaderActions({
  buttonStyle,
  cartCount,
}: {
  buttonStyle: CSSProperties;
  cartCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="button-borders">
        <button type="button" className="primary-button" style={buttonStyle}>
          Cuenta
        </button>
      </div>
      <button
        type="button"
        className="store-cart-btn"
        data-count={cartCount}
        aria-label={`Carrito (${cartCount})`}
      >
        <span className="store-cart-btn__wrapper">
          <span className="store-cart-btn__text" style={buttonStyle}>
            Carrito
          </span>
          <span className="store-cart-btn__icon" aria-hidden="true">
            <svg
              viewBox="0 0 16 16"
              fill="currentColor"
              height="16"
              width="16"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M0 2.5A.5.5 0 0 1 .5 2H2a.5.5 0 0 1 .485.379L2.89 4H14.5a.5.5 0 0 1 .485.621l-1.5 6A.5.5 0 0 1 13 11H4a.5.5 0 0 1-.485-.379L1.61 3H.5a.5.5 0 0 1-.5-.5zM3.14 5l1.25 5h8.22l1.25-5H3.14zM5 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-2 1a2 2 0 1 1 4 0 2 2 0 0 1-4 0zm9-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-2 1a2 2 0 1 1 4 0 2 2 0 0 1-4 0z" />
            </svg>
          </span>
        </span>
      </button>
      <button type="button" className="shadow__btn" style={buttonStyle}>
        Soporte
      </button>
    </div>
  );
}

function PayPalSettingsPreview({
  settings,
  configured,
  source,
}: {
  settings: PayPalSettings;
  configured: boolean;
  source: "admin" | "env";
}) {
  return (
    <div className="rounded-[1.75rem] border border-slate-800 bg-[#050816] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">PayPal</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Cuenta principal de cobro</h3>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
            configured
              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border border-amber-500/30 bg-amber-500/10 text-amber-200"
          }`}
        >
          {configured ? "Configurado" : "Pendiente"}
        </span>
      </div>

      <div className="mt-5 grid gap-3">
        <div className="rounded-[1.25rem] border border-slate-800 bg-[#0a1020] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Origen</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {source === "admin" ? "Guardado desde el panel administrador" : "Tomado de variables del servidor"}
          </p>
        </div>
        <div className="rounded-[1.25rem] border border-slate-800 bg-[#0a1020] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Cuenta</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {settings.accountDisplayName || "Cuenta principal PayPal"}
          </p>
          <p className="mt-1 text-xs text-slate-400">{settings.accountEmail || "Sin correo de referencia"}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[1.25rem] border border-slate-800 bg-[#0a1020] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Modo</p>
            <p className="mt-2 text-sm font-semibold text-cyan-300">
              {settings.environment === "live" ? "Live / Produccion" : "Sandbox / Pruebas"}
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-slate-800 bg-[#0a1020] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Client ID</p>
            <p className="mt-2 text-xs font-semibold text-white">{maskSensitiveValue(settings.clientId, 6)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewCatalogCard({
  product,
  buttonStyle,
  cardTitleStyle,
  paragraphStyle,
}: {
  product: Product;
  buttonStyle: CSSProperties;
  cardTitleStyle: CSSProperties;
  paragraphStyle: CSSProperties;
}) {
  const imageUrl = getPreviewProductImage(product);
  const hasFreeDelivery = normalizePreviewText(product.deliveryLabel || "").includes("gratis");

  return (
    <article className="group overflow-hidden rounded-[2rem] border border-slate-800 bg-[#050816] shadow-[0_20px_60px_rgba(0,0,0,0.24)] transition hover:-translate-y-1 hover:border-cyan-500/40">
      <div className="relative aspect-[4/3] overflow-hidden border-b border-slate-800 bg-[#030712]">
        {imageUrl ? (
          <img src={imageUrl} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">Sin imagen</div>
        )}
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-black/55 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur">
            {product.inventoryLabel || product.brand || "Producto"}
          </span>
          {product.isTop ? (
            <span className="rounded-full bg-cyan-400 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-950">
              TOP
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {product.brand} / {product.category}
          </p>
          <h3 className="line-clamp-2 text-sm font-semibold leading-6 text-white" style={cardTitleStyle}>
            {product.name}
          </h3>
          <p className="line-clamp-2 text-xs leading-6 text-slate-400" style={paragraphStyle}>
            {product.shortDescription}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-300">
          <span className="rounded-full border border-slate-700 bg-[#050816] px-3 py-1">
            {product.inventoryLabel || "Almacen local"}
          </span>
          {hasFreeDelivery ? (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-emerald-200">
              Delivery gratis
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs tracking-[0.15em] text-amber-300">
                {createPreviewStars(product.rating)}
              </span>
              <span className="text-[11px] text-slate-500">{product.reviewCount} resenas</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-base font-semibold text-white">{formatPreviewCurrency(product.price)}</span>
              {product.originalPrice ? (
                <span className="text-xs text-slate-500 line-through">
                  {formatPreviewCurrency(product.originalPrice)}
                </span>
              ) : null}
            </div>
          </div>
          <span className="rounded-full border border-slate-700 bg-[#050816] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            Ver detalle
          </span>
        </div>

        <div className="flex justify-center">
          <button type="button" className="shadow__btn" style={buttonStyle}>
            Agregar al carrito
          </button>
        </div>
      </div>
    </article>
  );
}

function HomepageLivePreview({
  settings,
  products,
  locale,
}: {
  settings: HomepageSettings;
  products: Product[];
  locale: Locale;
}) {
  const localizedContent = settings.localizedContent[locale] ?? settings.localizedContent.es;
  const visualStyles = normalizeHomepageVisualStyles(settings.styles);
  const orderedBlocks = sortOrderedItems(settings.blocks).filter((block) => block.isEnabled);
  const activeProducts = products.filter((product) => product.isActive && product.isVisible);
  const featuredProducts = activeProducts.filter((product) => product.isFeatured);
  const topProducts = activeProducts.filter((product) => product.isTop);
  const promoMessages = parsePromoMessages(localizedContent.promoBarText);
  const bodyStyle = {
    fontFamily: visualStyles.typography.primaryFont,
    fontSize: `${visualStyles.typography.baseFontSize}px`,
    fontWeight: visualStyles.typography.baseFontWeight,
    background: `radial-gradient(circle at top, ${hexToRgba(settings.theme.backgroundGlow, 0.18)}, transparent 28%), linear-gradient(180deg, ${settings.theme.backgroundStart} 0%, ${settings.theme.backgroundEnd} 100%)`,
  };
  const secondaryFontStyle = {
    fontFamily: visualStyles.typography.secondaryFont,
  };
  const heroTitleStyle = {
    fontFamily: visualStyles.typography.secondaryFont,
    fontSize: `${visualStyles.headings.h1Size}px`,
    lineHeight: 1.02,
  };
  const sectionTitleStyle = {
    fontFamily: visualStyles.typography.secondaryFont,
    fontSize: `${visualStyles.headings.h2Size}px`,
    lineHeight: 1.08,
  };
  const cardTitleStyle = {
    fontFamily: visualStyles.typography.secondaryFont,
    fontSize: `${visualStyles.headings.h3Size}px`,
    lineHeight: 1.1,
  };
  const paragraphStyle = {
    fontSize: `${visualStyles.paragraphs.size}px`,
    lineHeight: visualStyles.paragraphs.lineHeight,
  };
  const buttonStyle = {
    borderRadius: `${visualStyles.buttons.radius}px`,
    fontSize: `${visualStyles.buttons.textSize}px`,
    fontFamily: visualStyles.typography.secondaryFont,
    fontWeight: visualStyles.buttons.fontWeight,
  };
  const searchInputStyle = {
    fontSize: `${visualStyles.search.textSize}px`,
    lineHeight: 1.4,
  };
  const searchStyle = {
    borderRadius: `${visualStyles.search.radius}px`,
    minHeight: `${visualStyles.search.height}px`,
    maxWidth: `${visualStyles.search.maxWidth}px`,
    background: `linear-gradient(90deg, ${settings.theme.searchStart}, ${settings.theme.searchCenter}, ${settings.theme.searchEnd})`,
  };

  return (
    <div
      className="sticky top-6 overflow-hidden rounded-[2rem] border border-slate-800 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
      style={bodyStyle}
    >
      <header
        className="sticky top-0 z-10 border-b border-slate-800/80 backdrop-blur-xl"
        style={{
          backgroundColor: hexToRgba(settings.theme.headerSurface, visualStyles.header.surfaceOpacity / 100),
        }}
      >
        <div
          className="grid w-full gap-3 px-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center"
          style={{
            paddingTop: `${Math.max(8, visualStyles.header.paddingY - 4)}px`,
            paddingBottom: `${Math.max(8, visualStyles.header.paddingY - 4)}px`,
          }}
        >
          <div className="flex min-w-0 items-center justify-start gap-4">
            <div className="text-left">
              <p
                className="font-semibold text-white"
                style={{
                  ...secondaryFontStyle,
                  fontSize: `${visualStyles.header.titleSize}px`,
                }}
              >
                {(settings.brandName || "ZorvyA").trim()} Shop
              </p>
            </div>
          </div>

          <div className="w-full justify-self-stretch">
            {settings.headerSearchEnabled ? (
              <div className="relative mx-auto w-full" style={{ maxWidth: `${visualStyles.search.maxWidth}px` }}>
                <div className="header-search-shell" style={searchStyle}>
                  <svg
                    className="header-search-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    style={{
                      width: `${Math.max(12, visualStyles.search.iconSize - 4)}px`,
                      height: `${Math.max(12, visualStyles.search.iconSize - 4)}px`,
                    }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    readOnly
                    value=""
                    placeholder={localizedContent.searchPlaceholder}
                    className="header-search-input"
                    style={searchInputStyle}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <PreviewHeaderActions buttonStyle={buttonStyle} cartCount={Math.max(1, Math.min(9, activeProducts.length || 1))} />
        </div>

        <div className="w-full px-4 pb-3">
          <div
            className="header-promo-marquee"
            style={{
              background: `linear-gradient(90deg, ${settings.theme.marqueeStart}, ${settings.theme.marqueeCenter}, ${settings.theme.marqueeEnd})`,
            }}
          >
            <div className="header-promo-marquee__track">
              {Array.from({ length: 3 }).map((_, repeatIndex) => (
                <div key={`preview-promo-${repeatIndex}`} className="header-promo-marquee__group">
                  {promoMessages.map((message, messageIndex) => (
                    <span key={`preview-message-${repeatIndex}-${messageIndex}`} className="header-promo-marquee__text">
                      {message}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-10 px-4 pb-6 pt-3">
        <div className="space-y-10">
          {orderedBlocks.map((block) => {
            if (block.type === "hero") {
              return (
                <section
                  key={block.id}
                  className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]"
                >
                  <div
                    className="rounded-[2.5rem] border border-slate-800 p-7 shadow-[0_24px_90px_rgba(0,0,0,0.38)]"
                    style={{
                      background: `radial-gradient(circle at top, ${hexToRgba(settings.theme.primary, 0.14)}, transparent 42%), linear-gradient(180deg, ${settings.theme.panel} 0%, ${settings.theme.backgroundEnd} 100%)`,
                    }}
                  >
                    <p
                      className="text-[11px] font-semibold uppercase tracking-[0.3em]"
                      style={{ ...secondaryFontStyle, color: settings.theme.primary }}
                    >
                      {localizedContent.heroEyebrow}
                    </p>
                    <p className="mt-3 max-w-3xl font-semibold text-white" style={heroTitleStyle}>
                      {localizedContent.heroTitle}
                    </p>
                    <p className="mt-4 max-w-3xl text-slate-300" style={paragraphStyle}>
                      {localizedContent.heroDescription}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                      <span className="rounded-full border border-slate-700 px-4 py-2" style={{ ...buttonStyle, backgroundColor: settings.theme.panelAlt }}>
                        {activeProducts.length} productos activos
                      </span>
                      <span className="rounded-full border border-slate-700 px-4 py-2" style={{ ...buttonStyle, backgroundColor: settings.theme.panelAlt }}>
                        {featuredProducts.length} destacados
                      </span>
                      <span className="rounded-full border border-slate-700 px-4 py-2" style={{ ...buttonStyle, backgroundColor: settings.theme.panelAlt }}>
                        {topProducts.length} top
                      </span>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <span
                        className="rounded-full px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950"
                        style={{ ...buttonStyle, backgroundColor: settings.theme.primary }}
                      >
                        {localizedContent.heroPrimaryButtonLabel}
                      </span>
                      <span
                        className="rounded-full border border-slate-700 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200"
                        style={{
                          ...buttonStyle,
                          backgroundColor: settings.theme.panelAlt,
                          borderColor: `${settings.theme.secondary}55`,
                        }}
                      >
                        {localizedContent.heroSecondaryButtonLabel}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[2rem] border border-slate-800" style={{ backgroundColor: settings.theme.panelAlt }}>
                    {settings.heroImageUrl ? (
                      <img
                        src={settings.heroImageUrl}
                        alt={localizedContent.heroTitle}
                        className="h-full min-h-[13rem] w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full min-h-[13rem] items-center justify-center px-6 text-center text-sm text-slate-500">
                        Hero principal
                      </div>
                    )}
                  </div>
                </section>
              );
            }

            if (block.type === "catalog") {
              const blockProducts = resolveHomepageBlockProducts(block, activeProducts);

              return (
                <section
                  key={block.id}
                  className="space-y-5"
                >
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${getBlockTone(block)}`} style={secondaryFontStyle}>
                    {block.subtitle || block.title}
                  </p>
                  <p className="mt-2 font-semibold text-white" style={sectionTitleStyle}>
                    {block.title}
                  </p>
                  {block.description ? (
                    <p className="mt-3 max-w-3xl text-slate-400" style={paragraphStyle}>
                      {block.description}
                    </p>
                  ) : null}
                  <div className="grid gap-5 sm:grid-cols-2">
                    {blockProducts.length > 0 ? (
                      blockProducts.slice(0, 4).map((product) => (
                        <PreviewCatalogCard
                          key={product.id}
                          product={product}
                          buttonStyle={buttonStyle}
                          cardTitleStyle={cardTitleStyle}
                          paragraphStyle={paragraphStyle}
                        />
                      ))
                    ) : (
                      <div
                        className="rounded-[2rem] border border-dashed border-slate-700 px-5 py-10 text-center text-slate-500 sm:col-span-2"
                        style={{ ...paragraphStyle, backgroundColor: settings.theme.panelAlt }}
                      >
                        Sin productos visibles para este bloque.
                      </div>
                    )}
                  </div>
                </section>
              );
            }

            return (
              <section
                key={block.id}
                className="overflow-hidden rounded-[2rem] border border-slate-800"
                style={{ backgroundColor: settings.theme.panelAlt }}
              >
                {block.imageUrl ? (
                  <img
                    src={block.imageUrl}
                    alt={block.title}
                    className={block.type === "announcement" ? "h-48 w-full object-cover" : "h-36 w-full object-cover"}
                  />
                ) : null}
                <div className="p-5">
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.26em] ${getBlockTone(block)}`} style={secondaryFontStyle}>
                    {block.subtitle || block.type}
                  </p>
                  <p className="mt-3 font-semibold text-white" style={block.type === "announcement" ? sectionTitleStyle : cardTitleStyle}>
                    {block.title}
                  </p>
                  <p className="mt-3 text-slate-300" style={paragraphStyle}>
                    {block.description}
                  </p>
                  {block.buttonLabel ? (
                    <span
                      className="mt-4 inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950"
                      style={{
                        ...buttonStyle,
                        backgroundColor:
                          block.type === "announcement" ? settings.theme.accent : settings.theme.secondary,
                      }}
                    >
                      {block.buttonLabel}
                    </span>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PanelButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[1.25rem] border px-4 py-4 text-left transition ${
        active
          ? "border-cyan-500/40 bg-cyan-500/10"
          : "border-slate-800 bg-[#050816] hover:border-slate-700 hover:bg-[#0a1020]"
      }`}
    >
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
    </button>
  );
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<HomepageSettings>(createEmptySettings);
  const [paypalSettings, setPayPalSettings] = useState<PayPalSettings>(createEmptyPayPalSettings);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paypalSaving, setPayPalSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [paypalNotice, setPayPalNotice] = useState("");
  const [paypalConfigured, setPayPalConfigured] = useState(false);
  const [paypalSource, setPayPalSource] = useState<"admin" | "env">("env");
  const [activeLocale, setActiveLocale] = useState<Locale>("es");
  const [activePanel, setActivePanel] = useState<"branding" | "hero" | "builder" | "styles" | "paypal">("branding");
  const [expandedBlockId, setExpandedBlockId] = useState<string>("hero-main");

  useEffect(() => {
    let isActive = true;

    async function loadSettings() {
      try {
        const [settingsResponse, productsResponse, paypalResponse] = await Promise.all([
          fetch("/api/admin/settings/homepage", { cache: "no-store" }),
          fetch("/api/admin/products", { cache: "no-store" }),
          fetch("/api/admin/settings/paypal", { cache: "no-store" }),
        ]);
        const [settingsData, productsData, paypalData] = (await Promise.all([
          settingsResponse.json(),
          productsResponse.json(),
          paypalResponse.json(),
        ])) as [SettingsResponse, ProductsResponse, PayPalSettingsResponse];

        if (isActive && settingsData.success && settingsData.settings) {
          setSettings(normalizeClientSettings(settingsData.settings));
        }

        if (isActive && productsData.success) {
          setProducts(productsData.products ?? []);
        }

        if (isActive && paypalData.success && paypalData.settings) {
          setPayPalSettings(normalizeClientPayPalSettings(paypalData.settings));
          setPayPalConfigured(Boolean(paypalData.configured));
          setPayPalSource(paypalData.source === "admin" ? "admin" : "env");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      isActive = false;
    };
  }, []);

  const activeProducts = useMemo(
    () => products.filter((product) => product.isActive && product.isVisible),
    [products]
  );

  function updateLocalizedField(
    locale: Locale,
    field: keyof HomepageSettings["localizedContent"][Locale],
    value: string
  ) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      localizedContent: {
        ...currentSettings.localizedContent,
        [locale]: {
          ...currentSettings.localizedContent[locale],
          [field]: value,
        },
      },
    }));
  }

  function updateVisualStyle<
    Group extends keyof HomepageSettings["styles"],
    Field extends keyof HomepageSettings["styles"][Group],
  >(group: Group, field: Field, value: HomepageSettings["styles"][Group][Field]) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      styles: {
        ...currentSettings.styles,
        [group]: {
          ...currentSettings.styles[group],
          [field]: value,
        },
      },
    }));
  }

  function updateBlock(blockId: string, patch: Partial<HomepageBlock>) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      blocks: currentSettings.blocks.map((block) =>
        block.id === blockId ? { ...block, ...patch } : block
      ),
    }));
  }

  function toggleProductOnBlock(blockId: string, productId: string) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      blocks: currentSettings.blocks.map((block) => {
        if (block.id !== blockId) {
          return block;
        }

        const selected = block.productIds.includes(productId);

        return {
          ...block,
          productIds: selected
            ? block.productIds.filter((item) => item !== productId)
            : [...block.productIds, productId],
        };
      }),
    }));
  }

  function addBlock(type: "catalog" | "banner" | "announcement" | "info") {
    setSettings((currentSettings) => {
      const ordered = sortOrderedItems(currentSettings.blocks);
      const nextOrder = ordered.length + 1;
      const nextBlock =
        type === "catalog"
          ? createCatalogBlock(nextOrder)
          : type === "banner"
            ? createBannerBlock(nextOrder)
            : type === "announcement"
              ? createAnnouncementBlock(nextOrder)
              : createInfoBlock(nextOrder);

      return {
        ...currentSettings,
        blocks: renumberOrderedItems([...ordered, nextBlock]),
      };
    });
  }

  function removeBlock(blockId: string) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      blocks: renumberOrderedItems(
        currentSettings.blocks.filter((block) => block.id !== blockId)
      ),
    }));
  }

  async function uploadAsset(
    file: File,
    applyValue: (dataUrl: string) => void | Promise<void>
  ) {
    const dataUrl = await imageFileToDataUrl(file);
    await applyValue(dataUrl);
  }

  async function handleSave() {
    setSaving(true);
    setNotice("");

    try {
      const response = await fetch("/api/admin/settings/homepage", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });
      const data = (await response.json()) as SettingsResponse;

      if (!response.ok || !data.success || !data.settings) {
        setNotice("No se pudieron guardar los ajustes.");
        return;
      }

      setSettings(normalizeClientSettings(data.settings));
      setNotice("Ajustes guardados correctamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePayPalSave() {
    setPayPalSaving(true);
    setPayPalNotice("");

    try {
      const response = await fetch("/api/admin/settings/paypal", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paypalSettings),
      });
      const data = (await response.json()) as PayPalSettingsResponse;

      if (!response.ok || !data.success || !data.settings) {
        setPayPalNotice("No se pudo guardar la configuracion de PayPal.");
        return;
      }

      setPayPalSettings(normalizeClientPayPalSettings(data.settings));
      setPayPalConfigured(Boolean(data.configured));
      setPayPalSource(data.source === "env" ? "env" : "admin");
      setPayPalNotice("Configuracion de PayPal guardada correctamente.");
    } finally {
      setPayPalSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-400"></div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Cargando ajustes</p>
        </div>
      </div>
    );
  }

  const safeSettings = normalizeClientSettings(settings);
  const orderedBlocks = sortOrderedItems(safeSettings.blocks);
  const localizedContent =
    safeSettings.localizedContent[activeLocale] ?? safeSettings.localizedContent.es;
  const visualStyles = safeSettings.styles;
  const safePayPalSettings = normalizeClientPayPalSettings(paypalSettings);
  const activeNotice = activePanel === "paypal" ? paypalNotice : notice;
  const activeBlocksCount = orderedBlocks.filter((block) => block.isEnabled).length;
  const activeCatalogBlocksCount = orderedBlocks.filter(
    (block) => block.type === "catalog" && block.isEnabled
  ).length;
  const activeBannerBlocksCount = orderedBlocks.filter(
    (block) => (block.type === "banner" || block.type === "announcement") && block.isEnabled
  ).length;

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.22),_transparent_36%),linear-gradient(180deg,_#050816_0%,_#03050f_100%)] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.42)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Ajustes</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              {activePanel === "paypal" ? "Configuracion de PayPal" : "Constructor visual del homepage"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              {activePanel === "paypal"
                ? "Configura la cuenta principal que recibira los pagos virtuales, el modo sandbox o live y las credenciales de cobro."
                : "Edita marca, header, hero, banners, catalogos y bloques especiales con preview vivo del frente."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-[1.25rem] border border-slate-800 bg-[#0a1020] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Bloques activos</p>
              <p className="mt-1 text-2xl font-semibold text-white">{activeBlocksCount}</p>
            </div>
            <div className="rounded-[1.25rem] border border-slate-800 bg-[#0a1020] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Catalogos</p>
              <p className="mt-1 text-2xl font-semibold text-cyan-300">{activeCatalogBlocksCount}</p>
            </div>
            <div className="rounded-[1.25rem] border border-slate-800 bg-[#0a1020] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Banners</p>
              <p className="mt-1 text-2xl font-semibold text-rose-300">{activeBannerBlocksCount}</p>
            </div>
            <button
              type="button"
              onClick={() =>
                void (activePanel === "paypal" ? handlePayPalSave() : handleSave())
              }
              disabled={activePanel === "paypal" ? paypalSaving : saving}
              className="rounded-[1.25rem] bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {activePanel === "paypal"
                ? paypalSaving
                  ? "Guardando PayPal..."
                  : "Guardar PayPal"
                : saving
                  ? "Guardando..."
                  : "Guardar ajustes"}
            </button>
          </div>
        </div>
      </section>

      {activeNotice ? (
        <div className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100">
          {activeNotice}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_minmax(360px,0.95fr)]">
        <aside className="space-y-3">
          <PanelButton
            active={activePanel === "branding"}
            title="Branding"
            description="Logo, nombre, eslogan, header y buscador"
            onClick={() => setActivePanel("branding")}
          />
          <PanelButton
            active={activePanel === "hero"}
            title="Hero"
            description="Textos, CTA e imagen del bloque superior"
            onClick={() => setActivePanel("hero")}
          />
          <PanelButton
            active={activePanel === "builder"}
            title="Bloques"
            description="Catalogos, banners, anuncios y orden visual"
            onClick={() => setActivePanel("builder")}
          />
          <PanelButton
            active={activePanel === "styles"}
            title="Estilos"
            description="Fuentes, colores y apariencia global"
            onClick={() => setActivePanel("styles")}
          />
          <PanelButton
            active={activePanel === "paypal"}
            title="PayPal"
            description="Cuenta principal, credenciales y modo de cobro"
            onClick={() => setActivePanel("paypal")}
          />
        </aside>

        <div className="space-y-5">
          {activePanel === "paypal" ? (
            <div className="rounded-[1.75rem] border border-slate-800 bg-[#050816] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Cuenta y cobro virtual</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Desde aqui defines la cuenta PayPal principal que recibira los pagos online de la tienda.
                  </p>
                </div>
                <div
                  className={`rounded-full px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    paypalConfigured
                      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : "border border-amber-500/30 bg-amber-500/10 text-amber-200"
                  }`}
                >
                  {paypalConfigured ? "PayPal activo" : "PayPal pendiente"}
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <SettingsToggle
                    checked={safePayPalSettings.enabled}
                    label="Aceptar pagos con PayPal"
                    description="Si lo apagas, la tienda deja de ofrecer cobro virtual aunque existan credenciales guardadas."
                    enabledLabel="Activo"
                    disabledLabel="Pausado"
                    onChange={(nextValue) =>
                      setPayPalSettings((current) => ({
                        ...current,
                        enabled: nextValue,
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300">Nombre interno de la cuenta</label>
                  <input
                    type="text"
                    value={safePayPalSettings.accountDisplayName}
                    onChange={(event) =>
                      setPayPalSettings((current) => ({
                        ...current,
                        accountDisplayName: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                    placeholder="Cuenta principal PayPal"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300">Correo de la cuenta PayPal</label>
                  <input
                    type="email"
                    value={safePayPalSettings.accountEmail}
                    onChange={(event) =>
                      setPayPalSettings((current) => ({
                        ...current,
                        accountEmail: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                    placeholder="payments@tuempresa.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300">Modo de PayPal</label>
                  <select
                    value={safePayPalSettings.environment}
                    onChange={(event) =>
                      setPayPalSettings((current) => ({
                        ...current,
                        environment: event.target.value === "live" ? "live" : "sandbox",
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                  >
                    <option value="sandbox">Sandbox / pruebas</option>
                    <option value="live">Live / produccion</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300">API base custom</label>
                  <input
                    type="text"
                    value={safePayPalSettings.apiBaseUrl}
                    onChange={(event) =>
                      setPayPalSettings((current) => ({
                        ...current,
                        apiBaseUrl: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                    placeholder="Opcional. Si lo dejas vacio usa el endpoint oficial segun el modo."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-300">Client ID</label>
                  <textarea
                    value={safePayPalSettings.clientId}
                    onChange={(event) =>
                      setPayPalSettings((current) => ({
                        ...current,
                        clientId: event.target.value,
                      }))
                    }
                    rows={3}
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                    placeholder="Pega aqui el Client ID de la app PayPal"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-300">Client Secret</label>
                  <textarea
                    value={safePayPalSettings.clientSecret}
                    onChange={(event) =>
                      setPayPalSettings((current) => ({
                        ...current,
                        clientSecret: event.target.value,
                      }))
                    }
                    rows={4}
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                    placeholder="Pega aqui el Client Secret de la app PayPal"
                  />
                </div>
              </div>

              <div className="mt-6 rounded-[1.5rem] border border-slate-800 bg-[#0a1020] px-4 py-4 text-sm text-slate-400">
                <p className="font-semibold text-white">Lo que usa la tienda al cobrar</p>
                <p className="mt-2 leading-6">
                  La web enviara los pagos virtuales a la cuenta ligada a estas credenciales. El correo es referencia visual para el admin; el destino real del dinero lo define el Client ID y el Client Secret que guardes aqui.
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-cyan-300">
                  Origen actual: {paypalSource === "admin" ? "panel administrador" : "variables del servidor"}
                </p>
              </div>
            </div>
          ) : null}

          {(activePanel === "branding" || activePanel === "styles") ? (
            <div className="rounded-[1.75rem] border border-slate-800 bg-[#050816] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Branding y estilos globales</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Controla marca, header, buscador, tipografia y apariencia general de la homepage.
                  </p>
                </div>
                <div className="rounded-full border border-slate-800 bg-[#0a1020] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
                  Visual real
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-300">Logo</label>
                  <div className="mt-2 flex flex-wrap items-center gap-4 rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-4">
                    {safeSettings.logoImageUrl ? (
                      <img
                        src={safeSettings.logoImageUrl}
                        alt={safeSettings.brandName}
                        className="rounded-2xl object-cover"
                        style={{
                          width: `${safeSettings.logoSize}px`,
                          height: `${safeSettings.logoSize}px`,
                        }}
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center rounded-2xl font-black text-slate-950"
                        style={{
                          width: `${safeSettings.logoSize}px`,
                          height: `${safeSettings.logoSize}px`,
                          background: `linear-gradient(135deg, ${safeSettings.theme.primary}, ${safeSettings.theme.secondary}, ${safeSettings.theme.accent})`,
                        }}
                      >
                        {safeSettings.logoText || "Z"}
                      </div>
                    )}
                    <label className="inline-flex cursor-pointer items-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400">
                      Subir logo
                      <input
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES}
                        className="hidden"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];

                          if (!file) {
                            return;
                          }

                          await uploadAsset(file, (dataUrl) =>
                            setSettings((currentSettings) => ({
                              ...currentSettings,
                              logoImageUrl: dataUrl,
                            }))
                          );
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings((currentSettings) => ({
                          ...currentSettings,
                          logoImageUrl: "",
                        }))
                      }
                      className="rounded-2xl border border-slate-700 bg-[#050816] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-rose-500"
                    >
                      Quitar imagen
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300">Nombre de marca</label>
                  <input
                    type="text"
                    value={safeSettings.brandName}
                    onChange={(event) =>
                      setSettings((currentSettings) => ({
                        ...currentSettings,
                        brandName: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Eslogan</label>
                  <input
                    type="text"
                    value={safeSettings.brandTagline}
                    onChange={(event) =>
                      setSettings((currentSettings) => ({
                        ...currentSettings,
                        brandTagline: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Texto del logo</label>
                  <input
                    type="text"
                    value={safeSettings.logoText}
                    onChange={(event) =>
                      setSettings((currentSettings) => ({
                        ...currentSettings,
                        logoText: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Tamano del logo</label>
                  <input
                    type="range"
                    min="32"
                    max="72"
                    step="2"
                    value={safeSettings.logoSize}
                    onChange={(event) =>
                      setSettings((currentSettings) => ({
                        ...currentSettings,
                        logoSize: Number(event.target.value),
                      }))
                    }
                    className="mt-4 w-full accent-cyan-400"
                  />
                  <p className="mt-2 text-xs text-slate-500">{safeSettings.logoSize}px</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {themeColorOptions.map(({ key: themeKey, label }) => (
                  <div key={themeKey}>
                    <label className="block text-sm font-medium text-slate-300">{label}</label>
                    <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-800 bg-[#0a1020] px-3 py-3">
                      <input
                        type="color"
                        value={safeSettings.theme[themeKey]}
                        onChange={(event) =>
                          setSettings((currentSettings) => ({
                            ...currentSettings,
                            theme: {
                              ...currentSettings.theme,
                              [themeKey]: event.target.value,
                            },
                          }))
                        }
                        className="h-10 w-12 rounded-lg border-0 bg-transparent"
                      />
                      <input
                        type="text"
                        value={safeSettings.theme[themeKey]}
                        onChange={(event) =>
                          setSettings((currentSettings) => ({
                            ...currentSettings,
                            theme: {
                              ...currentSettings.theme,
                              [themeKey]: event.target.value,
                            },
                          }))
                        }
                        className="w-full bg-transparent text-sm text-white outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {activePanel === "styles" ? (
                <>
                  <div className="mt-6 rounded-[1.75rem] border border-slate-800 bg-[#0a1020] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Tipografia global</p>
                        <p className="mt-2 text-sm text-slate-400">
                          Fuentes, tamanos y pesos de toda la homepage del cliente.
                        </p>
                      </div>
                      <div className="rounded-full border border-slate-700 bg-[#050816] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                        {HOMEPAGE_FONT_OPTIONS.length}+ fuentes
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-300">Fuente principal</label>
                        <select
                          value={visualStyles.typography.primaryFont}
                          onChange={(event) =>
                            updateVisualStyle("typography", "primaryFont", event.target.value)
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                        >
                          {HOMEPAGE_FONT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300">Fuente secundaria</label>
                        <select
                          value={visualStyles.typography.secondaryFont}
                          onChange={(event) =>
                            updateVisualStyle("typography", "secondaryFont", event.target.value)
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                        >
                          {HOMEPAGE_FONT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <label className="block text-sm font-medium text-slate-300">Tamano base</label>
                          <span className="text-xs text-slate-500">{visualStyles.typography.baseFontSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="13"
                          max="18"
                          step="1"
                          value={visualStyles.typography.baseFontSize}
                          onChange={(event) =>
                            updateVisualStyle("typography", "baseFontSize", Number(event.target.value))
                          }
                          className="mt-4 w-full accent-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300">Peso base</label>
                        <select
                          value={String(visualStyles.typography.baseFontWeight)}
                          onChange={(event) =>
                            updateVisualStyle("typography", "baseFontWeight", Number(event.target.value))
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                        >
                          {fontWeightOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                    <div className="mt-6 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-4">
                      <p className="text-sm font-semibold text-white">Titulos y parrafos</p>
                      <div className="mt-4 space-y-4">
                        {([
                          ["h1Size", "H1", visualStyles.headings.h1Size, 30, 56],
                          ["h2Size", "H2", visualStyles.headings.h2Size, 24, 40],
                          ["h3Size", "H3", visualStyles.headings.h3Size, 18, 30],
                        ] as const).map(([field, label, value, min, max]) => (
                          <div key={field}>
                            <div className="flex items-center justify-between gap-3">
                              <label className="text-sm text-slate-300">{label}</label>
                              <span className="text-xs text-slate-500">{value}px</span>
                            </div>
                            <input
                              type="range"
                              min={String(min)}
                              max={String(max)}
                              step="1"
                              value={value}
                              onChange={(event) =>
                                updateVisualStyle("headings", field, Number(event.target.value))
                              }
                              className="mt-3 w-full accent-cyan-400"
                            />
                          </div>
                        ))}
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-sm text-slate-300">Tamano del parrafo</label>
                            <span className="text-xs text-slate-500">{visualStyles.paragraphs.size}px</span>
                          </div>
                          <input
                            type="range"
                            min="13"
                            max="20"
                            step="1"
                            value={visualStyles.paragraphs.size}
                            onChange={(event) =>
                              updateVisualStyle("paragraphs", "size", Number(event.target.value))
                            }
                            className="mt-3 w-full accent-cyan-400"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-4">
                      <p className="text-sm font-semibold text-white">Botones, buscador y header</p>
                      <div className="mt-4 space-y-4">
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-sm text-slate-300">Radio de botones</label>
                            <span className="text-xs text-slate-500">{visualStyles.buttons.radius}px</span>
                          </div>
                          <input
                            type="range"
                            min="14"
                            max="999"
                            step="1"
                            value={visualStyles.buttons.radius}
                            onChange={(event) =>
                              updateVisualStyle("buttons", "radius", Number(event.target.value))
                            }
                            className="mt-3 w-full accent-cyan-400"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-sm text-slate-300">Largo del buscador</label>
                            <span className="text-xs text-slate-500">{visualStyles.search.maxWidth}px</span>
                          </div>
                          <input
                            type="range"
                            min="360"
                            max="1800"
                            step="10"
                            value={visualStyles.search.maxWidth}
                            onChange={(event) =>
                              updateVisualStyle("search", "maxWidth", Number(event.target.value))
                            }
                            className="mt-3 w-full accent-cyan-400"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-sm text-slate-300">Alto del buscador</label>
                            <span className="text-xs text-slate-500">{visualStyles.search.height}px</span>
                          </div>
                          <input
                            type="range"
                            min="32"
                            max="64"
                            step="1"
                            value={visualStyles.search.height}
                            onChange={(event) =>
                              updateVisualStyle("search", "height", Number(event.target.value))
                            }
                            className="mt-3 w-full accent-cyan-400"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-sm text-slate-300">Texto del buscador</label>
                            <span className="text-xs text-slate-500">{visualStyles.search.textSize}px</span>
                          </div>
                          <input
                            type="range"
                            min="12"
                            max="18"
                            step="1"
                            value={visualStyles.search.textSize}
                            onChange={(event) =>
                              updateVisualStyle("search", "textSize", Number(event.target.value))
                            }
                            className="mt-3 w-full accent-cyan-400"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-sm text-slate-300">Radio del buscador</label>
                            <span className="text-xs text-slate-500">{visualStyles.search.radius}px</span>
                          </div>
                          <input
                            type="range"
                            min="14"
                            max="999"
                            step="1"
                            value={visualStyles.search.radius}
                            onChange={(event) =>
                              updateVisualStyle("search", "radius", Number(event.target.value))
                            }
                            className="mt-3 w-full accent-cyan-400"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-sm text-slate-300">Tamano del icono</label>
                            <span className="text-xs text-slate-500">{visualStyles.search.iconSize}px</span>
                          </div>
                          <input
                            type="range"
                            min="12"
                            max="24"
                            step="1"
                            value={visualStyles.search.iconSize}
                            onChange={(event) =>
                              updateVisualStyle("search", "iconSize", Number(event.target.value))
                            }
                            className="mt-3 w-full accent-cyan-400"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-sm text-slate-300">Padding del header</label>
                            <span className="text-xs text-slate-500">{visualStyles.header.paddingY}px</span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="28"
                            step="1"
                            value={visualStyles.header.paddingY}
                            onChange={(event) =>
                              updateVisualStyle("header", "paddingY", Number(event.target.value))
                            }
                            className="mt-3 w-full accent-cyan-400"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              <div className="mt-6 rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Header fijo</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Idioma, cuenta, carrito y soporte permanecen visibles siempre.
                    </p>
                  </div>
                  <PreviewHeaderActions
                    cartCount={Math.max(1, Math.min(9, activeProducts.length || 1))}
                    buttonStyle={{
                      borderRadius: `${visualStyles.buttons.radius}px`,
                      fontSize: `${visualStyles.buttons.textSize}px`,
                      fontFamily: visualStyles.typography.secondaryFont,
                      fontWeight: visualStyles.buttons.fontWeight,
                    }}
                  />
                </div>

                <div className="mt-4">
                  <SettingsToggle
                    checked={safeSettings.headerSearchEnabled}
                    label="Buscador visible en el header"
                    description="Oculta o muestra la barra de busqueda del frente."
                    onChange={(nextValue) =>
                      setSettings((currentSettings) => ({
                        ...currentSettings,
                        headerSearchEnabled: nextValue,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          ) : null}

          {activePanel === "hero" ? (
            <div className="rounded-[1.75rem] border border-slate-800 bg-[#050816] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Hero principal</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Edita el bloque principal por idioma y ve el cambio al instante.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {locales.map((locale) => (
                    <button
                      key={locale}
                      type="button"
                      onClick={() => setActiveLocale(locale)}
                      className={`rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] transition ${
                        activeLocale === locale
                          ? "bg-cyan-500 text-slate-950"
                          : "border border-slate-700 bg-[#050816] text-slate-300 hover:border-cyan-500"
                      }`}
                    >
                      {locale}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-4">
                  <p className="text-sm font-semibold text-white">Textos del hero</p>
                  <div className="mt-4 space-y-3">
                    <textarea
                      value={localizedContent.promoBarText}
                      onChange={(event) => updateLocalizedField(activeLocale, "promoBarText", event.target.value)}
                      rows={4}
                      className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                      placeholder={"Mensajes de la franja superior\nUna linea o | por mensaje"}
                    />
                    <input
                      type="text"
                      value={localizedContent.searchPlaceholder}
                      onChange={(event) => updateLocalizedField(activeLocale, "searchPlaceholder", event.target.value)}
                      className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                      placeholder="Texto del buscador"
                    />
                    <input
                      type="text"
                      value={localizedContent.heroEyebrow}
                      onChange={(event) => updateLocalizedField(activeLocale, "heroEyebrow", event.target.value)}
                      className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                      placeholder="Subtitulo del hero"
                    />
                    <input
                      type="text"
                      value={localizedContent.heroTitle}
                      onChange={(event) => updateLocalizedField(activeLocale, "heroTitle", event.target.value)}
                      className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                      placeholder="Titulo principal"
                    />
                    <textarea
                      value={localizedContent.heroDescription}
                      onChange={(event) => updateLocalizedField(activeLocale, "heroDescription", event.target.value)}
                      rows={5}
                      className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                      placeholder="Descripcion principal"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-4">
                    <p className="text-sm font-semibold text-white">Botones y links</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <input
                        type="text"
                        value={localizedContent.heroPrimaryButtonLabel}
                        onChange={(event) =>
                          updateLocalizedField(activeLocale, "heroPrimaryButtonLabel", event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                        placeholder="Boton principal"
                      />
                      <input
                        type="text"
                        value={localizedContent.heroSecondaryButtonLabel}
                        onChange={(event) =>
                          updateLocalizedField(activeLocale, "heroSecondaryButtonLabel", event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                        placeholder="Boton secundario"
                      />
                      <input
                        type="text"
                        value={safeSettings.heroPrimaryButtonHref}
                        onChange={(event) =>
                          setSettings((currentSettings) => ({
                            ...currentSettings,
                            heroPrimaryButtonHref: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                        placeholder="Link boton principal"
                      />
                      <input
                        type="text"
                        value={safeSettings.heroSecondaryButtonHref}
                        onChange={(event) =>
                          setSettings((currentSettings) => ({
                            ...currentSettings,
                            heroSecondaryButtonHref: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                        placeholder="Link boton secundario"
                      />
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">Imagen principal del hero</p>
                        <p className="mt-1 text-xs text-slate-500">Se actualiza en el preview y en el frente.</p>
                      </div>
                      <label className="inline-flex cursor-pointer items-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400">
                        Subir imagen
                        <input
                          type="file"
                          accept={ACCEPTED_IMAGE_TYPES}
                          className="hidden"
                          onChange={async (event) => {
                            const file = event.target.files?.[0];

                            if (!file) {
                              return;
                            }

                            await uploadAsset(file, (dataUrl) =>
                              setSettings((currentSettings) => ({
                                ...currentSettings,
                                heroImageUrl: dataUrl,
                              }))
                            );
                            event.target.value = "";
                          }}
                        />
                      </label>
                    </div>

                    {safeSettings.heroImageUrl ? (
                      <img
                        src={safeSettings.heroImageUrl}
                        alt={localizedContent.heroTitle}
                        className="mt-4 h-52 w-full rounded-[1.25rem] object-cover"
                      />
                    ) : (
                      <div className="mt-4 flex h-52 items-center justify-center rounded-[1.25rem] border border-dashed border-slate-700 bg-[#050816] text-sm text-slate-500">
                        Sin imagen principal
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activePanel === "builder" ? (
            <div className="rounded-[1.75rem] border border-slate-800 bg-[#050816] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Bloques del homepage</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Activa, oculta, reordena, edita y crea bloques visibles para la tienda del cliente.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => addBlock("catalog")}
                    className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400"
                  >
                    Agregar catalogo
                  </button>
                  <button
                    type="button"
                    onClick={() => addBlock("banner")}
                    className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:border-rose-400"
                  >
                    Agregar banner
                  </button>
                  <button
                    type="button"
                    onClick={() => addBlock("announcement")}
                    className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-400"
                  >
                    Agregar anuncio
                  </button>
                  <button
                    type="button"
                    onClick={() => addBlock("info")}
                    className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400"
                  >
                    Agregar info
                  </button>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {orderedBlocks.map((block, index) => {
                  const blockProducts = resolveHomepageBlockProducts(block, activeProducts);
                  const selectedProducts = block.productIds
                    .map((productId) => activeProducts.find((product) => product.id === productId))
                    .filter((product): product is Product => Boolean(product));

                  return (
                    <div
                      key={block.id}
                      className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedBlockId((current) => (current === block.id ? "" : block.id))
                          }
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${getBlockTone(block)}`}>
                            {String(index + 1).padStart(2, "0")} • {getBlockTypeLabel(block)}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-white">
                            {block.type === "hero" ? "Hero principal" : block.title}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {block.description || "Sin descripcion"}
                          </p>
                        </button>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setSettings((currentSettings) => ({
                                ...currentSettings,
                                blocks: moveOrderedItem(sortOrderedItems(currentSettings.blocks), index, -1),
                              }))
                            }
                            className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-cyan-500"
                          >
                            Subir
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setSettings((currentSettings) => ({
                                ...currentSettings,
                                blocks: moveOrderedItem(sortOrderedItems(currentSettings.blocks), index, 1),
                              }))
                            }
                            className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-cyan-500"
                          >
                            Bajar
                          </button>
                          {block.isRemovable ? (
                            <button
                              type="button"
                              onClick={() => removeBlock(block.id)}
                              className="rounded-full border border-rose-500/30 px-3 py-1.5 text-xs text-rose-200 transition hover:border-rose-400"
                            >
                              Eliminar
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4">
                        <SettingsToggle
                          checked={block.isEnabled}
                          label="Visible en la homepage"
                          description="Oculta o publica este bloque sin borrarlo del sistema."
                          onChange={(nextValue) => updateBlock(block.id, { isEnabled: nextValue })}
                        />
                      </div>

                      {expandedBlockId === block.id && block.type !== "hero" ? (
                        <div className="mt-4 grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
                          <div className="space-y-3">
                            {block.imageUrl ? (
                              <img
                                src={block.imageUrl}
                                alt={block.title}
                                className="h-36 w-full rounded-[1.25rem] object-cover"
                              />
                            ) : (
                              <div className="flex h-36 items-center justify-center rounded-[1.25rem] border border-dashed border-slate-700 bg-[#050816] text-sm text-slate-500">
                                Sin imagen
                              </div>
                            )}
                            <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400">
                              Subir imagen
                              <input
                                type="file"
                                accept={ACCEPTED_IMAGE_TYPES}
                                className="hidden"
                                onChange={async (event) => {
                                  const file = event.target.files?.[0];

                                  if (!file) {
                                    return;
                                  }

                                  await uploadAsset(file, (dataUrl) => updateBlock(block.id, { imageUrl: dataUrl }));
                                  event.target.value = "";
                                }}
                              />
                            </label>
                          </div>

                          <div className="space-y-3">
                            <input
                              type="text"
                              value={block.subtitle}
                              onChange={(event) => updateBlock(block.id, { subtitle: event.target.value })}
                              className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                              placeholder="Subtitulo"
                            />
                            <input
                              type="text"
                              value={block.title}
                              onChange={(event) => updateBlock(block.id, { title: event.target.value })}
                              className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                              placeholder="Titulo"
                            />
                            <textarea
                              value={block.description}
                              onChange={(event) => updateBlock(block.id, { description: event.target.value })}
                              rows={3}
                              className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                              placeholder="Descripcion"
                            />

                            {block.type === "catalog" ? (
                              <>
                                <select
                                  value={block.catalogSource ?? "custom"}
                                  onChange={(event) =>
                                    updateBlock(block.id, {
                                      catalogSource: event.target.value as HomepageCatalogSource,
                                    })
                                  }
                                  className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                                >
                                  {catalogSourceOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>

                                <div className="rounded-[1.25rem] border border-slate-800 bg-[#050816] p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    Productos fijados
                                  </p>
                                  <div className="mt-3 max-h-48 overflow-y-auto">
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {activeProducts.map((product) => {
                                        const isSelected = block.productIds.includes(product.id);

                                        return (
                                          <button
                                            key={product.id}
                                            type="button"
                                            onClick={() => toggleProductOnBlock(block.id, product.id)}
                                            className={`rounded-2xl border px-3 py-3 text-left text-xs transition ${
                                              isSelected
                                                ? "border-cyan-500 bg-cyan-500/10 text-cyan-100"
                                                : "border-slate-700 bg-[#0a1020] text-slate-300 hover:border-cyan-500"
                                            }`}
                                          >
                                            <p className="truncate font-semibold">{product.name}</p>
                                            <p className="mt-1 truncate text-[11px] opacity-75">
                                              {product.category}
                                            </p>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  {selectedProducts.length > 0 ? (
                                    <p className="mt-3 text-xs text-cyan-300">
                                      {selectedProducts.length} producto(s) fijado(s) en este bloque.
                                    </p>
                                  ) : null}
                                </div>

                                <div className="rounded-[1.25rem] border border-slate-800 bg-[#050816] p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    Preview del catalogo
                                  </p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {blockProducts.length > 0 ? (
                                      blockProducts.slice(0, 6).map((product) => (
                                        <span
                                          key={product.id}
                                          className="rounded-full border border-slate-700 bg-[#0a1020] px-3 py-1.5 text-[11px] text-slate-300"
                                        >
                                          {product.name}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-xs text-slate-500">Sin productos visibles.</span>
                                    )}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="grid gap-3 md:grid-cols-2">
                                <input
                                  type="text"
                                  value={block.buttonLabel}
                                  onChange={(event) => updateBlock(block.id, { buttonLabel: event.target.value })}
                                  className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                                  placeholder="Texto del boton"
                                />
                                <input
                                  type="text"
                                  value={block.buttonHref}
                                  onChange={(event) => updateBlock(block.id, { buttonHref: event.target.value })}
                                  className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                                  placeholder="Link del boton"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {activePanel === "paypal" ? (
          <PayPalSettingsPreview
            settings={safePayPalSettings}
            configured={paypalConfigured}
            source={paypalSource}
          />
        ) : (
          <HomepageLivePreview settings={safeSettings} products={products} locale={activeLocale} />
        )}
      </section>
    </div>
  );
}
