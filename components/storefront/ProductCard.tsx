"use client";

import Image from "next/image";
import { memo, useState } from "react";

import DeliveryEstimateBadge from "@/components/storefront/DeliveryEstimateBadge";
import { createStars } from "@/lib/shop/display-utils";
import { formatCurrencySrd as formatCurrency, formatCurrencyUsd } from "@/lib/shop/number-format";
import { SRD_PER_USD } from "@/lib/shop/payments";
import type { Locale, StorefrontProduct } from "@/lib/shop/types";

import styles from "./ProductCard.module.css";

const texts = {
  es: {
    addToCart: "Agregar al carro",
    chooseOptions: "Elegir modelo",
    localWarehouse: "Almacen Local",
  },
  nl: {
    addToCart: "Toevoegen",
    chooseOptions: "Model kiezen",
    localWarehouse: "Lokaal Magazijn",
  },
  en: {
    addToCart: "Add to cart",
    chooseOptions: "Choose model",
    localWarehouse: "Local Warehouse",
  },
  pt: {
    addToCart: "Adicionar ao carrinho",
    chooseOptions: "Escolher modelo",
    localWarehouse: "Armazem Local",
  },
} as const;

function shouldUseDirectStorefrontImage(src: string) {
  return src.startsWith("data:") || src.startsWith("/api/products/");
}

function ProductCardImage({ src, alt }: { src: string; alt: string }) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className={styles.imageFallback} aria-label={alt} role="img">
        <div className={styles.imageFallbackGlow} />
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={styles.imageFallbackIcon}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="m7.5 15.5 3-3 2.5 2.5 2.5-3 1.5 2" />
          <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
        </svg>
        <span className={styles.imageFallbackText}>ZorvyA Shop</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      quality={95}
      unoptimized={shouldUseDirectStorefrontImage(src)}
      sizes="(max-width: 640px) 50vw, (max-width: 900px) 33vw, (max-width: 1280px) 25vw, (max-width: 1680px) 20vw, 16vw"
      className="product-media product-media--cover transition duration-500 group-hover:scale-105"
      onError={() => setHasError(true)}
    />
  );
}

function CartActionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[1.7rem] w-[1.7rem] fill-none stroke-current stroke-[1.5] sm:h-[1.85rem] sm:w-[1.85rem]"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.5 9.5h11l-1.08 8.55A1.5 1.5 0 0 1 14.93 19.5H9.07A1.5 1.5 0 0 1 7.58 18.05Z" />
      <path d="M9.5 9.5V7.5a2.5 2.5 0 0 1 5 0v2" />
      <path d="M12 12.8v2.9M10.55 14.25h2.9" />
    </svg>
  );
}

function ModelActionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[0.95rem] w-[0.95rem] fill-none stroke-current stroke-[1.8] sm:h-[1.05rem] sm:w-[1.05rem]"
    >
      <path d="M4 7h10" />
      <path d="M4 17h16" />
      <path d="M14 7a2 2 0 1 0 4 0a2 2 0 0 0-4 0Z" />
      <path d="M8 17a2 2 0 1 0 4 0a2 2 0 0 0-4 0Z" />
    </svg>
  );
}

function ProductCard({
  locale,
  product,
  deliveryEstimateText,
  onAdd,
  onOpen,
}: {
  locale: Locale;
  product: StorefrontProduct;
  referenceNow?: number;
  deliveryEstimateText?: string;
  onAdd: (product: StorefrontProduct) => void;
  onOpen?: (product: StorefrontProduct) => void;
}) {
  const t = texts[locale];
  const requiresSelection = product.variants.length > 0 || product.colors.length > 0;
  const useOverlay = Boolean(onOpen);
  const priceInUsd = formatCurrencyUsd(product.price / SRD_PER_USD);
  const productHref = `/products/${product.id}`;
  const reviewStars = product.reviewCount > 0 ? createStars(product.rating || 0) : "☆☆☆☆☆";

  const openProduct = () => {
    onOpen?.(product);
  };

  return (
    <article
      className={`${styles.card} group flex h-full min-h-[12.55rem] flex-col overflow-hidden rounded-[1rem] border border-slate-600/80 shadow-[0_12px_30px_rgba(2,6,23,0.38)] transition hover:-translate-y-1 hover:border-cyan-300/70 sm:min-h-[15.25rem] sm:rounded-[1.2rem] sm:shadow-[0_16px_40px_rgba(2,6,23,0.45)]`}
    >
      <div aria-hidden="true" className={styles.cardBackdrop} />
      <div aria-hidden="true" className={styles.cardOverlay} />

      <div className={`${styles.cardContent} flex h-full flex-col`}>
        {useOverlay ? (
          <button
            type="button"
            onClick={openProduct}
            className="block h-[62%] min-h-0 w-full shrink-0 text-left sm:h-[60%]"
          >
            <div className={`relative h-full overflow-hidden border-b border-slate-800 ${styles.mediaShell}`}>
              <div className="absolute left-2 top-2 z-[2] sm:hidden">
                <DeliveryEstimateBadge
                  text={deliveryEstimateText || t.localWarehouse}
                  className="max-w-[calc(100vw-9rem)]"
                />
              </div>
              <ProductCardImage src={product.image} alt={product.name} />
            </div>
          </button>
        ) : (
          <a
            href={productHref}
            className="block h-[62%] min-h-0 w-full shrink-0 sm:h-[60%]"
          >
            <div className={`relative h-full overflow-hidden border-b border-slate-800 ${styles.mediaShell}`}>
              <div className="absolute left-2 top-2 z-[2] sm:hidden">
                <DeliveryEstimateBadge
                  text={deliveryEstimateText || t.localWarehouse}
                  className="max-w-[calc(100vw-9rem)]"
                />
              </div>
              <ProductCardImage src={product.image} alt={product.name} />
            </div>
          </a>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-0 p-1.5 pt-0.5 sm:gap-1 sm:p-[0.55rem] sm:pt-1">
          <div className="flex min-h-0 flex-1 items-end justify-between gap-1.5 sm:gap-2">
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 hidden sm:block">
                <DeliveryEstimateBadge
                  text={deliveryEstimateText || t.localWarehouse}
                  className="max-w-full"
                />
              </div>

              <div className="space-y-0">
                {useOverlay ? (
                  <button type="button" onClick={openProduct} className="block w-full text-left">
                    <h3
                      className={`${styles.title} line-clamp-2 text-[11.5px] leading-[1.14] transition hover:text-cyan-100 sm:text-[13.5px]`}
                    >
                      {product.name}
                    </h3>
                  </button>
                ) : (
                  <a href={productHref} className="block">
                    <h3
                      className={`${styles.title} line-clamp-2 text-[11.5px] leading-[1.14] transition hover:text-cyan-100 sm:text-[13.5px]`}
                    >
                      {product.name}
                    </h3>
                  </a>
                )}

                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="block max-w-full overflow-hidden text-[12px] leading-none tracking-[0.04em] text-amber-400 sm:text-[13px]">
                    {reviewStars}
                  </span>
                  {product.reviewCount > 0 ? (
                    <span className="shrink-0 text-[9px] leading-none text-slate-400 sm:text-[10px]">
                      ({product.reviewCount})
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-0">
                <div className={styles.priceScene}>
                  <div className={`${styles.priceCube} ${styles.priceCubeMobile}`}>
                    <span className={`${styles.price} ${styles.priceSideTop} text-[14px] leading-none sm:text-[17px]`}>
                      {formatCurrency(product.price)}
                    </span>
                    <span className={`${styles.price} ${styles.priceSideFront} text-[11px] leading-none sm:text-[14px]`}>
                      {priceInUsd}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {requiresSelection ? (
              useOverlay ? (
                <div className="shrink-0 self-end">
                  <button
                    type="button"
                    onClick={openProduct}
                    aria-label={t.chooseOptions}
                    title={t.chooseOptions}
                    className={styles.iconActionButton}
                  >
                    <ModelActionIcon />
                  </button>
                </div>
              ) : (
                <div className="shrink-0 self-end">
                  <a
                    href={productHref}
                    aria-label={t.chooseOptions}
                    title={t.chooseOptions}
                    className={styles.iconActionButton}
                  >
                    <ModelActionIcon />
                  </a>
                </div>
              )
            ) : (
              <div className="shrink-0 self-end">
                <button
                  type="button"
                  onClick={() => onAdd(product)}
                  aria-label={t.addToCart}
                  title={t.addToCart}
                  className={styles.iconActionButton}
                >
                  <CartActionIcon />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default memo(ProductCard);
