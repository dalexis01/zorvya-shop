"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";

type PayPalButtonsRenderer = {
  render: (selector: HTMLElement) => Promise<void> | void;
  close?: () => Promise<void> | void;
};

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: {
        style?: Record<string, unknown>;
        createOrder: () => Promise<string> | string;
        onApprove: (data: { orderID: string }) => Promise<void> | void;
        onCancel?: () => void;
        onError?: (error: unknown) => void;
      }) => PayPalButtonsRenderer;
    };
  }
}

type PayPalCheckoutButtonProps = {
  clientId: string | null;
  onCreateOrder: () => Promise<string>;
  onApproveOrder: (paypalOrderId: string) => Promise<boolean>;
  onError: (message: string) => void;
};

export default function PayPalCheckoutButton({
  clientId,
  onCreateOrder,
  onApproveOrder,
  onError,
}: PayPalCheckoutButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<PayPalButtonsRenderer | null>(null);
  const onCreateOrderRef = useRef(onCreateOrder);
  const onApproveOrderRef = useRef(onApproveOrder);
  const onErrorRef = useRef(onError);
  const [scriptReady, setScriptReady] = useState(
    () => typeof window !== "undefined" && Boolean(window.paypal)
  );
  const [processing, setProcessing] = useState(false);

  const scriptSrc = useMemo(() => {
    if (!clientId) {
      return null;
    }

    return `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=authorize&components=buttons`;
  }, [clientId]);

  useEffect(() => {
    onCreateOrderRef.current = onCreateOrder;
  }, [onCreateOrder]);

  useEffect(() => {
    onApproveOrderRef.current = onApproveOrder;
  }, [onApproveOrder]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!scriptReady || !scriptSrc || !window.paypal || !containerRef.current || processing) {
      return;
    }

    const container = containerRef.current;
    container.innerHTML = "";
    const buttons = window.paypal.Buttons({
      style: {
        layout: "vertical",
        color: "blue",
        shape: "pill",
        label: "paypal",
      },
      createOrder: async () => {
        try {
          return await onCreateOrderRef.current();
        } catch (error) {
          setProcessing(false);
          onErrorRef.current(
            error instanceof Error ? error.message : "No se pudo iniciar el pago PayPal."
          );
          throw error;
        }
      },
      onApprove: async (data) => {
        setProcessing(true);

        try {
          const success = await onApproveOrderRef.current(data.orderID);

          if (!success) {
            setProcessing(false);
          }
        } catch (error) {
          setProcessing(false);
          onErrorRef.current(
            error instanceof Error ? error.message : "No se pudo confirmar el pago PayPal."
          );
        }
      },
      onCancel: () => {
        setProcessing(false);
      },
      onError: (error) => {
        setProcessing(false);
        onErrorRef.current(error instanceof Error ? error.message : "PayPal devolvio un error.");
      },
    });

    instanceRef.current = buttons;
    void buttons.render(container);

    return () => {
      void instanceRef.current?.close?.();
      instanceRef.current = null;
      container.innerHTML = "";
    };
  }, [processing, scriptReady, scriptSrc]);

  if (!clientId) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        PayPal todavia no esta configurado en el servidor.
      </div>
    );
  }

  return (
    <>
      <Script
        key={scriptSrc}
        src={scriptSrc ?? ""}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => onError("No se pudo cargar PayPal en esta pagina.")}
      />
      {processing ? (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          Confirmando la autorizacion PayPal...
        </div>
      ) : null}
      <div ref={containerRef} className={processing ? "pointer-events-none opacity-60" : ""} />
    </>
  );
}
