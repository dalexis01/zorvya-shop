"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import DeliveryEstimateBadge from "@/components/storefront/DeliveryEstimateBadge";
import { createStars } from "@/lib/shop/display-utils";
import { formatCurrencySrd as formatCurrency } from "@/lib/shop/number-format";
import type { Locale, ProductReview, StorefrontProduct } from "@/lib/shop/types";

type QuickViewSelection = {
  selectedVariantId?: string;
  selectedVariantName?: string;
  selectedColor?: string;
  unitPrice?: number;
  selectedImage?: string;
};

type RelatedProductEntry = {
  product: StorefrontProduct;
  kind: "recommended" | "similar";
};

const texts = {
  es: {
    close: "Cerrar",
    addToCart: "Agregar al carro",
    modelLabel: "Modelos disponibles",
    colorLabel: "Colores disponibles",
    currentModel: "Modelo principal",
    reviews: "resenas",
    fullscreen: "Abrir imagen",
    recommendedTitle: "Recomendados",
    recommendedSubtitle: "Similares",
    recommendedBadge: "Recomendado",
    similarBadge: "Similar",
    recommendedEmpty: "Estoy reuniendo opciones parecidas para este articulo.",
    recommendedSearchPlaceholder: "Buscar producto",
    recommendedSearchEmpty: "No encontre productos con esa busqueda.",
    reviewAction: "Dejar resena",
    reviewTitle: "Deja tu resena",
    reviewSubtitle: "Toca las estrellas y deja tu comentario si quieres.",
    reviewName: "Nombre",
    reviewEmail: "Correo",
    reviewComment: "Comentario",
    reviewRecent: "Resenas recientes",
    reviewEmpty: "Aun no hay resenas para este articulo.",
    reviewSaved: "Resena guardada.",
    reviewError: "No se pudo guardar la resena.",
    reviewSend: "Enviar resena",
    reviewSending: "Enviando...",
    seeMore: "Ver mas",
  },
  nl: {
    close: "Sluiten",
    addToCart: "Toevoegen",
    modelLabel: "Beschikbare modellen",
    colorLabel: "Beschikbare kleuren",
    currentModel: "Hoofdmodel",
    reviews: "reviews",
    fullscreen: "Afbeelding openen",
    recommendedTitle: "Aanbevolen",
    recommendedSubtitle: "Vergelijkbaar",
    recommendedBadge: "Aanbevolen",
    similarBadge: "Vergelijkbaar",
    recommendedEmpty: "Ik verzamel nog vergelijkbare opties voor dit artikel.",
    recommendedSearchPlaceholder: "Product zoeken",
    recommendedSearchEmpty: "Ik kon geen producten vinden voor die zoekopdracht.",
    reviewAction: "Review plaatsen",
    reviewTitle: "Laat je review achter",
    reviewSubtitle: "Tik op de sterren en laat een reactie achter als je wilt.",
    reviewName: "Naam",
    reviewEmail: "E-mail",
    reviewComment: "Reactie",
    reviewRecent: "Recente reviews",
    reviewEmpty: "Er zijn nog geen reviews voor dit artikel.",
    reviewSaved: "Review opgeslagen.",
    reviewError: "De review kon niet worden opgeslagen.",
    reviewSend: "Review verzenden",
    reviewSending: "Verzenden...",
    seeMore: "Meer zien",
  },
  en: {
    close: "Close",
    addToCart: "Add to cart",
    modelLabel: "Available models",
    colorLabel: "Available colors",
    currentModel: "Main model",
    reviews: "reviews",
    fullscreen: "Open image",
    recommendedTitle: "Recommended",
    recommendedSubtitle: "Similar",
    recommendedBadge: "Recommended",
    similarBadge: "Similar",
    recommendedEmpty: "I am still gathering similar options for this item.",
    recommendedSearchPlaceholder: "Search product",
    recommendedSearchEmpty: "I could not find products for that search.",
    reviewAction: "Leave review",
    reviewTitle: "Leave your review",
    reviewSubtitle: "Tap the stars and add a comment if you want.",
    reviewName: "Name",
    reviewEmail: "Email",
    reviewComment: "Comment",
    reviewRecent: "Recent reviews",
    reviewEmpty: "There are no reviews for this item yet.",
    reviewSaved: "Review saved.",
    reviewError: "The review could not be saved.",
    reviewSend: "Send review",
    reviewSending: "Sending...",
    seeMore: "See more",
  },
  pt: {
    close: "Fechar",
    addToCart: "Adicionar ao carrinho",
    modelLabel: "Modelos disponiveis",
    colorLabel: "Cores disponiveis",
    currentModel: "Modelo principal",
    reviews: "avaliacoes",
    fullscreen: "Abrir imagem",
    recommendedTitle: "Recomendados",
    recommendedSubtitle: "Similares",
    recommendedBadge: "Recomendado",
    similarBadge: "Similar",
    recommendedEmpty: "Ainda estou reunindo opcoes parecidas para este artigo.",
    recommendedSearchPlaceholder: "Buscar produto",
    recommendedSearchEmpty: "Nao encontrei produtos para essa busca.",
    reviewAction: "Deixar avaliacao",
    reviewTitle: "Deixe sua avaliacao",
    reviewSubtitle: "Toque nas estrelas e deixe um comentario se quiser.",
    reviewName: "Nome",
    reviewEmail: "E-mail",
    reviewComment: "Comentario",
    reviewRecent: "Avaliacoes recentes",
    reviewEmpty: "Ainda nao ha avaliacoes para este artigo.",
    reviewSaved: "Avaliacao salva.",
    reviewError: "Nao foi possivel salvar a avaliacao.",
    reviewSend: "Enviar avaliacao",
    reviewSending: "Enviando...",
    seeMore: "Ver mais",
  },
} as const;

type ModelOption = {
  id: string;
  name: string;
  price: number;
  color: string;
  details: string;
  imageUrl: string;
  isBase: boolean;
};



function calculateReviewMetrics(
  reviews: ProductReview[],
  fallbackRating: number,
  fallbackReviewCount: number
) {
  if (reviews.length === 0) {
    return {
      averageRating: fallbackRating,
      reviewCount: fallbackReviewCount,
    };
  }

  return {
    averageRating:
      Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) /
      10,
    reviewCount: reviews.length,
  };
}

function createSeededRandom(seed: number) {
  let state = seed % 2147483647;

  if (state <= 0) {
    state += 2147483646;
  }

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function hashText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash || 1;
}

function pickRandomRelatedProducts(
  entries: RelatedProductEntry[],
  limit: number,
  seedSource: string
) {
  if (entries.length <= limit) {
    return entries;
  }

  const shuffled = [...entries];
  const random = createSeededRandom(hashText(seedSource));

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[nextIndex]] = [shuffled[nextIndex], shuffled[index]];
  }

  return shuffled.slice(0, limit);
}

function shouldUseDirectStorefrontImage(src: string) {
  return src.startsWith("data:") || src.startsWith("/api/products/");
}

function QuickViewImage({
  src,
  alt,
  className,
  sizes,
  priority = false,
}: {
  src: string;
  alt: string;
  className: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_30%_25%,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_72%_72%,rgba(59,130,246,0.14),transparent_30%),linear-gradient(180deg,#08111d_0%,#0f172a_100%)] text-cyan-100">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m7.5 15.5 3-3 2.5 2.5 2.5-3 1.5 2" />
          <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
        </svg>
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em]">ZorvyA Shop</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      quality={100}
      unoptimized={shouldUseDirectStorefrontImage(src)}
      sizes={sizes ?? "(max-width: 1024px) 100vw, 40vw"}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}

export default function ProductQuickViewPanel({
  product,
  locale,
  deliveryEstimateText,
  relatedProducts = [],
  searchProducts = [],
  relatedSearchQuery,
  relatedRefreshIndex,
  reviewAuthorName,
  reviewAuthorEmail,
  onClose,
  onAdd,
  onOpenRelated,
  onRelatedSearchQueryChange,
  onRefreshRelated,
  onReviewSubmitted,
  initialSelection,
}: {
  product: StorefrontProduct;
  locale: Locale;
  deliveryEstimateText?: string;
  relatedProducts?: RelatedProductEntry[];
  searchProducts?: StorefrontProduct[];
  relatedSearchQuery: string;
  relatedRefreshIndex: number;
  reviewAuthorName?: string;
  reviewAuthorEmail?: string;
  onClose: (selection?: QuickViewSelection) => void;
  onAdd: (product: StorefrontProduct, selection?: QuickViewSelection) => void;
  onOpenRelated?: (product: StorefrontProduct) => void;
  onRelatedSearchQueryChange: (value: string) => void;
  onRefreshRelated: () => void;
  onReviewSubmitted?: (
    productId: string | number,
    nextRating: number,
    nextReviewCount: number
  ) => void;
  initialSelection?: QuickViewSelection;
}) {
  const t = texts[locale];
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const relatedVisibleLimit = isCompactViewport ? 8 : 4;
  const [selectedModelId, setSelectedModelId] = useState(initialSelection?.selectedVariantId ?? "base");
  const [selectedColor, setSelectedColor] = useState(initialSelection?.selectedColor ?? "");
  const [selectedImage, setSelectedImage] = useState(
    initialSelection?.selectedImage ?? product.images[0] ?? product.image
  );
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewComposerOpen, setReviewComposerOpen] = useState(false);
  const [reviewName, setReviewName] = useState(reviewAuthorName ?? "");
  const [reviewEmail, setReviewEmail] = useState(reviewAuthorEmail ?? "");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewNotice, setReviewNotice] = useState("");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsCompactViewport(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  useEffect(() => {
    setSelectedModelId(initialSelection?.selectedVariantId ?? "base");
    setSelectedColor(initialSelection?.selectedColor ?? "");
    setSelectedImage(initialSelection?.selectedImage ?? product.images[0] ?? product.image);
    setLightboxOpen(false);
    setReviewComposerOpen(false);
    setReviewError("");
    setReviewNotice("");
  }, [
    initialSelection?.selectedColor,
    initialSelection?.selectedImage,
    initialSelection?.selectedVariantId,
    product.id,
    product.image,
    product.images,
  ]);

  const modelOptions = useMemo<ModelOption[]>(() => {
    const fullProductDescription = product.longDescription || product.shortDescription;
    const baseModel: ModelOption = {
      id: "base",
      name: t.currentModel,
      price: product.price,
      color: "",
      details: fullProductDescription,
      imageUrl: product.image,
      isBase: true,
    };

    return [
      baseModel,
      ...product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name || t.currentModel,
        price: variant.price > 0 ? variant.price : product.price,
        color: variant.color,
        details: [variant.details, fullProductDescription].filter(Boolean).join("\n\n"),
        imageUrl: variant.imageUrl || product.image,
        isBase: false,
      })),
    ];
  }, [product, t.currentModel]);

  const selectedModel = modelOptions.find((entry) => entry.id === selectedModelId) ?? modelOptions[0];
  const availableColors = useMemo(() => {
    const colors = new Set(product.colors.filter(Boolean));

    for (const model of modelOptions) {
      if (model.color) {
        colors.add(model.color);
      }
    }

    return Array.from(colors);
  }, [modelOptions, product.colors]);

  const gallery = useMemo(() => {
    return Array.from(new Set([selectedModel.imageUrl, ...product.images].filter(Boolean)));
  }, [product.images, selectedModel.imageUrl]);

  const activeImage = selectedImage || selectedModel.imageUrl || product.image;
  const currentSelection = useMemo<QuickViewSelection>(
    () => ({
      selectedVariantId: selectedModel.isBase ? undefined : selectedModel.id,
      selectedVariantName: selectedModel.isBase ? undefined : selectedModel.name,
      selectedColor: selectedColor || selectedModel.color || undefined,
      unitPrice: selectedModel.price,
      selectedImage: activeImage,
    }),
    [activeImage, selectedColor, selectedModel]
  );
  const searchableRelatedEntries = useMemo(() => {
    const dedupedEntries = new Map<string, RelatedProductEntry>();

    for (const entry of relatedProducts) {
      dedupedEntries.set(String(entry.product.id), entry);
    }

    for (const searchProduct of searchProducts) {
      const productId = String(searchProduct.id);

      if (!dedupedEntries.has(productId)) {
        dedupedEntries.set(productId, {
          product: searchProduct,
          kind: "similar",
        });
      }
    }

    return Array.from(dedupedEntries.values());
  }, [relatedProducts, searchProducts]);
  const normalizedRelatedSearchQuery = relatedSearchQuery.trim().toLocaleLowerCase();
  const visibleRelatedProducts = useMemo(
    () => {
      if (normalizedRelatedSearchQuery) {
        return searchableRelatedEntries
          .filter((entry) =>
            [
              entry.product.name,
              entry.product.category,
              entry.product.brand,
              entry.product.shortDescription,
              ...entry.product.tags,
            ]
              .join(" ")
              .toLocaleLowerCase()
              .includes(normalizedRelatedSearchQuery)
          )
          .slice(0, relatedVisibleLimit);
      }

      return pickRandomRelatedProducts(
        relatedProducts,
        relatedVisibleLimit,
        `${String(product.id)}:${relatedRefreshIndex}`
      );
    },
    [
      normalizedRelatedSearchQuery,
      product.id,
      relatedVisibleLimit,
      relatedProducts,
      relatedRefreshIndex,
      searchableRelatedEntries,
    ]
  );
  const { averageRating, reviewCount } = useMemo(
    () => calculateReviewMetrics(reviews, product.rating, product.reviewCount),
    [product.rating, product.reviewCount, reviews]
  );
  const recentReviews = useMemo(() => reviews.slice(0, 3), [reviews]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (reviewComposerOpen) {
          setReviewComposerOpen(false);
          return;
        }

        if (lightboxOpen) {
          setLightboxOpen(false);
          return;
        }

        onClose(currentSelection);
      }
    };

    // Body scroll is already locked by ShopPage — don't double-lock here.
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentSelection, lightboxOpen, onClose, reviewComposerOpen]);

  useEffect(() => {
    setReviewName(reviewAuthorName ?? "");
    setReviewEmail(reviewAuthorEmail ?? "");
  }, [reviewAuthorEmail, reviewAuthorName]);

  useEffect(() => {
    let cancelled = false;

    setReviews([]);
    setReviewsLoading(true);
    setReviewComment("");
    setReviewError("");
    setReviewNotice("");
    setReviewRating(5);
    setReviewComposerOpen(false);

    const loadReviews = async () => {
      try {
        const response = await fetch(`/api/products/${product.id}/reviews`, {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          success?: boolean;
          reviews?: ProductReview[];
        };

        if (!cancelled && data.success && Array.isArray(data.reviews)) {
          setReviews(data.reviews);
        }
      } catch {
        return;
      } finally {
        if (!cancelled) {
          setReviewsLoading(false);
        }
      }
    };

    void loadReviews();

    return () => {
      cancelled = true;
    };
  }, [product.id]);

  function moveLightbox(direction: -1 | 1) {
    const currentIndex = gallery.findIndex((image) => image === activeImage);
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + direction + gallery.length) % gallery.length;

    setSelectedImage(gallery[nextIndex] ?? gallery[0] ?? product.image);
  }

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!Number.isFinite(reviewRating) || reviewRating < 1 || reviewRating > 5) {
      return;
    }

    setReviewSubmitting(true);
    setReviewError("");

    try {
      const response = await fetch(`/api/products/${product.id}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: reviewName,
          email: reviewEmail,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        review?: ProductReview;
        rating?: number;
        reviewCount?: number;
        error?: string;
      };

      if (!response.ok || !data.success || !data.review) {
        setReviewError(data.error || t.reviewError);
        return;
      }

      setReviews((currentReviews) => [data.review!, ...currentReviews]);
      setReviewComment("");
      setReviewRating(5);
      setReviewNotice(t.reviewSaved);
      setReviewComposerOpen(false);
      onReviewSubmitted?.(
        product.id,
        typeof data.rating === "number" ? data.rating : averageRating,
        typeof data.reviewCount === "number" ? data.reviewCount : reviewCount + 1
      );
    } catch {
      setReviewError(t.reviewError);
    } finally {
      setReviewSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[95] [transform:translateZ(0)]">
      <button
        type="button"
        onClick={() => onClose(currentSelection)}
        className="absolute inset-0 bg-black/72 backdrop-blur-sm"
      />

      <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-5 lg:p-6">
        <div className="relative z-10 flex max-h-[96dvh] w-full max-w-[min(100vw-0.75rem,86rem)] flex-col overflow-hidden rounded-[1.6rem] border border-slate-800 bg-[#02030a] shadow-[0_32px_120px_rgba(0,0,0,0.55)] sm:rounded-[2rem] lg:h-[min(90dvh,48rem)] [transform:translateZ(0)]">
          <div className="flex items-center justify-between border-b border-slate-800 bg-[#030611]/85 px-4 py-3 sm:px-5" style={{ WebkitBackdropFilter: "blur(24px)", backdropFilter: "blur(24px)" }}>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-white sm:text-lg">{product.name}</h2>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{product.category}</p>
            </div>
            <button
              type="button"
              onClick={() => onClose(currentSelection)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-[#0a1020] text-sm font-semibold text-slate-300 transition hover:border-cyan-500 hover:text-white"
              aria-label={t.close}
            >
              X
            </button>
          </div>

          <div className="scrollbar-hidden overflow-y-auto px-3 py-3 sm:px-5 sm:py-5 lg:flex-1 lg:overflow-hidden lg:px-5 lg:py-5">
            <div className="grid items-start gap-3 xl:gap-4 lg:h-full lg:grid-cols-[minmax(15rem,0.32fr)_minmax(0,1.24fr)_minmax(14.75rem,0.58fr)] lg:items-stretch">
              <aside className="order-3 space-y-3 lg:order-1 lg:h-full">
                <div className="flex min-h-[20rem] flex-col rounded-[1.5rem] border border-slate-800 bg-[#050816] p-3.5 sm:h-[18rem] lg:h-full lg:min-h-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-200">
                    {t.recommendedTitle}
                  </p>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                    {t.recommendedSubtitle}
                  </p>
                  <div className="mt-3">
                    <input
                      type="search"
                      value={relatedSearchQuery}
                      onChange={(event) => onRelatedSearchQueryChange(event.target.value)}
                      placeholder={t.recommendedSearchPlaceholder}
                      className="h-9 w-full rounded-full border border-slate-700 bg-[#0a1020] px-3 text-[11px] font-semibold text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-500"
                    />
                  </div>
                  <div className="mt-3 flex min-h-0 flex-1 flex-col">
                    <div className="scrollbar-hidden min-h-0 flex-1 space-y-2.5 overflow-y-visible lg:overflow-y-auto lg:pr-1">
                      {visibleRelatedProducts.length > 0 ? (
                        visibleRelatedProducts.map((entry) => (
                          <button
                            key={`${entry.kind}-${String(entry.product.id)}`}
                            type="button"
                            onClick={() => onOpenRelated?.(entry.product)}
                            className="flex w-full items-start gap-2.5 rounded-[1rem] border border-slate-800 bg-[#0a1020] p-2 text-left transition hover:border-cyan-500/45 hover:bg-[#0d152b]"
                          >
                            <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-[0.85rem] border border-slate-800 bg-[#02040c]">
                              <QuickViewImage
                                src={entry.product.image}
                                alt={entry.product.name}
                                sizes="96px"
                                className="product-media product-media--cover h-full w-full"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${
                                  entry.kind === "recommended"
                                    ? "border border-cyan-500/30 bg-cyan-500/12 text-cyan-200"
                                    : "border border-slate-700 bg-slate-800/70 text-slate-300"
                                }`}
                              >
                                {entry.kind === "recommended"
                                  ? t.recommendedBadge
                                  : t.similarBadge}
                              </span>
                              <p className="mt-1.5 line-clamp-1 text-[13px] font-bold leading-5 text-white">
                                {entry.product.name}
                              </p>
                              <p className="mt-1 line-clamp-1 text-[11px] font-medium leading-4 text-slate-300">
                                {entry.product.shortDescription}
                              </p>
                              <p className="mt-1.5 text-[11px] font-bold text-cyan-200">
                                {formatCurrency(entry.product.price)}
                              </p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-[1.15rem] border border-dashed border-slate-700 bg-[#0a1020] px-3 py-4 text-xs leading-5 text-slate-400">
                          {normalizedRelatedSearchQuery ? t.recommendedSearchEmpty : t.recommendedEmpty}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 min-h-[2.85rem] border-t border-slate-800/85 pt-3">
                      {!normalizedRelatedSearchQuery && relatedProducts.length > relatedVisibleLimit ? (
                        <button
                          type="button"
                          onClick={onRefreshRelated}
                          className="inline-flex w-full items-center justify-center rounded-full border border-cyan-500/35 bg-cyan-500/12 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:border-cyan-400 hover:bg-cyan-500 hover:text-slate-950"
                        >
                          {t.seeMore}
                        </button>
                      ) : (
                        <div aria-hidden="true" />
                      )}
                    </div>
                  </div>
                </div>
              </aside>
              <div className="order-1 space-y-3 lg:order-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
                <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-800 bg-[#050816] p-2 sm:p-3 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
                  <button type="button" onClick={() => setLightboxOpen(true)} className="block w-full lg:flex-1">
                    <div className="flex min-h-[14rem] w-full items-center justify-center sm:min-h-[18rem] lg:h-full">
                      <div className="relative aspect-[11/9] w-full max-w-[46rem]">
                      <QuickViewImage
                        src={activeImage}
                        alt={product.name}
                        priority
                        sizes="(max-width: 1024px) 100vw, 60vw"
                        className="product-media product-media--contain h-full w-full"
                      />
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="absolute bottom-3 right-3 hidden rounded-full border border-slate-700 bg-black/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur sm:inline-flex"
                  >
                    {t.fullscreen}
                  </button>
                  {gallery.length > 1 ? (
                    <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                      {gallery.map((image) => (
                        <button
                          key={image}
                          type="button"
                          onClick={() => setSelectedImage(image)}
                          className={`w-[3.4rem] overflow-hidden rounded-[0.8rem] border ${selectedImage === image ? "border-cyan-500" : "border-slate-800"} bg-[#0a1020] sm:w-[3.75rem]`}
                        >
                          <div className="relative aspect-square w-full">
                            <QuickViewImage
                              src={image}
                              alt={product.name}
                              sizes="60px"
                              className="product-media product-media--cover h-full w-full"
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="order-2 space-y-3 lg:order-3 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
                <div className="rounded-[1.5rem] border border-slate-800 bg-[#050816] p-3.5 lg:flex lg:min-h-0 lg:flex-[1.35] lg:flex-col">
                  <h3 className="text-lg font-semibold text-white xl:text-xl">{product.name}</h3>
                  {selectedModel.details ? (
                    <div className="mt-2 lg:flex-1 lg:min-h-0">
                      <p className="scrollbar-hidden h-full overflow-y-auto pr-1 text-[13px] leading-5 text-slate-300 whitespace-pre-line">
                        {selectedModel.details}
                      </p>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setReviewComposerOpen(true)}
                    className="mt-2 flex items-center gap-2 text-left transition hover:text-cyan-200"
                  >
                    <span className="text-xs tracking-[0.15em] text-amber-300">{createStars(averageRating)}</span>
                    <span className="text-[11px] text-slate-500">
                      {reviewCount} {t.reviews}
                    </span>
                  </button>
                  <p className="mt-2.5 text-xl font-semibold text-white xl:text-2xl">{formatCurrency(selectedModel.price)}</p>
                  {product.originalPrice ? (
                    <p className="mt-1 text-sm text-slate-500 line-through">{formatCurrency(product.originalPrice)}</p>
                  ) : null}
                  {deliveryEstimateText ? (
                    <DeliveryEstimateBadge
                      text={deliveryEstimateText}
                      variant="panel"
                      className="mt-3 max-w-full"
                    />
                  ) : null}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {product.hasFreeDelivery ? (
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                        {product.deliveryLabel}
                      </span>
                    ) : null}
                    <div className="product-action-shell">
                      <button
                        type="button"
                        onClick={() =>
                        onAdd(product, currentSelection)
                        }
                        className="product-action-button"
                      >
                        {t.addToCart}
                      </button>
                    </div>
                  </div>
                  {reviewNotice ? (
                    <p className="mt-2 text-xs font-medium text-emerald-300">{reviewNotice}</p>
                  ) : null}
                </div>

                <div className="rounded-[1.5rem] border border-slate-800 bg-[#050816] p-2.5 lg:mt-auto lg:flex-none">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t.modelLabel}</p>
                    <p className="text-xs text-slate-500">{modelOptions.length}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {modelOptions.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          setSelectedModelId(model.id);
                          setSelectedImage(model.imageUrl || product.image);
                        }}
                        className={`inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1.5 text-left transition ${
                          selectedModelId === model.id
                            ? "border-cyan-500 bg-cyan-500/10"
                            : "border-slate-800 bg-[#0a1020] hover:border-cyan-500/40"
                        }`}
                      >
                        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                          {model.name}
                        </span>
                        <span className="text-[10px] font-semibold text-cyan-300">
                          {formatCurrency(model.price)}
                        </span>
                      </button>
                    ))}
                  </div>
                  {availableColors.length > 0 ? (
                    <div className="mt-2.5 border-t border-slate-800/85 pt-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t.colorLabel}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {availableColors.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setSelectedColor(color)}
                            className={`rounded-full border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${selectedColor === color ? "border-cyan-400 bg-cyan-500 text-slate-950" : "border-slate-700 bg-[#0a1020] text-slate-300 hover:border-cyan-500"}`}
                          >
                            {color}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {reviewComposerOpen ? (
        <div className="absolute inset-0 z-[105] flex items-center justify-center bg-black/72 p-4">
          <button
            type="button"
            onClick={() => setReviewComposerOpen(false)}
            className="absolute inset-0"
            aria-label={t.close}
          />
          <div className="relative z-10 w-full max-w-xl rounded-[1.75rem] border border-slate-800 bg-[#050816] p-4 shadow-[0_30px_120px_rgba(0,0,0,0.5)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
                  {t.reviewAction}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">{t.reviewTitle}</h3>
                <p className="mt-1 text-sm text-slate-400">{t.reviewSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setReviewComposerOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-[#0a1020] text-sm font-semibold text-slate-300 transition hover:border-cyan-500 hover:text-white"
                aria-label={t.close}
              >
                X
              </button>
            </div>

            <form onSubmit={submitReview} className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReviewRating(value)}
                    className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                      reviewRating === value
                        ? "border-amber-300 bg-amber-400/15 text-amber-200"
                        : "border-slate-700 bg-[#0a1020] text-slate-300 hover:border-cyan-500"
                    }`}
                  >
                    {"★".repeat(value)}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={reviewName}
                  onChange={(event) => setReviewName(event.target.value)}
                  placeholder={t.reviewName}
                  className="w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                />
                <input
                  type="email"
                  value={reviewEmail}
                  onChange={(event) => setReviewEmail(event.target.value)}
                  placeholder={t.reviewEmail}
                  className="w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                />
              </div>

              <textarea
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder={t.reviewComment}
                rows={3}
                className="w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
              />

              {reviewError ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {reviewError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={reviewSubmitting}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-300"
              >
                {reviewSubmitting ? t.reviewSending : t.reviewSend}
              </button>
            </form>

            <div className="mt-5 rounded-[1.35rem] border border-slate-800 bg-[#0a1020] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {t.reviewRecent}
              </p>
              <div className="scrollbar-hidden mt-3 max-h-44 space-y-3 overflow-y-auto pr-1">
                {reviewsLoading ? (
                  <p className="text-sm text-slate-500">...</p>
                ) : recentReviews.length === 0 ? (
                  <p className="text-sm text-slate-500">{t.reviewEmpty}</p>
                ) : (
                  recentReviews.map((review) => (
                    <article
                      key={review.id}
                      className="rounded-[1rem] border border-slate-800 bg-[#050816] px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{review.customerName}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-amber-300">
                            {createStars(review.rating)}
                          </p>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {review.comment ? (
                        <p className="mt-2 text-sm leading-6 text-slate-300">{review.comment}</p>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {lightboxOpen ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/92 px-4">
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-black/50 text-sm font-semibold text-white"
            aria-label={t.close}
          >
            X
          </button>

          {gallery.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => moveLightbox(-1)}
                className="absolute left-4 rounded-full border border-slate-700 bg-black/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => moveLightbox(1)}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-slate-700 bg-black/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white"
              >
                ›
              </button>
            </>
          ) : null}

          <div className="relative h-[88vh] w-[92vw] max-w-[92vw]">
            <QuickViewImage
              src={activeImage}
              alt={product.name}
              priority
              sizes="92vw"
              className="product-media product-media--contain h-full w-full rounded-[2rem] shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
