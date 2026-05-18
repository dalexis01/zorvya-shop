/* eslint-disable @next/next/no-img-element */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ACCEPTED_IMAGE_TYPES, imageFileToDataUrl } from "@/lib/shop/image-upload";
import type { Product } from "@/lib/shop/admin-types";
import { formatCurrencyDollar as formatCurrency } from "@/lib/shop/number-format";

interface ProductEditorFormProps {
  mode: "create" | "edit";
  productId?: string;
}

interface ProductImageDraft {
  id: string;
  url: string;
}

interface ProductVariantDraft {
  id: string;
  name: string;
  price: string;
  color: string;
  details: string;
  imageUrl: string;
  costPrice: string;
  supplier: string;
  internalNotes: string;
}

interface ProductFormState {
  publicId: string;
  name: string;
  sku: string;
  tags: string;
  category: string;
  price: string;
  originalPrice: string;
  description: string;
  isVisible: boolean;
  isInStock: boolean;
  isFeatured: boolean;
  isActive: boolean;
  images: ProductImageDraft[];
  costPrice: string;
  supplier: string;
  supplierPhone: string;
  internalNotes: string;
  accountingImageUrl: string;
  publishedAt: string;
  stockAddedAt: string;
  lastSoldAt: string;
  colors: string[];
  variants: ProductVariantDraft[];
}

interface ImageEditorState {
  index: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
}

const IMAGE_EDITOR_SIZE = 520;

function createId() {
  return crypto.randomUUID();
}

function createVariantDraft(): ProductVariantDraft {
  return {
    id: createId(),
    name: "",
    price: "",
    color: "",
    details: "",
    imageUrl: "",
    costPrice: "",
    supplier: "",
    internalNotes: "",
  };
}

function createEmptyFormState(): ProductFormState {
  return {
    publicId: "",
    name: "",
    sku: "",
    tags: "",
    category: "",
    price: "",
    originalPrice: "",
    description: "",
    isVisible: true,
    isInStock: true,
    isFeatured: false,
    isActive: true,
    images: [],
    costPrice: "",
    supplier: "",
    supplierPhone: "",
    internalNotes: "",
    accountingImageUrl: "",
    publishedAt: "",
    stockAddedAt: "",
    lastSoldAt: "",
    colors: [],
    variants: [],
  };
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function trimText(value: string) {
  return value.trim();
}

function toShortDescription(value: string) {
  const normalized = trimText(value);

  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 177).trimEnd()}...`;
}

function formatDateTime(value: string) {
  if (!value) {
    return "Sin registro";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Sin registro";
  }

  return parsed.toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function splitTags(value: string) {
  return value
    .split(/[,\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function joinTags(tags: string[]) {
  return tags.join(", ");
}

function parseStoredList(value: string | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("No se pudo convertir la imagen."));
    };

    reader.onerror = () => reject(new Error("No se pudo convertir la imagen."));
    reader.readAsDataURL(blob);
  });
}

async function persistImageUrl(imageUrl: string) {
  if (!imageUrl || imageUrl.startsWith("data:")) {
    return imageUrl;
  }

  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      return imageUrl;
    }

    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return imageUrl;
  }
}

function loadHtmlImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo cargar la imagen."));
    image.src = src;
  });
}

async function cropImageUrl(imageUrl: string, zoom: number, offsetX: number, offsetY: number) {
  const safeUrl = await persistImageUrl(imageUrl);
  const image = await loadHtmlImage(safeUrl);
  const canvas = document.createElement("canvas");

  canvas.width = IMAGE_EDITOR_SIZE;
  canvas.height = IMAGE_EDITOR_SIZE;

  const context = canvas.getContext("2d");

  if (!context) {
    return safeUrl;
  }

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const coverScale = Math.max(IMAGE_EDITOR_SIZE / sourceWidth, IMAGE_EDITOR_SIZE / sourceHeight);
  const finalScale = coverScale * zoom;
  const drawWidth = sourceWidth * finalScale;
  const drawHeight = sourceHeight * finalScale;
  const maxOffsetX = Math.max(0, (drawWidth - IMAGE_EDITOR_SIZE) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - IMAGE_EDITOR_SIZE) / 2);
  const safeOffsetX = maxOffsetX * offsetX;
  const safeOffsetY = maxOffsetY * offsetY;
  const drawX = (IMAGE_EDITOR_SIZE - drawWidth) / 2 - safeOffsetX;
  const drawY = (IMAGE_EDITOR_SIZE - drawHeight) / 2 - safeOffsetY;

  context.clearRect(0, 0, IMAGE_EDITOR_SIZE, IMAGE_EDITOR_SIZE);
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  return canvas.toDataURL("image/jpeg", 0.92);
}

function createFormStateFromProduct(product: Product): ProductFormState {
  const colors = parseStoredList(product.attributes.colors).filter(
    (color): color is string => typeof color === "string" && trimText(color).length > 0
  );
  const variants = parseStoredList(product.attributes.variants).map((variant) => {
    const variantRecord =
      variant && typeof variant === "object" ? (variant as Record<string, unknown>) : {};

    return {
      id:
        typeof variantRecord.id === "string" && variantRecord.id
          ? variantRecord.id
          : createId(),
      name: typeof variantRecord.name === "string" ? variantRecord.name : "",
      price:
        typeof variantRecord.price === "number" || typeof variantRecord.price === "string"
          ? String(variantRecord.price)
          : "",
      color: typeof variantRecord.color === "string" ? variantRecord.color : "",
      details: typeof variantRecord.details === "string" ? variantRecord.details : "",
      imageUrl: typeof variantRecord.imageUrl === "string" ? variantRecord.imageUrl : "",
      costPrice:
        typeof variantRecord.costPrice === "number" || typeof variantRecord.costPrice === "string"
          ? String(variantRecord.costPrice)
          : "",
      supplier: typeof variantRecord.supplier === "string" ? variantRecord.supplier : "",
      internalNotes:
        typeof variantRecord.internalNotes === "string" ? variantRecord.internalNotes : "",
    } satisfies ProductVariantDraft;
  });

  return {
    publicId: product.publicId,
    name: product.name,
    sku: product.sku,
    tags: joinTags(product.tags),
    category: product.category,
    price: String(product.price),
    originalPrice: product.originalPrice ? String(product.originalPrice) : "",
    description: product.longDescription || product.shortDescription,
    isVisible: product.isVisible,
    isInStock: product.stock > 0,
    isFeatured: product.isFeatured,
    isActive: product.isActive,
    images: product.images.length
      ? product.images.map((image) => ({
          id: image.id,
          url: image.url,
        }))
      : [],
    costPrice: product.internal.costPrice ? String(product.internal.costPrice) : "",
    supplier: product.internal.supplier,
    supplierPhone: product.internal.supplierPhone ?? "",
    internalNotes: product.internal.internalNotes,
    accountingImageUrl: product.internal.accountingImageUrl,
    publishedAt: product.publishedAt ?? "",
    stockAddedAt: product.stockAddedAt ?? "",
    lastSoldAt: product.lastSoldAt ?? "",
    colors,
    variants,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar el producto";
}

function ImageActionTextButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group inline-flex items-center gap-1 bg-transparent text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="relative pb-1 text-[10px] font-medium uppercase tracking-[0.14em] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:origin-bottom-right after:scale-x-0 after:bg-white after:transition-transform after:duration-200 after:content-[''] group-hover:after:origin-bottom-left group-hover:after:scale-x-100">
        {children}
      </span>
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 -translate-x-1 transition-transform duration-300 group-hover:translate-x-0 group-active:scale-90"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h12" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    </button>
  );
}

function ImageActionTextLabel({
  children,
  input,
}: {
  children: React.ReactNode;
  input: React.ReactNode;
}) {
  return (
    <label className="group inline-flex cursor-pointer items-center gap-1 bg-transparent text-white">
      <span className="relative pb-1 text-[10px] font-medium uppercase tracking-[0.14em] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:origin-bottom-right after:scale-x-0 after:bg-white after:transition-transform after:duration-200 after:content-[''] group-hover:after:origin-bottom-left group-hover:after:scale-x-100">
        {children}
      </span>
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 -translate-x-1 transition-transform duration-300 group-hover:translate-x-0 group-active:scale-90"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h12" />
        <path d="m13 6 6 6-6 6" />
      </svg>
      {input}
    </label>
  );
}

export default function ProductEditorForm({ mode, productId }: ProductEditorFormProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<ProductFormState>(createEmptyFormState);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState("");
  const [imageUploadError, setImageUploadError] = useState("");
  const [uploadingImageCount, setUploadingImageCount] = useState(0);
  const [imageEditor, setImageEditor] = useState<ImageEditorState | null>(null);
  const [editingImage, setEditingImage] = useState(false);
  const [accountingImagePreviewOpen, setAccountingImagePreviewOpen] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      if (!productId || mode !== "edit") {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/admin/products/${productId}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (!data.success || !data.product) {
          setError(data.error || "No se pudo cargar el producto");
          return;
        }

        setFormState(createFormStateFromProduct(data.product));
      } catch {
        setError("No se pudo cargar el producto");
      } finally {
        setLoading(false);
      }
    }

    void loadProduct();
  }, [mode, productId]);

  function updateField<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setFormState((currentState) => ({
      ...currentState,
      [key]: value,
    }));
  }

  // Uploads a data URL (already resized by imageFileToDataUrl) to Vercel Blob.
  // Returns the Blob URL on success, or the original dataUrl as fallback if storage is not yet set up.
  async function uploadToBlob(dataUrl: string, filename?: string): Promise<string> {
    try {
      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, filename }),
      });
      const data = (await res.json()) as { success?: boolean; url?: string; error?: string };
      if (data.success && data.url) return data.url;
      // Fall back to data URL if Blob is not yet configured (BLOB_READ_WRITE_TOKEN missing)
      if (res.status === 503) return dataUrl;
      setImageUploadError(data.error ?? "Error al subir imagen");
      return dataUrl;
    } catch {
      return dataUrl;
    }
  }

  async function appendImages(files: FileList | File[]) {
    setImageUploadError("");
    setUploadingImageCount(Array.from(files).length);
    try {
      const nextImages = await Promise.all(
        Array.from(files).map(async (file) => {
          const dataUrl = await imageFileToDataUrl(file);
          const url = await uploadToBlob(dataUrl, `${createId()}.${file.type.split("/")[1] ?? "jpg"}`);
          return { id: createId(), url };
        })
      );
      setFormState((currentState) => ({
        ...currentState,
        images: [...currentState.images, ...nextImages],
      }));
    } finally {
      setUploadingImageCount(0);
    }
  }

  async function replaceImage(index: number, file: File) {
    setImageUploadError("");
    setUploadingImageCount(1);
    try {
      const dataUrl = await imageFileToDataUrl(file);
      const url = await uploadToBlob(dataUrl, `${createId()}.${file.type.split("/")[1] ?? "jpg"}`);
      setFormState((currentState) => ({
        ...currentState,
        images: currentState.images.map((image, imageIndex) =>
          imageIndex === index ? { ...image, url } : image
        ),
      }));
    } finally {
      setUploadingImageCount(0);
    }
  }

  async function updateAccountingImage(file: File) {
    setImageUploadError("");
    const dataUrl = await imageFileToDataUrl(file);
    const url = await uploadToBlob(dataUrl, `accounting-${createId()}.${file.type.split("/")[1] ?? "jpg"}`);
    updateField("accountingImageUrl", url);
  }

  function removeAccountingImage() {
    updateField("accountingImageUrl", "");
  }

  function removeImage(index: number) {
    setFormState((currentState) => ({
      ...currentState,
      images: currentState.images.filter((_, imageIndex) => imageIndex !== index),
    }));

    setImageEditor((currentEditor) =>
      currentEditor && currentEditor.index === index ? null : currentEditor
    );
  }

  function moveImage(index: number, direction: -1 | 1) {
    setFormState((currentState) => {
      const nextIndex = index + direction;

      if (nextIndex < 0 || nextIndex >= currentState.images.length) {
        return currentState;
      }

      const nextImages = [...currentState.images];
      const currentImage = nextImages[index];

      nextImages[index] = nextImages[nextIndex];
      nextImages[nextIndex] = currentImage;

      return {
        ...currentState,
        images: nextImages,
      };
    });

    setImageEditor((currentEditor) => {
      if (!currentEditor || currentEditor.index !== index) {
        return currentEditor;
      }

      return {
        ...currentEditor,
        index: index + direction,
      };
    });
  }

  function setPrimaryImage(index: number) {
    setFormState((currentState) => {
      if (index <= 0 || index >= currentState.images.length) {
        return currentState;
      }

      const nextImages = [...currentState.images];
      const [selectedImage] = nextImages.splice(index, 1);

      nextImages.unshift(selectedImage);

      return {
        ...currentState,
        images: nextImages,
      };
    });
  }

  function openImageEditor(index: number) {
    setImageEditor({
      index,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });
  }

  function closeImageEditor() {
    setImageEditor(null);
  }

  async function saveImageEdit() {
    if (!imageEditor) {
      return;
    }

    const targetImage = formState.images[imageEditor.index];

    if (!targetImage?.url) {
      return;
    }

    setEditingImage(true);

    try {
      const croppedImageUrl = await cropImageUrl(
        targetImage.url,
        imageEditor.zoom,
        imageEditor.offsetX,
        imageEditor.offsetY
      );

      setFormState((currentState) => ({
        ...currentState,
        images: currentState.images.map((image, imageIndex) =>
          imageIndex === imageEditor.index
            ? {
                ...image,
                url: croppedImageUrl,
              }
            : image
        ),
      }));
      closeImageEditor();
    } catch (cropError: unknown) {
      setError(getErrorMessage(cropError));
    } finally {
      setEditingImage(false);
    }
  }

  function addColor() {
    setFormState((currentState) => ({
      ...currentState,
      colors: [...currentState.colors, ""],
    }));
  }

  function updateColor(index: number, value: string) {
    setFormState((currentState) => ({
      ...currentState,
      colors: currentState.colors.map((color, colorIndex) => (colorIndex === index ? value : color)),
    }));
  }

  function removeColor(index: number) {
    setFormState((currentState) => ({
      ...currentState,
      colors: currentState.colors.filter((_, colorIndex) => colorIndex !== index),
    }));
  }

  function addVariant() {
    setFormState((currentState) => ({
      ...currentState,
      variants: [...currentState.variants, createVariantDraft()],
    }));
  }

  function updateVariant<K extends keyof ProductVariantDraft>(
    variantId: string,
    key: K,
    value: ProductVariantDraft[K]
  ) {
    setFormState((currentState) => ({
      ...currentState,
      variants: currentState.variants.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              [key]: value,
            }
          : variant
      ),
    }));
  }

  function removeVariant(variantId: string) {
    setFormState((currentState) => ({
      ...currentState,
      variants: currentState.variants.filter((variant) => variant.id !== variantId),
    }));
  }

  async function uploadVariantImage(variantId: string, file: File) {
    setImageUploadError("");
    const dataUrl = await imageFileToDataUrl(file);
    const url = await uploadToBlob(dataUrl, `variant-${createId()}.${file.type.split("/")[1] ?? "jpg"}`);
    updateVariant(variantId, "imageUrl", url);
  }

  function hasDraftableContent() {
    return Boolean(
      trimText(formState.name) ||
        trimText(formState.sku) ||
        trimText(formState.tags) ||
        trimText(formState.category) ||
        trimText(formState.price) ||
        trimText(formState.originalPrice) ||
        trimText(formState.description) ||
        trimText(formState.supplier) ||
        trimText(formState.internalNotes) ||
        trimText(formState.accountingImageUrl) ||
        formState.images.length ||
        formState.colors.some((color) => trimText(color)) ||
        formState.variants.some(
          (variant) =>
            trimText(variant.name) ||
            trimText(variant.price) ||
            trimText(variant.color) ||
            trimText(variant.details) ||
            trimText(variant.imageUrl) ||
            trimText(variant.costPrice) ||
            trimText(variant.supplier) ||
            trimText(variant.internalNotes)
        )
    );
  }

  function buildPayload(asDraft: boolean) {
    const description = trimText(formState.description);
    const costPrice = toNumber(formState.costPrice);
    const stock = asDraft ? 0 : formState.isInStock ? 1 : 0;
    const colors = formState.colors.map((color) => trimText(color)).filter(Boolean);
    const variants = formState.variants
      .map((variant) => ({
        id: variant.id,
        name: trimText(variant.name),
        price: toNumber(variant.price),
        color: trimText(variant.color),
        details: trimText(variant.details),
        imageUrl: trimText(variant.imageUrl),
        costPrice: toNumber(variant.costPrice),
        supplier: trimText(variant.supplier),
        internalNotes: trimText(variant.internalNotes),
      }))
      .filter(
        (variant) =>
          variant.name ||
          variant.imageUrl ||
          variant.price > 0 ||
          variant.color ||
          variant.details ||
          variant.costPrice > 0 ||
          variant.supplier ||
          variant.internalNotes
      );
    const draftName = trimText(formState.name) || "Borrador sin titulo";
    const draftCategory = trimText(formState.category) || "Sin categoria";
    const longDescription = description || draftName;

    return {
      sku: trimText(formState.sku) || undefined,
      name: asDraft ? draftName : trimText(formState.name),
      category: asDraft ? draftCategory : trimText(formState.category),
      tags: splitTags(formState.tags),
      price: toNumber(formState.price),
      originalPrice: formState.originalPrice ? toNumber(formState.originalPrice) : undefined,
      shortDescription: toShortDescription(longDescription),
      longDescription,
      stock,
      showStock: asDraft ? false : formState.isInStock,
      isVisible: asDraft ? false : formState.isVisible,
      isFeatured: asDraft ? false : formState.isFeatured,
      isActive: asDraft ? false : formState.isActive,
      images: formState.images.map((image, index) => ({
        url: trimText(image.url),
        alt:
          index === 0
            ? trimText(formState.name) || "Imagen principal"
            : `${trimText(formState.name) || "Imagen"} ${index + 1}`,
        isPrimary: index === 0,
      })),
      attributes: {
        colors: JSON.stringify(colors),
        variants: JSON.stringify(variants),
      },
      internal: {
        costPrice,
        purchasePrice: costPrice,
        supplier: trimText(formState.supplier),
        supplierPhone: trimText(formState.supplierPhone),
        internalNotes: trimText(formState.internalNotes),
        accountingImageUrl: trimText(formState.accountingImageUrl),
        shippingFee: 0,
      },
    };
  }

  async function handleBack() {
    if (mode !== "create" || !hasDraftableContent()) {
      router.push("/admin/products");
      return;
    }

    setError("");
    setSavingDraft(true);

    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPayload(true)),
      });
      const data = await response.json();

      if (!data.success) {
        setError(data.error || "No se pudo guardar el borrador");
        return;
      }

      router.push("/admin/products");
    } catch (draftError: unknown) {
      setError(getErrorMessage(draftError));
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      if (formState.images.length === 0) {
        setError("Debes subir al menos una imagen.");
        return;
      }

      const payload = buildPayload(false);

      const response = await fetch(
        mode === "edit" ? `/api/admin/products/${productId}` : "/api/admin/products",
        {
          method: mode === "edit" ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();

      if (!data.success) {
        setError(data.error || "No se pudo guardar el producto");
        return;
      }

      router.push("/admin/products");
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  const salePrice = toNumber(formState.price);
  const costPrice = toNumber(formState.costPrice);
  const unitMargin = salePrice - costPrice;
  const activeEditorImage = imageEditor ? formState.images[imageEditor.index] : null;

  const imageEditorPreviewStyle = useMemo(() => {
    if (!imageEditor) {
      return {};
    }

    return {
      transform: `translate(${imageEditor.offsetX * 36}px, ${imageEditor.offsetY * 36}px) scale(${imageEditor.zoom})`,
    };
  }, [imageEditor]);

  if (loading) {
    return <div className="min-h-[40vh] rounded-[1.4rem] border border-slate-800 bg-[#060b16]" />;
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => void handleBack()}
          disabled={saving || savingDraft}
          className="rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {savingDraft ? "Guardando borrador..." : "Volver a productos"}
        </button>
        <button
          type="submit"
          form="product-editor-form"
          disabled={saving}
          className="rounded-2xl bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Crear producto"}
        </button>
      </div>

      <form id="product-editor-form" onSubmit={handleSubmit} className="grid gap-2 xl:grid-cols-4 xl:items-start">
        <div className="space-y-2 xl:col-span-2 xl:grid xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] xl:items-start xl:gap-2 xl:space-y-0">
          <section className="mx-auto w-full max-w-[720px] rounded-[1.2rem] border border-slate-800 bg-[#060b16] p-3 xl:mx-0 xl:max-w-none xl:min-h-[34rem]">

            <div className="mt-2 rounded-[1.15rem] border border-slate-800 bg-[#0a1020] p-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Imagenes del producto</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.25em] text-slate-500">
                    Principal y secundarias
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center rounded-2xl border border-cyan-500/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400">
                  Agregar imagen
                  <input
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES}
                    multiple
                    onChange={(event) => {
                      const files = event.target.files;

                      if (files?.length) {
                        void appendImages(files);
                      }

                      event.target.value = "";
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              {uploadingImageCount > 0 && (
                <p className="mt-3 text-xs font-medium text-cyan-400 animate-pulse">
                  Subiendo {uploadingImageCount} imagen{uploadingImageCount > 1 ? "es" : ""}...
                </p>
              )}
              {imageUploadError && (
                <p className="mt-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {imageUploadError}
                </p>
              )}

              {formState.images.length > 0 ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-2">
                  {formState.images.map((image, index) => (
                    <div
                      key={image.id}
                      className="rounded-[1.1rem] border border-slate-800 bg-[#050816] p-3"
                    >
                      <div className="overflow-hidden rounded-[1rem] border border-slate-800 bg-[#02040c]">
                        <img
                          src={image.url}
                          alt={formState.name || `Imagen ${index + 1}`}
                          className="h-48 w-full object-cover"
                        />
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-2">
                          {index === 0 ? (
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                              Principal
                            </span>
                          ) : null}
                          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-400">
                            Posicion {index + 1}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                        <ImageActionTextLabel
                          input={
                            <input
                              type="file"
                              accept={ACCEPTED_IMAGE_TYPES}
                              onChange={(event) => {
                                const file = event.target.files?.[0];

                                if (file) {
                                  void replaceImage(index, file);
                                }

                                event.target.value = "";
                              }}
                              className="hidden"
                            />
                          }
                        >
                          Editar
                        </ImageActionTextLabel>
                        <ImageActionTextButton onClick={() => openImageEditor(index)}>
                          Ajustar
                        </ImageActionTextButton>
                        {index > 0 ? (
                          <ImageActionTextButton onClick={() => setPrimaryImage(index)}>
                            Hacer principal
                          </ImageActionTextButton>
                        ) : null}
                        <ImageActionTextButton
                          onClick={() => moveImage(index, -1)}
                          disabled={index === 0}
                        >
                          Subir
                        </ImageActionTextButton>
                        <ImageActionTextButton
                          onClick={() => moveImage(index, 1)}
                          disabled={index === formState.images.length - 1}
                        >
                          Bajar
                        </ImageActionTextButton>
                        <ImageActionTextButton onClick={() => removeImage(index)}>
                          Eliminar
                        </ImageActionTextButton>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 flex h-28 items-center justify-center rounded-[1.1rem] border border-dashed border-slate-700 bg-[#050816] px-4 text-center text-sm text-slate-500">
                  Agrega una o varias imagenes para empezar.
                </div>
              )}
            </div>
          </section>

          <div className="space-y-1">
          <section className="mx-auto w-full max-w-[720px] rounded-[1.2rem] border border-slate-800 bg-[#060b16] p-3 xl:mx-0 xl:max-w-none">

            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300">
                  Nombre del articulo
                </label>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Categoria</label>
                <input
                  type="text"
                  value={formState.category}
                  onChange={(event) => updateField("category", event.target.value)}
                  className="mt-1.5 w-full max-w-xs rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Precio actual</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.price}
                  onChange={(event) => updateField("price", event.target.value)}
                  className="mt-1.5 w-full max-w-[12rem] rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300">
                  Descripcion en espanol
                </label>
                <textarea
                  value={formState.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  rows={4}
                  className="mt-1.5 w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300">
                  Etiquetas
                </label>
                <input
                  type="text"
                  value={formState.tags}
                  onChange={(event) => updateField("tags", event.target.value)}
                  className="mt-1.5 w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400"
                  placeholder="Etiqueta 1, etiqueta 2, etiqueta 3"
                />
              </div>
            </div>
          </section>

          <section className="mx-auto w-[90%] rounded-[1.2rem] border border-slate-800 bg-[#060b16] p-2.5 xl:mx-0">

            <div className="space-y-2">
              <div className="rounded-[1.1rem] border border-slate-800 bg-[#0a1020] p-2.5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Colores</p>
                  </div>
                  <button
                    type="button"
                    onClick={addColor}
                    className="rounded-2xl border border-slate-700 bg-[#050816] px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-500"
                  >
                    Agregar color
                  </button>
                </div>

                <div className="mt-2 space-y-1.5">
                  {formState.colors.length > 0 ? (
                    formState.colors.map((color, index) => (
                      <div key={`color-${index}`} className="flex gap-3">
                        <input
                          type="text"
                          value={color}
                          onChange={(event) => updateColor(index, event.target.value)}
                          placeholder="Color"
                          className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
                        />
                        <button
                          type="button"
                          onClick={() => removeColor(index)}
                          className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:border-rose-400"
                        >
                          Quitar
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Aun no hay colores agregados.</p>
                  )}
                </div>
              </div>

              <div className="rounded-[1.1rem] border border-slate-800 bg-[#0a1020] p-2.5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Modelos y variantes</p>
                  </div>
                  <button
                    type="button"
                    onClick={addVariant}
                    className="rounded-2xl border border-slate-700 bg-[#050816] px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-500"
                  >
                    Agregar modelo
                  </button>
                </div>

                <div className="mt-2 space-y-2">
                  {formState.variants.length > 0 ? (
                    formState.variants.map((variant) => (
                      <div
                        key={variant.id}
                        className="rounded-[1rem] border border-slate-800 bg-[#050816] p-2.5"
                      >
                        <div className="grid gap-2 xl:grid-cols-[0.3fr_0.7fr]">
                          <div className="space-y-1.5">
                            <div className="overflow-hidden rounded-[1rem] border border-slate-800 bg-[#02040c]">
                              {variant.imageUrl ? (
                                <img
                                  src={variant.imageUrl}
                                  alt={variant.name || "Variante"}
                                  className="h-20 w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-20 items-center justify-center px-4 text-center text-sm text-slate-500">
                                  Sin imagen de variante
                                </div>
                              )}
                            </div>
                            <label className="inline-flex cursor-pointer items-center rounded-2xl border border-cyan-500/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400">
                              {variant.imageUrl ? "Editar imagen" : "Subir imagen"}
                              <input
                                type="file"
                                accept={ACCEPTED_IMAGE_TYPES}
                                onChange={(event) => {
                                  const file = event.target.files?.[0];

                                  if (file) {
                                    void uploadVariantImage(variant.id, file);
                                  }

                                  event.target.value = "";
                                }}
                                className="hidden"
                              />
                            </label>
                          </div>

                          <div className="space-y-2">
                            <div className="grid gap-2 md:grid-cols-2">
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-300">
                                  Nombre o identificador del modelo
                                </label>
                                <input
                                  type="text"
                                  value={variant.name}
                                  onChange={(event) =>
                                    updateVariant(variant.id, "name", event.target.value)
                                  }
                                  className="mt-1.5 w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-300">
                                  Precio del modelo
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={variant.price}
                                  onChange={(event) =>
                                    updateVariant(variant.id, "price", event.target.value)
                                  }
                                  className="mt-1.5 w-full max-w-[12rem] rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-300">
                                  Color del modelo
                                </label>
                                <input
                                  type="text"
                                  value={variant.color}
                                  onChange={(event) =>
                                    updateVariant(variant.id, "color", event.target.value)
                                  }
                                  className="mt-1.5 w-full max-w-xs rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-300">
                                  Datos propios del modelo
                                </label>
                                <textarea
                                  value={variant.details}
                                  onChange={(event) =>
                                    updateVariant(variant.id, "details", event.target.value)
                                  }
                                  rows={2}
                                  className="mt-1.5 w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
                                />
                              </div>
                            </div>

                            <div className="rounded-[1rem] border border-amber-500/20 bg-[#120c08] p-2.5">
                              <p className="text-xs uppercase tracking-[0.25em] text-amber-200">
                                Informacion privada del modelo
                              </p>

                              <div className="mt-2 grid gap-2 md:grid-cols-2">
                                <div>
                                  <label className="block text-sm font-medium text-slate-200">
                                    Costo real
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={variant.costPrice}
                                    onChange={(event) =>
                                      updateVariant(variant.id, "costPrice", event.target.value)
                                    }
                                    className="mt-1.5 w-full max-w-[11rem] rounded-2xl border border-amber-500/20 bg-[#0a1020] px-4 py-2 text-sm text-white outline-none transition focus:border-amber-400"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-slate-200">
                                    Proveedor
                                  </label>
                                  <input
                                    type="text"
                                    value={variant.supplier}
                                    onChange={(event) =>
                                      updateVariant(variant.id, "supplier", event.target.value)
                                    }
                                    className="mt-1.5 w-full max-w-[11rem] rounded-2xl border border-amber-500/20 bg-[#0a1020] px-4 py-2 text-sm text-white outline-none transition focus:border-amber-400"
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="block text-sm font-medium text-slate-200">
                                    Notas internas
                                  </label>
                                  <textarea
                                    value={variant.internalNotes}
                                    onChange={(event) =>
                                      updateVariant(variant.id, "internalNotes", event.target.value)
                                    }
                                    rows={2}
                                    className="mt-1.5 w-full rounded-2xl border border-amber-500/20 bg-[#0a1020] px-4 py-2 text-sm text-white outline-none transition focus:border-amber-400"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeVariant(variant.id)}
                            className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:border-rose-400"
                          >
                            Quitar modelo
                          </button>
                        </div>
                      </div>
                    ))
                  ) : null}
                </div>
              </div>
            </div>
          </section>
          </div>
        </div>

        <div className="space-y-2 xl:contents">
          <section className="rounded-[1.2rem] border border-amber-500/20 bg-[#0c0b08] p-3 xl:col-start-3 xl:row-start-1">

            <div className="mt-2 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-200">
                  Costo real del producto
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.costPrice}
                  onChange={(event) => updateField("costPrice", event.target.value)}
                  className="mt-1.5 w-full max-w-[10rem] rounded-2xl border border-amber-500/20 bg-[#0a1020] px-4 py-2.5 text-sm text-white outline-none transition focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200">Proveedor / Almacen</label>
                <input
                  type="text"
                  value={formState.supplier}
                  onChange={(event) => updateField("supplier", event.target.value)}
                  placeholder="Nombre del proveedor o almacen"
                  className="mt-1.5 w-full max-w-[11rem] rounded-2xl border border-amber-500/20 bg-[#0a1020] px-4 py-2.5 text-sm text-white outline-none transition focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200">Tel. Proveedor</label>
                <input
                  type="text"
                  value={formState.supplierPhone}
                  onChange={(event) => updateField("supplierPhone", event.target.value)}
                  placeholder="Telefono del proveedor"
                  className="mt-1.5 w-full max-w-[11rem] rounded-2xl border border-amber-500/20 bg-[#0a1020] px-4 py-2.5 text-sm text-white outline-none transition focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200">Nota informativa</label>
                <textarea
                  value={formState.internalNotes}
                  onChange={(event) => updateField("internalNotes", event.target.value)}
                  rows={3}
                  className="mt-1.5 w-full rounded-2xl border border-amber-500/20 bg-[#0a1020] px-4 py-2.5 text-sm text-white outline-none transition focus:border-amber-400"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">Foto privada contable</p>
                <p className="mt-1 text-xs text-amber-100/80">
                  Solo se guarda en administracion. No se muestra al cliente.
                </p>
                {formState.accountingImageUrl ? (
                  <button
                    type="button"
                    onClick={() => setAccountingImagePreviewOpen(true)}
                    className="mt-2 block overflow-hidden rounded-[1rem] border border-amber-500/20 bg-[#0a1020] transition hover:border-amber-400"
                  >
                    <img
                      src={formState.accountingImageUrl}
                      alt="Foto privada contable"
                      className="h-20 w-20 object-contain"
                    />
                  </button>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-400">
                    {formState.accountingImageUrl ? "Cambiar foto privada" : "Agregar foto privada"}
                    <input
                      type="file"
                      accept={ACCEPTED_IMAGE_TYPES}
                      onChange={(event) => {
                        const file = event.target.files?.[0];

                        if (file) {
                          void updateAccountingImage(file);
                        }

                        event.target.value = "";
                      }}
                      className="hidden"
                    />
                  </label>
                  {formState.accountingImageUrl ? (
                    <button
                      type="button"
                      onClick={removeAccountingImage}
                      className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:border-rose-400"
                    >
                      Eliminar foto
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[1.1rem] border border-slate-800 bg-[#060b16] p-3 xl:col-start-4 xl:row-start-1">

            <div className="mt-2 space-y-2">
              <div className="rounded-[1rem] border border-slate-800 bg-[#0a1020] p-3">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Articulo</p>
                <p className="mt-2 text-base font-semibold text-white">
                  {formState.name || "Sin nombre"}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  {formState.category || "Sin categoria"}
                </p>
                <div className="mt-3 grid gap-2 text-xs text-slate-300">
                  <span className="rounded-xl border border-slate-700 px-3 py-2">
                    ID: {formState.publicId || "Se asigna al crear"}
                  </span>
                  <span className="rounded-xl border border-slate-700 px-3 py-2">
                    SKU: {formState.sku || "Automatico si lo dejas vacio"}
                  </span>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-[1rem] border border-slate-800 bg-[#0a1020] p-3">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Precio</p>
                  <p className="mt-2 text-base font-semibold text-white">
                    {formatCurrency(salePrice)}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-slate-800 bg-[#0a1020] p-3">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Ganancia
                  </p>
                  <p className="mt-2 text-base font-semibold text-emerald-300">
                    {formatCurrency(unitMargin)}
                  </p>
                </div>
              </div>

              <div className="rounded-[1rem] border border-slate-800 bg-[#0a1020] p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <span className="rounded-2xl border border-slate-700 px-3 py-2 text-sm text-slate-300">
                    Imagenes: {formState.images.length}
                  </span>
                  <span className="rounded-2xl border border-slate-700 px-3 py-2 text-sm text-slate-300">
                    Variantes: {formState.variants.length}
                  </span>
                </div>
              </div>

              <div className="rounded-[1rem] border border-slate-800 bg-[#0a1020] p-3">
                <div className="grid gap-2 text-sm text-slate-300">
                  <span className="rounded-xl border border-slate-700 px-3 py-2">
                    Publicado: {formatDateTime(formState.publishedAt)}
                  </span>
                  <span className="rounded-xl border border-slate-700 px-3 py-2">
                    Entrada a stock: {formatDateTime(formState.stockAddedAt)}
                  </span>
                  <span className="rounded-xl border border-slate-700 px-3 py-2">
                    Ultima venta: {formatDateTime(formState.lastSoldAt)}
                  </span>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-slate-800 bg-[#0a1020] p-4">
                <div className="mt-1 flex flex-wrap gap-2">
                  {splitTags(formState.tags).length > 0 ? (
                    splitTags(formState.tags).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Sin etiquetas</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {error ? (
            <div className="rounded-[1.5rem] border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 xl:col-span-4">
              {error}
            </div>
          ) : null}

        </div>
      </form>

      {imageEditor && activeEditorImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6">
          <div className="w-full max-w-5xl rounded-[2rem] border border-slate-800 bg-[#050816] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-violet-200">
                  Editar imagen
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                  Ajustar y recortar
                </h2>
              </div>
              <button
                type="button"
                onClick={closeImageEditor}
                className="rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-500"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[0.62fr_0.38fr]">
              <div className="overflow-hidden rounded-[1.75rem] border border-slate-800 bg-[#02040c]">
                <div className="relative mx-auto h-[520px] w-[520px] overflow-hidden">
                  <img
                    src={activeEditorImage.url}
                    alt="Editor"
                    className="absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 object-cover"
                    style={imageEditorPreviewStyle}
                  />
                  <div className="pointer-events-none absolute inset-0 border-4 border-cyan-400/80"></div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-4">
                  <label className="block text-sm font-medium text-slate-300">Zoom</label>
                  <input
                    type="range"
                    min="1"
                    max="2.5"
                    step="0.01"
                    value={imageEditor.zoom}
                    onChange={(event) =>
                      setImageEditor((currentEditor) =>
                        currentEditor
                          ? {
                              ...currentEditor,
                              zoom: Number(event.target.value),
                            }
                          : currentEditor
                      )
                    }
                    className="mt-3 w-full accent-cyan-400"
                  />
                </div>

                <div className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-4">
                  <label className="block text-sm font-medium text-slate-300">
                    Posicion horizontal
                  </label>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={imageEditor.offsetX}
                    onChange={(event) =>
                      setImageEditor((currentEditor) =>
                        currentEditor
                          ? {
                              ...currentEditor,
                              offsetX: Number(event.target.value),
                            }
                          : currentEditor
                      )
                    }
                    className="mt-3 w-full accent-cyan-400"
                  />
                </div>

                <div className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-4">
                  <label className="block text-sm font-medium text-slate-300">
                    Posicion vertical
                  </label>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={imageEditor.offsetY}
                    onChange={(event) =>
                      setImageEditor((currentEditor) =>
                        currentEditor
                          ? {
                              ...currentEditor,
                              offsetY: Number(event.target.value),
                            }
                          : currentEditor
                      )
                    }
                    className="mt-3 w-full accent-cyan-400"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void saveImageEdit()}
                    disabled={editingImage}
                    className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {editingImage ? "Guardando..." : "Guardar ajuste"}
                  </button>
                  <button
                    type="button"
                    onClick={closeImageEditor}
                    className="rounded-2xl border border-slate-700 bg-[#0a1020] px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-500"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {accountingImagePreviewOpen && formState.accountingImageUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 py-6">
          <div className="w-full max-w-3xl rounded-[1.75rem] border border-amber-500/20 bg-[#0c0b08] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-white">Foto privada contable</p>
              <button
                type="button"
                onClick={() => setAccountingImagePreviewOpen(false)}
                className="rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-2 text-sm font-semibold text-white transition hover:border-amber-400"
              >
                Cerrar
              </button>
            </div>
            <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-amber-500/20 bg-[#0a1020] p-4">
              <img
                src={formState.accountingImageUrl}
                alt="Foto privada contable ampliada"
                className="max-h-[70vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
