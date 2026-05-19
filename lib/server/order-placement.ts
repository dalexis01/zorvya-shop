import "server-only";

import { getProductById } from "@/lib/server/admin/products";
import { resolveDeliveryQuote } from "@/lib/server/delivery-quote";
import { validateOrderPayload } from "@/lib/server/validation";
import { getProductAvailableStock } from "@/lib/shop/product-stock";
import { calculateOrderPayment } from "@/lib/shop/payments";
import type { NormalizedOrderInput } from "@/lib/shop/types";

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export async function prepareOrderPlacement(
  payload: unknown,
  options?: { fallbackEmail?: string }
) {
  const validation = validateOrderPayload(payload, options);

  if (!validation.success) {
    return validation;
  }

  const stockErrors: string[] = [];
  let containsHeavyItems = false;

  for (const item of validation.data.items) {
    const productId = item.productId ? String(item.productId) : "";

    if (!productId) {
      stockErrors.push(`"${item.name}" ya no esta disponible para pago.`);
      continue;
    }

    const liveProduct = await getProductById(productId);

    if (!liveProduct || !liveProduct.isActive || !liveProduct.isVisible) {
      stockErrors.push(`"${item.name}" ya no esta disponible para pago.`);
      continue;
    }

    if (liveProduct.internal?.isHeavy) {
      containsHeavyItems = true;
    }

    const availableStock = getProductAvailableStock(liveProduct);

    if (availableStock <= 0) {
      stockErrors.push(`"${liveProduct.name}" esta agotado por ahora.`);
      continue;
    }

    if (item.quantity > availableStock) {
      stockErrors.push(
        `"${liveProduct.name}" solo tiene ${availableStock} disponible${availableStock === 1 ? "" : "s"} ahora.`
      );
    }
  }

  if (stockErrors.length > 0) {
    return {
      success: false as const,
      errors: {
        products: stockErrors,
      },
    };
  }

  const normalizedOrderData =
    validation.data.deliveryType === "delivery"
      ? await (async () => {
          const deliveryQuote = await resolveDeliveryQuote({
            address: validation.data.customerAddress,
            subtotal: validation.data.subtotal,
            hasHeavy: containsHeavyItems,
          });

          if (!deliveryQuote.isValidSurinameAddress) {
            return {
              success: false as const,
              errors: {
                address: ["Solo se permiten direcciones reales de Suriname."],
              },
            };
          }

          if (!deliveryQuote.allowsDelivery && !deliveryQuote.requiresAgentReview) {
            return {
              success: false as const,
              errors: {
                deliveryType: ["Todavia no tenemos delivery disponible en tu zona."],
              },
            };
          }

          if (deliveryQuote.requiresAgentReview) {
            return {
              success: true as const,
              data: {
                ...validation.data,
                requestedAgentCall: true,
                deliveryDistanceKm: null,
                deliveryFee: 0,
                total: validation.data.subtotal,
              },
            };
          }

          return {
            success: true as const,
            data: {
              ...validation.data,
              deliveryDistanceKm: deliveryQuote.distanceKm,
              deliveryFee: deliveryQuote.fee,
              total: roundCurrency(validation.data.subtotal + deliveryQuote.fee),
            },
          };
        })()
      : {
          success: true as const,
          data: {
            ...validation.data,
            deliveryDistanceKm: null,
            deliveryFee: 0,
            total: validation.data.subtotal,
          },
        };

  if (!normalizedOrderData.success) {
    return normalizedOrderData;
  }

  const baseTotalSrd = roundCurrency(
    normalizedOrderData.data.subtotal + normalizedOrderData.data.deliveryFee
  );
  const payment = calculateOrderPayment({
    baseTotalSrd,
    paymentMethod: normalizedOrderData.data.paymentMethod,
    paypalDisplayCurrency: normalizedOrderData.data.paypalDisplayCurrency,
  });

  const data: NormalizedOrderInput = {
    ...normalizedOrderData.data,
    total: payment.grandTotalSrd,
    paymentMethod: payment.method,
    paypalDisplayCurrency: payment.paypalDisplayCurrency,
    paymentFeeRate: payment.feeRate,
    paymentFeeAmountSrd: payment.feeAmountSrd,
    paymentGrandTotalSrd: payment.grandTotalSrd,
    paymentPayableUsd: payment.payableUsd,
    exchangeRateSrdPerUsd: payment.exchangeRateSrdPerUsd,
  };

  return {
    success: true as const,
    data,
  };
}
