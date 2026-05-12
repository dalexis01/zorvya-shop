# GUÍA DE INTEGRACIÓN IA - IMÁGENES Y DESCRIPCIONES

## RESUMEN EJECUTIVO

Sistema de IA para:
1. **Análisis de imagen** → Genera descripciones y tags automáticos
2. **Generación de variaciones** → Crea múltiples ángulos del producto
3. **Mejora de calidad** → Upscaling y limpieza visual

---

## OPCIÓN 1: REPLICATE + CLAUDE (Recomendado)

### Configuración

```bash
npm install replicate @anthropic-ai/sdk dotenv
```

### Variables de entorno (.env.local)

```env
# Replicate API (para imágenes)
REPLICATE_API_TOKEN=your_replicate_token_here

# Anthropic API (para análisis)
ANTHROPIC_API_KEY=your_anthropic_key_here
```

### Obtener API Keys

**Replicate:**
1. Ve a https://replicate.com/
2. Crea cuenta
3. Copia tu API token en Settings

**Anthropic:**
1. Ve a https://console.anthropic.com/
2. Crea cuenta
3. Copia tu API key

### Implementación

Reemplaza el archivo `lib/server/admin/ai-helpers.ts`:

```typescript
import "server-only";
import Replicate from "replicate";
import Anthropic from "@anthropic-ai/sdk";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ImageEnhancementResult {
  upscaledUrl?: string;
  variationUrls?: string[];
  improvedQualityUrl?: string;
  angledViews?: string[];
}

export interface ImageAnalysisResult {
  productName?: string;
  shortDescription: string;
  longDescription: string;
  suggestedTags: string[];
  suggestedCategory: string;
  attributes: {
    color?: string;
    material?: string;
    brand?: string;
    size?: string;
    type?: string;
  };
}

/**
 * Analiza imagen con Claude Vision
 */
export async function analyzeProductImage(imageUrl: string): Promise<ImageAnalysisResult> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "url",
                url: imageUrl,
              },
            },
            {
              type: "text",
              text: `Analiza esta imagen de producto y devuelve un JSON con:
              {
                "productName": "nombre comercial exacto",
                "shortDescription": "máximo 120 caracteres, descripción corta",
                "longDescription": "máximo 500 caracteres, detallado",
                "suggestedTags": ["tag1", "tag2", "tag3"],
                "suggestedCategory": "categoría principal",
                "attributes": {
                  "color": "color principal",
                  "material": "material si es visible",
                  "brand": "marca si es visible",
                  "size": "tamaño si se ve",
                  "type": "tipo/variante"
                }
              }
              
              Responde SOLO con el JSON, sin markdown.`,
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    const result = JSON.parse(content.text) as ImageAnalysisResult;
    return result;
  } catch (error) {
    console.error("Error analyzing image:", error);
    return {
      shortDescription: "Producto detectado en imagen",
      longDescription: "Descripción del producto detectado",
      suggestedTags: ["producto"],
      suggestedCategory: "general",
      attributes: {},
    };
  }
}

/**
 * Genera upscaling de imagen con Real-ESRGAN
 */
export async function upscaleImage(imageUrl: string): Promise<string> {
  try {
    const output = (await replicate.run(
      "nightmareai/real-esrgan:42fed498d7a029e0a2664b6c4584e371f2e5738b201c1bff7e0accc1b8324c65",
      {
        input: {
          image: imageUrl,
          scale: 4,
        },
      }
    )) as string;

    return output;
  } catch (error) {
    console.error("Error upscaling image:", error);
    return imageUrl;
  }
}

/**
 * Mejora calidad con GFPGAN (para fotos de productos)
 */
export async function improveImageQuality(imageUrl: string): Promise<string> {
  try {
    const output = (await replicate.run(
      "tencentarc/gfpgan:0fbacf7afc6c144e5be9767cff079618678f86786d141af52eba7a64c53b7531",
      {
        input: {
          img: imageUrl,
          version: 1.3,
          upscale: 2,
        },
      }
    )) as string;

    return output;
  } catch (error) {
    console.error("Error improving quality:", error);
    return imageUrl;
  }
}

/**
 * Genera variaciones de ángulos con ControlNet
 * (Requiere modelo custom entrenado - ver alternativas abajo)
 */
export async function generateAngleVariations(imageUrl: string): Promise<string[]> {
  try {
    // Nota: Esto requeriría un modelo custom o múltiples calls
    // Por ahora retornamos la imagen original
    // Alternativa: usar ImageMagick para rotaciones básicas

    return [imageUrl];
  } catch (error) {
    console.error("Error generating variations:", error);
    return [imageUrl];
  }
}

/**
 * Pipeline completo: análisis + mejora
 */
export async function processProductImage(
  imageUrl: string
): Promise<{
  analysis: ImageAnalysisResult;
  improvedImageUrl: string;
  upscaledImageUrl: string;
}> {
  const [analysis, improvedImage, upscaledImage] = await Promise.all([
    analyzeProductImage(imageUrl),
    improveImageQuality(imageUrl),
    upscaleImage(imageUrl),
  ]);

  return {
    analysis,
    improvedImageUrl: improvedImage,
    upscaledImageUrl: upscaledImage,
  };
}
```

---

## OPCIÓN 2: STABILITY AI (Más barato para generación)

```bash
npm install @stability-ai/sdk
```

**.env.local**
```env
STABILITY_API_KEY=your_key_here
```

**Para upscaling y variaciones:**

```typescript
import { Client, toFile } from "@stability-ai/sdk";

const client = new Client({
  apiKey: process.env.STABILITY_API_KEY,
  engine_id: "esrgan-v1-x2plus",
});

export async function upscaleWithStability(imageUrl: string) {
  const response = await client.upscaleImage.upscaleImage({
    image: await toFile(fetch(imageUrl).then(r => r.blob())),
  });
  return response;
}
```

---

## OPCIÓN 3: LOCAL + HUGGING FACE (Gratis)

```bash
npm install @huggingface/inference
```

**.env.local**
```env
HUGGING_FACE_API_KEY=your_key_here
```

**Análisis:**

```typescript
import { HfInference } from "@huggingface/inference";

const hf = new HfInference(process.env.HUGGING_FACE_API_KEY);

export async function analyzeWithHuggingFace(imageUrl: string) {
  // Image-to-text model
  const result = await hf.imageToText({
    data: await fetch(imageUrl).then(r => r.blob()),
    model: "Salesforce/blip-image-captioning-large",
  });

  return result;
}
```

---

## API ENDPOINT PARA IA

Crear: `app/api/admin/products/ai-enhance/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { processProductImage } from "@/lib/server/admin/ai-helpers";

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: "Image URL required" },
        { status: 400 }
      );
    }

    const result = await processProductImage(imageUrl);

    return NextResponse.json({
      success: true,
      analysis: result.analysis,
      enhancedImages: {
        improved: result.improvedImageUrl,
        upscaled: result.upscaledImageUrl,
      },
    });
  } catch (error) {
    console.error("IA processing error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process image" },
      { status: 500 }
    );
  }
}
```

---

## UI PARA ENHANCE PRODUCTS

Crear: `app/admin/products/ai-enhance/page.tsx`

```typescript
"use client";

import { useState } from "react";

export default function AIEnhancePage() {
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleEnhance = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/products/ai-enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error);
        setLoading(false);
        return;
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Mejorar Imagen con IA</h1>

      <form onSubmit={handleEnhance} className="bg-white rounded-lg shadow p-8 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">URL de Imagen</label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            required
            disabled={loading}
            className="w-full px-4 py-2 border rounded-lg"
            placeholder="https://ejemplo.com/imagen.jpg"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium disabled:bg-gray-400"
        >
          {loading ? "Procesando..." : "Mejorar Imagen"}
        </button>
      </form>

      {result && (
        <div className="mt-8 grid grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-4">Descripción Generada</h3>
            <div className="space-y-2">
              <p>
                <strong>Nombre:</strong> {result.analysis.productName}
              </p>
              <p>
                <strong>Descripción corta:</strong> {result.analysis.shortDescription}
              </p>
              <p>
                <strong>Tags:</strong> {result.analysis.suggestedTags.join(", ")}
              </p>
              <p>
                <strong>Categoría:</strong> {result.analysis.suggestedCategory}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-4">Imágenes Mejoradas</h3>
            <div className="space-y-2">
              <a
                href={result.enhancedImages.improved}
                target="_blank"
                className="block text-blue-600"
              >
                ✨ Imagen Mejorada
              </a>
              <a href={result.enhancedImages.upscaled} target="_blank" className="block text-blue-600">
                🔍 Imagen Upscaled
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## FLUJO RECOMENDADO EN PRODUCCIÓN

```
1. Usuario sube imagen
   ↓
2. Sistema extrae metadata con Claude Vision
   ↓
3. Genera 2-3 variaciones mejoradas
   ↓
4. Muestra sugerencias al usuario
   ↓
5. Usuario elige cuáles guardar
   ↓
6. Se guardan en el producto
```

---

## COSTOS ESTIMADOS

| Servicio | Precio | Uso |
|----------|--------|-----|
| **Replicate** | $0.001-0.01/imagen | Upscaling, variaciones |
| **Anthropic** | $3/1M input, $15/1M output | Análisis con vision |
| **Stability** | $0.01/imagen | Generación alternativa |
| **Hugging Face** | Gratis/Pro | Análisis local |

**Para 100 productos: ~$1-5 USD con Replicate + Anthropic**

---

## TESTING LOCAL SIN API

Para desarrollar sin APIs reales:

```typescript
// En ai-helpers.ts - versión mock
export async function analyzeProductImage(imageUrl: string): Promise<ImageAnalysisResult> {
  // Simula análisis
  return {
    productName: "Producto de Prueba",
    shortDescription: "Descripción automática generada",
    longDescription: "Descripción larga detallada...",
    suggestedTags: ["producto", "calidad", "especial"],
    suggestedCategory: "general",
    attributes: { color: "variado", material: "múltiple" },
  };
}
```

---

## PRÓXIMAS FEATURES

- [ ] Batch processing (múltiples imágenes)
- [ ] Cache de resultados
- [ ] Integración con storage en cloud
- [ ] Webhooks para procesos async
- [ ] Admin de modelos de IA
- [ ] Fallback automático entre servicios

---

Este es el setup completo para integración IA. Elige tu opción y adapta al flujo de tu aplicación.
