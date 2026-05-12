"use client";

import Image from "next/image";
import Link from "next/link";
import { memo } from "react";

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
  return (
    <Image
      src={src}
      alt={alt}
      fill
      quality={95}
      unoptimized={shouldUseDirectStorefrontImage(src)}
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 25vw, 20vw"
      className="product-media product-media--cover transition duration-500 group-hover:scale-105"
    />
  );
}

function CartActionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[1.85rem] w-[1.85rem] fill-none stroke-current stroke-[1.5]"
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
      className="h-[1.05rem] w-[1.05rem] fill-none stroke-current stroke-[1.8]"
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
  const reviewStars = product.reviewCount > 0 ? createStars(product.rating || 0) : "☆☆☆☆☆";

  const openProduct = () => {
    onOpen?.(product);
  };

  return (
    <article
      className={`${styles.card} group flex aspect-square h-full min-h-0 flex-col overflow-hidden rounded-[1.15rem] border border-slate-600/80 shadow-[0_16px_38px_rgba(2,6,23,0.42)] transition hover:-translate-y-1 hover:border-cyan-300/70 sm:rounded-[1.45rem] sm:shadow-[0_20px_54px_rgba(2,6,23,0.5)]`}
    >
      <div aria-hidden="true" className={styles.cardBackdrop} />
      <div aria-hidden="true" className={styles.cardOverlay} />

      <div className={`${styles.cardContent} flex h-full flex-col`}>
        {useOverlay ? (
          <button
            type="button"
            onClick={openProduct}
            className="block h-[58%] min-h-0 w-full shrink-0 text-left sm:h-[56%]"
          >
            <div
              className={`relative h-full overflow-hidden border-b border-slate-800 ${styles.mediaShell}`}
            >
              {product.image ? <ProductCardImage src={product.image} alt={product.name} /> : null}
            </div>
          </button>
        ) : (
          <Link
            href={`/products/${product.id}`}
            prefetch
            className="block h-[58%] min-h-0 w-full shrink-0 sm:h-[56%]"
          >
            <div
              className={`relative h-full overflow-hidden border-b border-slate-800 ${styles.mediaShell}`}
            >
              {product.image ? <ProductCardImage src={product.image} alt={product.name} /> : null}
            </div>
          </Link>
        )}

        <div className="flex min-h-0 flex-1 flex-col justify-end gap-1.5 p-2.5 pt-2 sm:gap-2.5 sm:p-3.5 sm:pt-2.5">
          <div className="min-h-0">
            {useOverlay ? (
              <button type="button" onClick={openProduct} className="block text-left">
                <h3
                  className={`${styles.title} line-clamp-2 text-[13px] leading-[1.28] transition hover:text-cyan-100 sm:text-[15px]`}
                >
                  {product.name}
                </h3>
              </button>
            ) : (
              <Link href={`/products/${product.id}`} prefetch className="block">
                <h3
                  className={`${styles.title} line-clamp-2 text-[13px] leading-[1.28] transition hover:text-cyan-100 sm:text-[15px]`}
                >
                  {product.name}
                </h3>
              </Link>
            )}
          </div>

          <div className="mt-auto flex items-end justify-between gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center justify-between gap-2 sm:mb-2">
                <DeliveryEstimateBadge
                  text={deliveryEstimateText || t.localWarehouse}
                  className="max-w-[72%] sm:max-w-[68%]"
                />
                <div className="flex shrink-0 items-center justify-end gap-1.5">
                  <span className="text-[17px] leading-none tracking-tight text-amber-400 sm:text-[16px]">
                    {reviewStars}
                  </span>
                  {product.reviewCount > 0 ? (
                    <span className="text-[10px] leading-none text-slate-400 sm:text-[11px]">
                      ({product.reviewCount})
                    </span>
                  ) : null}
                </div>
              </div>

              <div className={styles.priceScene}>
                <div className={styles.priceCube}>
                  <span className={`${styles.price} ${styles.priceSideTop} text-[18px] leading-none sm:text-[20px]`}>
                    {formatCurrency(product.price)}
                  </span>
                  <span
                    className={`${styles.price} ${styles.priceSideFront} text-[15px] leading-none sm:text-[17px]`}
                  >
                    {priceInUsd}
                  </span>
                </div>
              </div>
            </div>

            {requiresSelection ? (
              useOverlay ? (
                <div className="shrink-0">
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
                <div className="shrink-0">
                  <Link
                    href={`/products/${product.id}`}
                    prefetch
                    aria-label={t.chooseOptions}
                    title={t.chooseOptions}
                    className={styles.iconActionButton}
                  >
                    <ModelActionIcon />
                  </Link>
                </div>
              )
            ) : (
              <div className="shrink-0">
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
