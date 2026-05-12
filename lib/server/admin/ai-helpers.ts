import "server-only";

import { randomUUID } from "node:crypto";

import type { ProductAiDraft, ProductAiImageCandidate } from "@/lib/shop/admin-types";

function trimText(value: string | undefined) {
  return (value ?? "").trim();
}

function toTitleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCategory(categoryHint: string, nameHint: string) {
  const normalizedCategory = trimText(categoryHint).toLowerCase();

  if (normalizedCategory) {
    return normalizedCategory;
  }

  const normalizedName = trimText(nameHint).toLowerCase();

  if (normalizedName.includes("tv")) {
    return "televisores";
  }

  if (normalizedName.includes("lavadora")) {
    return "lavadoras";
  }

  if (normalizedName.includes("microondas")) {
    return "microondas";
  }

  if (normalizedName.includes("refrigerador") || normalizedName.includes("nevera")) {
    return "refrigeradores";
  }

  return "electrodomesticos";
}

function buildProductName(nameHint: string, brandHint: string, category: string) {
  const normalizedName = trimText(nameHint);
  const normalizedBrand = trimText(brandHint);

  if (normalizedName && normalizedBrand) {
    return `${toTitleCase(normalizedBrand)} ${toTitleCase(normalizedName)}`;
  }

  if (normalizedName) {
    return toTitleCase(normalizedName);
  }

  if (normalizedBrand) {
    return `${toTitleCase(normalizedBrand)} ${toTitleCase(category)}`;
  }

  return `Producto ${toTitleCase(category)}`;
}

function buildTags(name: string, brand: string, category: string) {
  return uniqueValues(
    [
      category,
      brand.toLowerCase(),
      name.toLowerCase(),
      `${category} premium`,
      `${brand.toLowerCase()} ecommerce`,
    ]
      .flatMap((value) => value.split(/\s+/))
      .map((value) => value.replace(/[^a-z0-9-]/gi, "").toLowerCase())
      .filter((value) => value.length > 2)
  );
}

function buildSku(name: string, brand: string, category: string) {
  const brandPrefix = slugify(brand).slice(0, 3).toUpperCase() || "ZRV";
  const categoryPrefix = slugify(category).slice(0, 3).toUpperCase() || "CAT";
  const namePrefix = slugify(name).slice(0, 4).toUpperCase() || "ITEM";
  return `${brandPrefix}-${categoryPrefix}-${namePrefix}`;
}

function buildInternalCode(name: string, category: string) {
  const categoryPrefix = slugify(category).slice(0, 4).toUpperCase() || "PROD";
  const namePrefix = slugify(name).slice(0, 5).toUpperCase() || "ITEM";
  return `INT-${categoryPrefix}-${namePrefix}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;");
}

function createVariantUrl(
  sourceImageUrl: string,
  name: string,
  config: {
    label: string;
    background: string;
    accent: string;
    badge: string;
    imageX: number;
    imageY: number;
    imageWidth: number;
    imageHeight: number;
    rotate: number;
    overlayOpacity: number;
  }
) {
  const safeImageUrl = escapeXml(sourceImageUrl);
  const safeName = escapeXml(name);
  const safeLabel = escapeXml(config.label);
  const safeBadge = escapeXml(config.badge);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
      <defs>
        <linearGradient id="zorvya-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${config.background}"/>
          <stop offset="100%" stop-color="#060914"/>
        </linearGradient>
        <filter id="zorvya-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="24" stdDeviation="36" flood-color="#000000" flood-opacity="0.42"/>
        </filter>
      </defs>
      <rect width="1200" height="1200" rx="72" fill="url(#zorvya-bg)"/>
      <circle cx="940" cy="210" r="170" fill="${config.accent}" opacity="0.24"/>
      <circle cx="180" cy="980" r="220" fill="${config.accent}" opacity="0.12"/>
      <rect x="72" y="72" width="1056" height="1056" rx="54" fill="#0b1020" opacity="${config.overlayOpacity}"/>
      <g filter="url(#zorvya-shadow)">
        <rect x="110" y="190" width="680" height="760" rx="44" fill="rgba(255,255,255,0.06)"/>
        <image
          href="${safeImageUrl}"
          x="${config.imageX}"
          y="${config.imageY}"
          width="${config.imageWidth}"
          height="${config.imageHeight}"
          preserveAspectRatio="xMidYMid meet"
          transform="rotate(${config.rotate} 450 560)"
        />
      </g>
      <rect x="804" y="244" width="238" height="44" rx="22" fill="${config.accent}" opacity="0.88"/>
      <text x="836" y="272" fill="#ffffff" font-family="Arial, sans-serif" font-size="18" font-weight="700">
        ${safeBadge}
      </text>
      <text x="804" y="364" fill="#ffffff" font-family="Arial, sans-serif" font-size="46" font-weight="700">
        ${safeName}
      </text>
      <text x="804" y="424" fill="#9fb0d1" font-family="Arial, sans-serif" font-size="24" font-weight="500">
        ${safeLabel}
      </text>
      <rect x="804" y="480" width="286" height="2" rx="1" fill="${config.accent}" opacity="0.72"/>
      <text x="804" y="560" fill="#d4def4" font-family="Arial, sans-serif" font-size="22">
        Imagen optimizada para ecommerce
      </text>
      <text x="804" y="610" fill="#8ea3c7" font-family="Arial, sans-serif" font-size="22">
        Marca preservada y producto real
      </text>
      <text x="804" y="660" fill="#8ea3c7" font-family="Arial, sans-serif" font-size="22">
        Variacion comercial generada
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildGeneratedImages(sourceImageUrl: string, name: string): ProductAiImageCandidate[] {
  const variants = [
    {
      label: "Frontal limpia",
      badge: "Studio",
      background: "#0f172a",
      accent: "#22d3ee",
      imageX: 160,
      imageY: 250,
      imageWidth: 600,
      imageHeight: 600,
      rotate: 0,
      overlayOpacity: 0.4,
    },
    {
      label: "Angulo comercial",
      badge: "Angle",
      background: "#081225",
      accent: "#2563eb",
      imageX: 135,
      imageY: 208,
      imageWidth: 650,
      imageHeight: 650,
      rotate: -6,
      overlayOpacity: 0.36,
    },
    {
      label: "Detalle premium",
      badge: "Detail",
      background: "#0f0f19",
      accent: "#ef4444",
      imageX: 82,
      imageY: 130,
      imageWidth: 760,
      imageHeight: 760,
      rotate: 0,
      overlayOpacity: 0.34,
    },
    {
      label: "Catalogo ecommerce",
      badge: "Catalog",
      background: "#071827",
      accent: "#10b981",
      imageX: 148,
      imageY: 230,
      imageWidth: 620,
      imageHeight: 620,
      rotate: 3,
      overlayOpacity: 0.3,
    },
  ];

  return variants.map((variant) => {
    return {
      id: randomUUID(),
      url: createVariantUrl(sourceImageUrl, name, variant),
      label: `${variant.label} - ${name}`,
    };
  });
}

async function generateNannoBannanoImages(input: {
  sourceImageUrl: string;
  name: string;
  brand: string;
  category: string;
}) {
  const endpoint = trimText(process.env.NANNO_BANNANO_API_URL);

  if (!endpoint) {
    return null;
  }

  const apiKey = trimText(process.env.NANNO_BANNANO_API_KEY);
  const prompt = [
    "Generate ecommerce-ready product images from the uploaded reference.",
    `Keep the exact product, brand and logo unchanged.`,
    `Preserve the original item identity for ${input.name}.`,
    `Brand: ${input.brand || "original brand"}.`,
    `Category: ${input.category}.`,
    "Return multiple clean studio variants and commercial angles.",
  ].join(" ");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      provider: "nanno-bannano",
      referenceImage: input.sourceImageUrl,
      prompt,
      variations: 4,
      size: "1200x1200",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("NANNO_BANNANO_REQUEST_FAILED");
  }

  const payload = (await response.json()) as {
    images?: Array<{ url?: string; label?: string }>;
    data?: { images?: Array<{ url?: string; label?: string }> };
  };

  const rawImages = payload.images ?? payload.data?.images ?? [];

  return rawImages
    .map((image, index) => ({
      id: randomUUID(),
      url: trimText(image.url),
      label: trimText(image.label) || `Variante ${index + 1} - ${input.name}`,
    }))
    .filter((image) => image.url);
}

export async function generateProductAiDraft(input: {
  sourceImageUrl: string;
  nameHint?: string;
  brandHint?: string;
  categoryHint?: string;
}): Promise<Omit<ProductAiDraft, "id" | "createdAt" | "updatedAt" | "linkedProductId">> {
  const sourceImageUrl = trimText(input.sourceImageUrl);
  const brandHint = trimText(input.brandHint);
  const nameHint = trimText(input.nameHint);
  const categoryHint = trimText(input.categoryHint);
  const suggestedCategory = buildCategory(categoryHint, nameHint);
  const suggestedName = buildProductName(nameHint, brandHint, suggestedCategory);
  const generatedImages =
    (await generateNannoBannanoImages({
      sourceImageUrl,
      name: suggestedName,
      brand: brandHint,
      category: suggestedCategory,
    }).catch(() => null)) ?? buildGeneratedImages(sourceImageUrl, suggestedName);
  const suggestedTags = buildTags(suggestedName, brandHint || "zorvya", suggestedCategory);
  const suggestedSku = buildSku(suggestedName, brandHint, suggestedCategory);
  const suggestedInternalCode = buildInternalCode(suggestedName, suggestedCategory);
  const suggestedShortDescription = `${suggestedName} con presentacion optimizada para ecommerce y enfoque en venta directa.`;
  const suggestedLongDescription = `${suggestedName} preparado para catalogo digital, con enfoque en confianza visual, lectura rapida y ficha comercial clara. La propuesta mantiene la marca original y organiza el anuncio para destacar beneficios, categoria y presencia del producto en tienda.`;

  return {
    sourceImageUrl,
    nameHint,
    brandHint,
    categoryHint,
    suggestedName,
    suggestedSku,
    suggestedInternalCode,
    suggestedShortDescription,
    suggestedLongDescription,
    suggestedCategory,
    suggestedTags,
    generatedImages,
    approvedName: suggestedName,
    approvedSku: suggestedSku,
    approvedInternalCode: suggestedInternalCode,
    approvedShortDescription: suggestedShortDescription,
    approvedLongDescription: suggestedLongDescription,
    approvedCategory: suggestedCategory,
    approvedTags: suggestedTags,
    approvedImageIds: generatedImages.slice(0, 2).map((image) => image.id),
  };
}
