import type {
  HomepageBanner,
  HomepageBlock,
  HomepageCatalogSource,
  HomepageSectionConfig,
} from "@/lib/shop/admin-types";

type ProductLike = {
  id: string | number;
  isActive?: boolean;
  isVisible?: boolean;
  isFeatured?: boolean;
  isTop?: boolean;
  originalPrice?: number;
  price: number;
  createdAt?: string;
};

function trimText(value: string | undefined) {
  return (value ?? "").trim();
}

function normalizeCatalogSource(value: string | null | undefined): HomepageCatalogSource | null {
  if (
    value === "featured" ||
    value === "top" ||
    value === "promotions" ||
    value === "newProducts" ||
    value === "allProducts" ||
    value === "ads" ||
    value === "custom"
  ) {
    return value;
  }

  return null;
}

export function createDefaultHomepageBlocks(): HomepageBlock[] {
  return [
    {
      id: "hero-main",
      type: "hero",
      title: "Hero principal",
      subtitle: "Bloque principal",
      description: "Presentacion principal del homepage.",
      imageUrl: "",
      buttonLabel: "",
      buttonHref: "",
      isEnabled: true,
      order: 1,
      isEditable: true,
      isRemovable: false,
      catalogSource: null,
      productIds: [],
    },
    {
      id: "catalog-featured",
      type: "catalog",
      title: "Destacados",
      subtitle: "Seleccion principal",
      description: "Productos destacados para abrir la home con fuerza.",
      imageUrl: "",
      buttonLabel: "",
      buttonHref: "",
      isEnabled: true,
      order: 2,
      isEditable: true,
      isRemovable: true,
      catalogSource: "featured",
      productIds: [],
    },
    {
      id: "announcement-mid-1",
      type: "announcement",
      title: "Compra rapida con soporte directo",
      subtitle: "Anuncio intermedio",
      description: "Recibe ayuda en tiempo real y confirma tu pedido sin salir de la pagina.",
      imageUrl: "",
      buttonLabel: "Abrir soporte",
      buttonHref: "#support",
      isEnabled: true,
      order: 3,
      isEditable: true,
      isRemovable: true,
      catalogSource: null,
      productIds: [],
    },
    {
      id: "catalog-top",
      type: "catalog",
      title: "Top ventas",
      subtitle: "Lo mas buscado",
      description: "Productos con mejor rendimiento comercial dentro de la tienda.",
      imageUrl: "",
      buttonLabel: "",
      buttonHref: "",
      isEnabled: true,
      order: 4,
      isEditable: true,
      isRemovable: true,
      catalogSource: "top",
      productIds: [],
    },
    {
      id: "catalog-promotions",
      type: "catalog",
      title: "Promociones",
      subtitle: "Ofertas activas",
      description: "Productos con precio anterior y descuento visible.",
      imageUrl: "",
      buttonLabel: "",
      buttonHref: "",
      isEnabled: true,
      order: 5,
      isEditable: true,
      isRemovable: true,
      catalogSource: "promotions",
      productIds: [],
    },
    {
      id: "catalog-new",
      type: "catalog",
      title: "Nuevos productos",
      subtitle: "Catalogo reciente",
      description: "Ultimas publicaciones listas para mostrarse en la home.",
      imageUrl: "",
      buttonLabel: "",
      buttonHref: "",
      isEnabled: true,
      order: 6,
      isEditable: true,
      isRemovable: true,
      catalogSource: "newProducts",
      productIds: [],
    },
    {
      id: "catalog-all",
      type: "catalog",
      title: "Todos los productos",
      subtitle: "Catalogo completo",
      description: "Toda la tienda activa organizada en una sola vista.",
      imageUrl: "",
      buttonLabel: "",
      buttonHref: "",
      isEnabled: true,
      order: 7,
      isEditable: true,
      isRemovable: true,
      catalogSource: "allProducts",
      productIds: [],
    },
    {
      id: "info-main",
      type: "info",
      title: "Informacion destacada",
      subtitle: "Bloque editorial",
      description: "Espacio para mensajes de confianza, promociones o informacion clave.",
      imageUrl: "",
      buttonLabel: "",
      buttonHref: "",
      isEnabled: true,
      order: 8,
      isEditable: true,
      isRemovable: true,
      catalogSource: null,
      productIds: [],
    },
  ];
}

function createBlockFromBanner(banner: HomepageBanner, index: number): HomepageBlock {
  return {
    id: banner.id || `banner-block-${index + 1}`,
    type: "banner",
    title: trimText(banner.title) || `Banner ${index + 1}`,
    subtitle: trimText(banner.eyebrow) || "Banner promocional",
    description: trimText(banner.description),
    imageUrl: trimText(banner.imageUrl),
    buttonLabel: trimText(banner.buttonLabel),
    buttonHref: trimText(banner.buttonHref),
    isEnabled: banner.isEnabled ?? true,
    order: Number.isFinite(banner.order) ? Number(banner.order) : index + 1,
    isEditable: true,
    isRemovable: true,
    catalogSource: null,
    productIds: [],
  };
}

function createBlockFromSection(section: HomepageSectionConfig, index: number): HomepageBlock {
  return {
    id: section.id || `section-block-${index + 1}`,
    type: section.id === "info" ? "info" : "catalog",
    title: trimText(section.label) || section.id,
    subtitle: trimText(section.subtitle),
    description: trimText(section.description),
    imageUrl: trimText(section.imageUrl),
    buttonLabel: "",
    buttonHref: "",
    isEnabled: section.isEnabled ?? true,
    order: Number.isFinite(section.order) ? Number(section.order) : index + 1,
    isEditable: true,
    isRemovable: section.id !== "featured" && section.id !== "top" ? true : true,
    catalogSource: section.id === "info" ? null : (section.id as HomepageCatalogSource),
    productIds: (section.productIds ?? []).map(String).filter(Boolean),
  };
}

function createLegacyHomepageBlocks(
  banners: HomepageBanner[] | undefined,
  sections: HomepageSectionConfig[] | undefined
) {
  const defaults = createDefaultHomepageBlocks();
  const heroBlock = defaults[0];
  const bannerBlocks = (banners ?? []).map(createBlockFromBanner);
  const sectionBlocks = (sections ?? []).map(createBlockFromSection);

  return [heroBlock, ...bannerBlocks, ...sectionBlocks];
}

export function normalizeHomepageBlocks(
  blocks: HomepageBlock[] | undefined,
  legacyBanners: HomepageBanner[] | undefined,
  legacySections: HomepageSectionConfig[] | undefined
): HomepageBlock[] {
  const fallback = createDefaultHomepageBlocks();
  const source =
    blocks && blocks.length > 0 ? blocks : createLegacyHomepageBlocks(legacyBanners, legacySections);

  const normalized = source
    .map((block, index) => {
      const fallbackBlock =
        fallback.find((item) => item.id === block.id || item.type === block.type) ?? fallback[0];

      return {
        id: block.id || `${block.type}-${index + 1}`,
        type: block.type ?? fallbackBlock.type,
        title: trimText(block.title) || fallbackBlock.title,
        subtitle: trimText(block.subtitle) || fallbackBlock.subtitle,
        description: trimText(block.description) || fallbackBlock.description,
        imageUrl: trimText(block.imageUrl),
        buttonLabel: trimText(block.buttonLabel),
        buttonHref: trimText(block.buttonHref),
        isEnabled: block.isEnabled ?? true,
        order: Number.isFinite(block.order) ? Number(block.order) : index + 1,
        isEditable: block.isEditable ?? true,
        isRemovable: block.type === "hero" ? false : block.isRemovable ?? true,
        catalogSource:
          block.type === "catalog"
            ? normalizeCatalogSource(block.catalogSource) ?? fallbackBlock.catalogSource ?? "custom"
            : null,
        productIds: (block.productIds ?? []).map(String).filter(Boolean),
      } satisfies HomepageBlock;
    })
    .sort((left, right) => left.order - right.order);

  if (!normalized.some((block) => block.type === "hero")) {
    return [
      { ...fallback[0], order: 1 },
      ...normalized.map((block, index) => ({
        ...block,
        order: index + 2,
      })),
    ];
  }

  return normalized.map((block, index) => ({
    ...block,
    order: index + 1,
    isRemovable: block.type === "hero" ? false : block.isRemovable,
  }));
}

export function createAnnouncementBlock(nextOrder: number): HomepageBlock {
  return {
    id: `announcement-${nextOrder}`,
    type: "announcement",
    title: "Nuevo anuncio intermedio",
    subtitle: "Bloque promocional",
    description: "Edita este bloque para destacar una promocion, llamada o mensaje especial.",
    imageUrl: "",
    buttonLabel: "Ver mas",
    buttonHref: "#catalogo",
    isEnabled: true,
    order: nextOrder,
    isEditable: true,
    isRemovable: true,
    catalogSource: null,
    productIds: [],
  };
}

export function createBannerBlock(nextOrder: number): HomepageBlock {
  return {
    id: `banner-${nextOrder}`,
    type: "banner",
    title: "Nuevo banner",
    subtitle: "Banner promocional",
    description: "Edita imagen, titulo, subtitulo y boton desde Ajustes.",
    imageUrl: "",
    buttonLabel: "Explorar",
    buttonHref: "#catalogo",
    isEnabled: true,
    order: nextOrder,
    isEditable: true,
    isRemovable: true,
    catalogSource: null,
    productIds: [],
  };
}

export function createCatalogBlock(nextOrder: number): HomepageBlock {
  return {
    id: `catalog-${nextOrder}`,
    type: "catalog",
    title: "Nuevo catalogo",
    subtitle: "Bloque de catalogo",
    description: "Selecciona el tipo de catalogo o productos especificos.",
    imageUrl: "",
    buttonLabel: "",
    buttonHref: "",
    isEnabled: true,
    order: nextOrder,
    isEditable: true,
    isRemovable: true,
    catalogSource: "custom",
    productIds: [],
  };
}

export function createInfoBlock(nextOrder: number): HomepageBlock {
  return {
    id: `info-${nextOrder}`,
    type: "info",
    title: "Nuevo bloque informativo",
    subtitle: "Informacion destacada",
    description: "Usa este bloque para explicar promos, confianza o informacion clave.",
    imageUrl: "",
    buttonLabel: "",
    buttonHref: "",
    isEnabled: true,
    order: nextOrder,
    isEditable: true,
    isRemovable: true,
    catalogSource: null,
    productIds: [],
  };
}

export function resolveHomepageBlockProducts<T extends ProductLike>(
  block: HomepageBlock,
  products: T[]
) {
  const visibleProducts = products.filter(
    (product) => (product.isActive ?? true) && (product.isVisible ?? true)
  );

  if (block.type !== "catalog") {
    return [] as T[];
  }

  if (block.productIds.length > 0) {
    return block.productIds
      .map((productId) => visibleProducts.find((product) => String(product.id) === String(productId)))
      .filter((product): product is T => Boolean(product));
  }

  switch (block.catalogSource) {
    case "featured":
      return visibleProducts.filter((product) => product.isFeatured).slice(0, 8);
    case "top":
      return visibleProducts.filter((product) => product.isTop).slice(0, 8);
    case "promotions":
      return visibleProducts
        .filter((product) => (product.originalPrice ?? 0) > product.price)
        .slice(0, 8);
    case "newProducts":
      return [...visibleProducts]
        .sort(
          (left, right) =>
            new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime()
        )
        .slice(0, 8);
    case "allProducts":
      return visibleProducts;
    case "ads":
      return visibleProducts.slice(0, 8);
    case "custom":
    default:
      return visibleProducts.slice(0, 8);
  }
}
