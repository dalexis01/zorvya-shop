import "server-only";

import { randomUUID } from "node:crypto";

import { unstable_cache } from "next/cache";

import { readDataFile, writeDataFile } from "@/lib/server/storage";
import type {
  HomepageBanner,
  HomepageButtonConfig,
  HomepageSectionConfig,
  HomepageSettings,
  HomepageThemeSettings,
} from "@/lib/shop/admin-types";
import { STORE_BRAND } from "@/lib/shop/config";
import {
  createDefaultHomepageVisualStyles,
  normalizeHomepageVisualStyles,
} from "@/lib/shop/homepage-visuals";
import { createDefaultHomepageBlocks, normalizeHomepageBlocks } from "@/lib/shop/homepage-blocks";

const HOMEPAGE_SETTINGS_FILE = "homepage-settings.json";
export const HOMEPAGE_SETTINGS_TAG = "homepage-settings";

function buildHomepageMediaProxyUrl(kind: "logo" | "hero" | "block" | "section" | "banner", key: string, updatedAt?: string) {
  const params = new URLSearchParams({
    kind,
    key,
  });

  if (updatedAt) {
    params.set("v", updatedAt);
  }

  return `/api/homepage-media?${params.toString()}`;
}

function toStorefrontHomepageMediaUrl(
  rawUrl: string | undefined,
  kind: "logo" | "hero" | "block" | "section" | "banner",
  key: string,
  updatedAt?: string
) {
  const trimmed = trimText(rawUrl);

  if (!trimmed) {
    return "";
  }

  if (!trimmed.startsWith("data:")) {
    return trimmed;
  }

  return buildHomepageMediaProxyUrl(kind, key, updatedAt);
}

function trimText(value: string | undefined) {
  return (value ?? "").trim();
}

function createDefaultTheme(): HomepageThemeSettings {
  return {
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
  };
}

function createDefaultButtons(): HomepageButtonConfig[] {
  return [
    { id: "languages", label: "Idiomas", target: "languages", isEnabled: true, order: 1 },
    { id: "account", label: "Cuenta", target: "account", isEnabled: true, order: 2 },
    { id: "cart", label: "Carrito", target: "cart", isEnabled: true, order: 3 },
    { id: "support", label: "Soporte", target: "support", isEnabled: true, order: 4 },
  ];
}

function createDefaultSections(): HomepageSectionConfig[] {
  return [
    {
      id: "featured",
      label: "Destacados",
      subtitle: "Seleccion principal",
      description: "Productos destacados para abrir la home con fuerza.",
      imageUrl: "",
      isEnabled: true,
      order: 1,
      productIds: [],
    },
    {
      id: "top",
      label: "Top ventas",
      subtitle: "Lo mas buscado",
      description: "Productos con mejor rendimiento comercial dentro de la tienda.",
      imageUrl: "",
      isEnabled: true,
      order: 2,
      productIds: [],
    },
    {
      id: "promotions",
      label: "Promociones",
      subtitle: "Ofertas activas",
      description: "Productos con precio anterior y descuento visible.",
      imageUrl: "",
      isEnabled: true,
      order: 3,
      productIds: [],
    },
    {
      id: "newProducts",
      label: "Nuevos productos",
      subtitle: "Catalogo reciente",
      description: "Ultimas publicaciones listas para mostrarse en la home.",
      imageUrl: "",
      isEnabled: true,
      order: 4,
      productIds: [],
    },
    {
      id: "allProducts",
      label: "Todos los productos",
      subtitle: "Catalogo completo",
      description: "Toda la tienda activa organizada en una sola vista.",
      imageUrl: "",
      isEnabled: true,
      order: 5,
      productIds: [],
    },
    {
      id: "ads",
      label: "Anuncios",
      subtitle: "Feed visual",
      description: "Bloque de anuncios y productos en scroll continuo.",
      imageUrl: "",
      isEnabled: true,
      order: 6,
      productIds: [],
    },
    {
      id: "info",
      label: "Informacion destacada",
      subtitle: "Bloque editorial",
      description: "Espacio para mensajes de confianza, promos o informacion clave.",
      imageUrl: "",
      isEnabled: true,
      order: 7,
      productIds: [],
    },
  ];
}

function createDefaultBanners(): HomepageBanner[] {
  return [
    {
      id: "banner-1",
      eyebrow: "Destacados",
      title: "Productos activos y listos para vender",
      description: "Solo se muestran articulos reales publicados desde el panel admin.",
      imageUrl: "",
      buttonLabel: "Ver catalogo",
      buttonHref: "#catalogo",
      isEnabled: true,
      order: 1,
    },
    {
      id: "banner-2",
      eyebrow: "Soporte",
      title: "Chat directo dentro de la tienda",
      description: "Las conversaciones llegan al panel admin sin cerrar la pagina.",
      imageUrl: "",
      buttonLabel: "Abrir soporte",
      buttonHref: "#support",
      isEnabled: true,
      order: 2,
    },
  ];
}

function createDefaultSettings(): HomepageSettings {
  return {
    brandName: STORE_BRAND,
    brandTagline: "Marketplace moderno con productos reales, soporte directo y checkout rapido.",
    logoImageUrl: "",
    logoText: "Z",
    logoSize: 44,
    headerSearchEnabled: true,
    heroImageUrl: "",
    heroPrimaryButtonHref: "#catalogo",
    heroSecondaryButtonHref: "#support",
    theme: createDefaultTheme(),
    styles: createDefaultHomepageVisualStyles(),
    blocks: createDefaultHomepageBlocks(),
    banners: createDefaultBanners(),
    buttonOrder: createDefaultButtons(),
    sectionOrder: createDefaultSections(),
    localizedContent: {
      es: {
        promoBarText: "Solo productos activos del panel admin • Carrito persistente • Soporte directo",
        searchPlaceholder: "Buscar articulos, categorias o etiquetas",
        heroEyebrow: "Catalogo activo",
        heroTitle: "Productos publicados desde el panel admin, visibles al cliente en tiempo real.",
        heroDescription:
          "Catalogo conectado, carrito persistente, recogida programada, delivery y soporte conversacional dentro de la misma pagina.",
        heroPrimaryButtonLabel: "Explorar catalogo",
        heroSecondaryButtonLabel: "Hablar con soporte",
      },
      nl: {
        promoBarText: "Alleen actieve admin-producten • Permanente winkelwagen • Directe support",
        searchPlaceholder: "Zoek artikelen, categorieen of tags",
        heroEyebrow: "Actieve catalogus",
        heroTitle: "Producten uit het admin-paneel, direct zichtbaar voor klanten.",
        heroDescription:
          "Verbonden catalogus, permanente winkelwagen, geplande afhaling, levering en support chat op dezelfde pagina.",
        heroPrimaryButtonLabel: "Catalogus bekijken",
        heroSecondaryButtonLabel: "Support openen",
      },
      en: {
        promoBarText: "Only active admin products • Persistent cart • Direct support",
        searchPlaceholder: "Search items, categories or tags",
        heroEyebrow: "Active catalog",
        heroTitle: "Products published from the admin panel, visible to customers in real time.",
        heroDescription:
          "Connected catalog, persistent cart, scheduled pickup, delivery and conversational support on the same page.",
        heroPrimaryButtonLabel: "Explore catalog",
        heroSecondaryButtonLabel: "Open support",
      },
      pt: {
        promoBarText: "Somente produtos ativos do admin • Carrinho persistente • Suporte direto",
        searchPlaceholder: "Buscar artigos, categorias ou tags",
        heroEyebrow: "Catalogo ativo",
        heroTitle: "Produtos publicados no painel admin, visiveis ao cliente em tempo real.",
        heroDescription:
          "Catalogo conectado, carrinho persistente, retirada programada, entrega e suporte conversacional na mesma pagina.",
        heroPrimaryButtonLabel: "Explorar catalogo",
        heroSecondaryButtonLabel: "Abrir suporte",
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

function normalizeTheme(theme: HomepageThemeSettings | undefined): HomepageThemeSettings {
  const fallback = createDefaultTheme();

  return {
    primary: trimText(theme?.primary) || fallback.primary,
    secondary: trimText(theme?.secondary) || fallback.secondary,
    accent: trimText(theme?.accent) || fallback.accent,
    backgroundStart: trimText(theme?.backgroundStart) || fallback.backgroundStart,
    backgroundEnd: trimText(theme?.backgroundEnd) || fallback.backgroundEnd,
    backgroundGlow: trimText(theme?.backgroundGlow) || fallback.backgroundGlow,
    panel: trimText(theme?.panel) || fallback.panel,
    panelAlt: trimText(theme?.panelAlt) || fallback.panelAlt,
    headerSurface: trimText(theme?.headerSurface) || fallback.headerSurface,
    searchStart: trimText(theme?.searchStart) || fallback.searchStart,
    searchCenter: trimText(theme?.searchCenter) || fallback.searchCenter,
    searchEnd: trimText(theme?.searchEnd) || fallback.searchEnd,
    marqueeStart: trimText(theme?.marqueeStart) || fallback.marqueeStart,
    marqueeCenter: trimText(theme?.marqueeCenter) || fallback.marqueeCenter,
    marqueeEnd: trimText(theme?.marqueeEnd) || fallback.marqueeEnd,
  };
}

function normalizeButtons(buttons: HomepageButtonConfig[] | undefined): HomepageButtonConfig[] {
  const fallback = createDefaultButtons();

  return fallback.map((button, index) => {
    const existing = (buttons ?? []).find((item) => item.target === button.target);

    return {
      id: button.id,
      label: trimText(existing?.label) || button.label,
      target: button.target,
      isEnabled: true,
      order: index + 1,
    };
  });
}

function normalizeSections(sections: HomepageSectionConfig[] | undefined): HomepageSectionConfig[] {
  const fallback = createDefaultSections();

  return (sections ?? fallback)
    .map((section, index) => {
      const fallbackSection = fallback.find((item) => item.id === section.id);

      return {
        id: section.id,
        label: trimText(section.label) || fallbackSection?.label || section.id,
        subtitle: trimText(section.subtitle) || fallbackSection?.subtitle || "",
        description: trimText(section.description) || fallbackSection?.description || "",
        imageUrl: trimText(section.imageUrl),
        isEnabled: section.isEnabled ?? true,
        order: Number.isFinite(section.order) ? Number(section.order) : index + 1,
        productIds: (section.productIds ?? []).map((productId) => String(productId)).filter(Boolean),
      };
    })
    .sort((left, right) => left.order - right.order);
}

function normalizeBanners(
  banners: HomepageBanner[] | undefined,
  legacyPromoCards: Array<{
    id?: string;
    eyebrow?: string;
    title?: string;
    description?: string;
    isEnabled?: boolean;
  }> | undefined
): HomepageBanner[] {
  const fallback = createDefaultBanners();
  const source =
    banners && banners.length > 0
      ? banners
      : (legacyPromoCards ?? []).map((card, index) => ({
          id: card.id || `legacy-banner-${index}`,
          eyebrow: card.eyebrow ?? "",
          title: card.title ?? "",
          description: card.description ?? "",
          imageUrl: "",
          buttonLabel: "",
          buttonHref: "",
          isEnabled: card.isEnabled ?? true,
          order: index + 1,
        }));

  const normalized = source
    .map((banner, index) => ({
      id: banner.id || randomUUID(),
      eyebrow: trimText(banner.eyebrow),
      title: trimText(banner.title),
      description: trimText(banner.description),
      imageUrl: trimText(banner.imageUrl),
      buttonLabel: trimText(banner.buttonLabel),
      buttonHref: trimText(banner.buttonHref),
      isEnabled: banner.isEnabled ?? true,
      order: Number.isFinite(banner.order) ? Number(banner.order) : index + 1,
    }))
    .filter((banner) => banner.title);

  return (normalized.length > 0 ? normalized : fallback).sort((left, right) => left.order - right.order);
}

function normalizeSettings(settings: Partial<HomepageSettings> | null | undefined): HomepageSettings {
  const fallback = createDefaultSettings();
  const rawSettings = (settings ?? {}) as Partial<HomepageSettings> & {
    promoCards?: Array<{
      id?: string;
      eyebrow?: string;
      title?: string;
      description?: string;
      isEnabled?: boolean;
    }>;
  };
  const localizedContent = rawSettings.localizedContent ?? fallback.localizedContent;

  return {
    brandName: trimText(rawSettings.brandName) || fallback.brandName,
    brandTagline: trimText(rawSettings.brandTagline) || fallback.brandTagline,
    logoImageUrl: trimText(rawSettings.logoImageUrl),
    logoText: trimText(rawSettings.logoText) || fallback.logoText,
    logoSize: Number.isFinite(rawSettings.logoSize) ? Number(rawSettings.logoSize) : fallback.logoSize,
    headerSearchEnabled: rawSettings.headerSearchEnabled ?? fallback.headerSearchEnabled,
    heroImageUrl: trimText(rawSettings.heroImageUrl),
    heroPrimaryButtonHref: trimText(rawSettings.heroPrimaryButtonHref) || fallback.heroPrimaryButtonHref,
    heroSecondaryButtonHref:
      trimText(rawSettings.heroSecondaryButtonHref) || fallback.heroSecondaryButtonHref,
    theme: normalizeTheme(rawSettings.theme),
    styles: normalizeHomepageVisualStyles(rawSettings.styles),
    blocks: normalizeHomepageBlocks(rawSettings.blocks, rawSettings.banners, rawSettings.sectionOrder),
    banners: normalizeBanners(rawSettings.banners, rawSettings.promoCards),
    buttonOrder: normalizeButtons(rawSettings.buttonOrder),
    sectionOrder: normalizeSections(rawSettings.sectionOrder),
    localizedContent: {
      es: {
        promoBarText: trimText(localizedContent.es?.promoBarText) || fallback.localizedContent.es.promoBarText,
        searchPlaceholder:
          trimText(localizedContent.es?.searchPlaceholder) || fallback.localizedContent.es.searchPlaceholder,
        heroEyebrow: trimText(localizedContent.es?.heroEyebrow) || fallback.localizedContent.es.heroEyebrow,
        heroTitle: trimText(localizedContent.es?.heroTitle) || fallback.localizedContent.es.heroTitle,
        heroDescription:
          trimText(localizedContent.es?.heroDescription) || fallback.localizedContent.es.heroDescription,
        heroPrimaryButtonLabel:
          trimText(localizedContent.es?.heroPrimaryButtonLabel) ||
          fallback.localizedContent.es.heroPrimaryButtonLabel,
        heroSecondaryButtonLabel:
          trimText(localizedContent.es?.heroSecondaryButtonLabel) ||
          fallback.localizedContent.es.heroSecondaryButtonLabel,
      },
      nl: {
        promoBarText: trimText(localizedContent.nl?.promoBarText) || fallback.localizedContent.nl.promoBarText,
        searchPlaceholder:
          trimText(localizedContent.nl?.searchPlaceholder) || fallback.localizedContent.nl.searchPlaceholder,
        heroEyebrow: trimText(localizedContent.nl?.heroEyebrow) || fallback.localizedContent.nl.heroEyebrow,
        heroTitle: trimText(localizedContent.nl?.heroTitle) || fallback.localizedContent.nl.heroTitle,
        heroDescription:
          trimText(localizedContent.nl?.heroDescription) || fallback.localizedContent.nl.heroDescription,
        heroPrimaryButtonLabel:
          trimText(localizedContent.nl?.heroPrimaryButtonLabel) ||
          fallback.localizedContent.nl.heroPrimaryButtonLabel,
        heroSecondaryButtonLabel:
          trimText(localizedContent.nl?.heroSecondaryButtonLabel) ||
          fallback.localizedContent.nl.heroSecondaryButtonLabel,
      },
      en: {
        promoBarText: trimText(localizedContent.en?.promoBarText) || fallback.localizedContent.en.promoBarText,
        searchPlaceholder:
          trimText(localizedContent.en?.searchPlaceholder) || fallback.localizedContent.en.searchPlaceholder,
        heroEyebrow: trimText(localizedContent.en?.heroEyebrow) || fallback.localizedContent.en.heroEyebrow,
        heroTitle: trimText(localizedContent.en?.heroTitle) || fallback.localizedContent.en.heroTitle,
        heroDescription:
          trimText(localizedContent.en?.heroDescription) || fallback.localizedContent.en.heroDescription,
        heroPrimaryButtonLabel:
          trimText(localizedContent.en?.heroPrimaryButtonLabel) ||
          fallback.localizedContent.en.heroPrimaryButtonLabel,
        heroSecondaryButtonLabel:
          trimText(localizedContent.en?.heroSecondaryButtonLabel) ||
          fallback.localizedContent.en.heroSecondaryButtonLabel,
      },
      pt: {
        promoBarText: trimText(localizedContent.pt?.promoBarText) || fallback.localizedContent.pt.promoBarText,
        searchPlaceholder:
          trimText(localizedContent.pt?.searchPlaceholder) || fallback.localizedContent.pt.searchPlaceholder,
        heroEyebrow: trimText(localizedContent.pt?.heroEyebrow) || fallback.localizedContent.pt.heroEyebrow,
        heroTitle: trimText(localizedContent.pt?.heroTitle) || fallback.localizedContent.pt.heroTitle,
        heroDescription:
          trimText(localizedContent.pt?.heroDescription) || fallback.localizedContent.pt.heroDescription,
        heroPrimaryButtonLabel:
          trimText(localizedContent.pt?.heroPrimaryButtonLabel) ||
          fallback.localizedContent.pt.heroPrimaryButtonLabel,
        heroSecondaryButtonLabel:
          trimText(localizedContent.pt?.heroSecondaryButtonLabel) ||
          fallback.localizedContent.pt.heroSecondaryButtonLabel,
      },
    },
    updatedAt: rawSettings.updatedAt || fallback.updatedAt,
  };
}

async function readHomepageSettingsUncached() {
  const settings = await readDataFile<HomepageSettings | null>(HOMEPAGE_SETTINGS_FILE, null);
  return normalizeSettings(settings);
}

export async function getHomepageSettings() {
  return readHomepageSettingsUncached();
}

async function readStorefrontHomepageSettingsUncached() {
  const settings = await readHomepageSettingsUncached();
  const version = settings.updatedAt;

  return {
    ...settings,
    logoImageUrl: toStorefrontHomepageMediaUrl(settings.logoImageUrl, "logo", "logo", version),
    heroImageUrl: toStorefrontHomepageMediaUrl(settings.heroImageUrl, "hero", "hero", version),
    blocks: (settings.blocks ?? []).map((block) => ({
      ...block,
      imageUrl: toStorefrontHomepageMediaUrl(block.imageUrl, "block", block.id, version),
    })),
    banners: (settings.banners ?? []).map((banner) => ({
      ...banner,
      imageUrl: toStorefrontHomepageMediaUrl(banner.imageUrl, "banner", banner.id, version),
    })),
    sectionOrder: (settings.sectionOrder ?? []).map((section) => ({
      ...section,
      imageUrl: toStorefrontHomepageMediaUrl(section.imageUrl, "section", section.id, version),
    })),
  };
}

const getCachedStorefrontHomepageSettings = unstable_cache(
  async () => readStorefrontHomepageSettingsUncached(),
  ["storefront-homepage-settings"],
  {
    revalidate: 60,
    tags: [HOMEPAGE_SETTINGS_TAG],
  }
);

export async function getStorefrontHomepageSettings() {
  return getCachedStorefrontHomepageSettings();
}

export async function getHomepageMediaSource(kind: string | null, key: string | null) {
  const settings = await readHomepageSettingsUncached();

  if (kind === "logo") {
    return trimText(settings.logoImageUrl) || null;
  }

  if (kind === "hero") {
    return trimText(settings.heroImageUrl) || null;
  }

  if (kind === "block") {
    const block = (settings.blocks ?? []).find((entry) => entry.id === key);
    return trimText(block?.imageUrl) || null;
  }

  if (kind === "section") {
    const section = (settings.sectionOrder ?? []).find((entry) => entry.id === key);
    return trimText(section?.imageUrl) || null;
  }

  if (kind === "banner") {
    const banner = (settings.banners ?? []).find((entry) => entry.id === key);
    return trimText(banner?.imageUrl) || null;
  }

  return null;
}

export async function updateHomepageSettings(updates: Partial<HomepageSettings>) {
  const current = await readHomepageSettingsUncached();
  const next = normalizeSettings({
    ...current,
    ...updates,
    localizedContent: {
      ...current.localizedContent,
      ...updates.localizedContent,
    },
    updatedAt: new Date().toISOString(),
  });

  await writeDataFile(HOMEPAGE_SETTINGS_FILE, next);
  return next;
}
