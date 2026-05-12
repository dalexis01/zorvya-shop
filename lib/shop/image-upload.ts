const DEFAULT_MAX_DIMENSION = 1600;

export const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/avif";

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("INVALID_IMAGE_FILE"));
    };

    reader.onerror = () => reject(new Error("INVALID_IMAGE_FILE"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("INVALID_IMAGE_FILE"));
    image.src = dataUrl;
  });
}

export async function imageFileToDataUrl(
  file: File,
  options?: {
    maxDimension?: number;
  }
) {
  if (!file.type.startsWith("image/")) {
    throw new Error("INVALID_IMAGE_TYPE");
  }

  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceDataUrl);
  const maxDimension = options?.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const largestSide = Math.max(width, height);

  if (!largestSide || largestSide <= maxDimension) {
    return sourceDataUrl;
  }

  const scale = maxDimension / largestSide;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    return sourceDataUrl;
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  if (file.type === "image/png") {
    return canvas.toDataURL("image/png");
  }

  if (file.type === "image/avif") {
    return canvas.toDataURL("image/avif", 0.92);
  }

  if (file.type === "image/webp") {
    return canvas.toDataURL("image/webp", 0.92);
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}
