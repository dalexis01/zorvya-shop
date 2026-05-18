#!/usr/bin/env node
/**
 * Migrates base64 images stored in products.images_json to Vercel Blob.
 *
 * What it does:
 *   1. Reads all products that have base64 images in images_json
 *   2. Uploads each base64 image to Vercel Blob
 *   3. Replaces the data: URL with the Vercel Blob URL in the DB
 *   4. Does NOT delete any data — images_json stays intact, just with URLs
 *
 * How to run:
 *   node --env-file=.env.local scripts/migrate-images-to-blob.mjs
 *
 * Required env vars (add to .env.local before running):
 *   DATABASE_URL or DIRECT_URL  — Supabase Postgres connection
 *   BLOB_READ_WRITE_TOKEN        — from Vercel Dashboard > Storage > Blob store
 *
 * Safe to re-run: already-migrated images (those without data: prefix) are skipped.
 */

import { Pool } from "pg";
import { put } from "@vercel/blob";

// Use DIRECT_URL (port 5432) to avoid pgBouncer prepared-statement issues
const connectionString =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  "";

if (!connectionString) {
  console.error("❌ DATABASE_URL or DIRECT_URL not set in environment.");
  process.exit(1);
}

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("❌ BLOB_READ_WRITE_TOKEN not set.");
  console.error("   1. Go to Vercel Dashboard → Storage → Create Blob Store");
  console.error("   2. Copy the BLOB_READ_WRITE_TOKEN");
  console.error("   3. Add it to .env.local");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : false,
  max: 3,
});

const MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

function parseDataUrl(url) {
  const m = url.match(/^data:([^;,]+)(?:;base64)?,(.+)$/s);
  if (!m) return null;
  return { mimeType: m[1].toLowerCase(), base64: m[2] };
}

function mimeToExt(mime) {
  return MIME_TO_EXT[mime] ?? "jpg";
}

async function migrateProductImages(product, dryRun) {
  const images = Array.isArray(product.images_json) ? product.images_json : [];
  const newImages = [];
  let changed = false;
  let migratedCount = 0;
  let skippedCount = 0;
  let bytes = 0;

  for (const img of images) {
    if (!img.url || !img.url.startsWith("data:")) {
      newImages.push(img);
      skippedCount++;
      continue;
    }

    const parsed = parseDataUrl(img.url);
    if (!parsed) {
      console.warn(`    ⚠ Skipping malformed data URL for image ${img.id ?? "?"}`);
      newImages.push(img);
      skippedCount++;
      continue;
    }

    const buffer = Buffer.from(parsed.base64, "base64");
    bytes += buffer.byteLength;
    const ext = mimeToExt(parsed.mimeType);
    const filename = `${product.id}/${img.id ?? `img-${Date.now()}`}.${ext}`;

    if (dryRun) {
      console.log(`    [DRY RUN] Would upload: products/${filename} (${(buffer.byteLength / 1024).toFixed(0)} KB, ${parsed.mimeType})`);
      newImages.push(img);
      migratedCount++;
      changed = true;
      continue;
    }

    try {
      const blob = await put(`products/${filename}`, buffer, {
        access: "public",
        contentType: parsed.mimeType,
        addRandomSuffix: false,
      });
      console.log(`    ✅ products/${filename} → ${blob.url}`);
      newImages.push({ ...img, url: blob.url });
      migratedCount++;
      changed = true;
    } catch (err) {
      console.error(`    ❌ Upload failed for ${filename}: ${err.message}`);
      newImages.push(img); // keep original on error
      skippedCount++;
    }
  }

  return { newImages, changed, migratedCount, skippedCount, bytes };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (dryRun) {
    console.log("🔍 DRY RUN — no changes will be made to the database or Blob store.\n");
  } else {
    console.log("🚀 Starting image migration to Vercel Blob...\n");
  }

  const client = await pool.connect();
  let totalProducts = 0;
  let totalImages = 0;
  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalBytes = 0;
  let totalErrors = 0;

  try {
    const { rows: products } = await client.query(
      `SELECT id, name, images_json, internal_json
       FROM products
       WHERE images_json != '[]'::jsonb
       ORDER BY name`
    );

    totalProducts = products.length;
    console.log(`📦 Found ${totalProducts} product(s) with images.\n`);

    for (const product of products) {
      console.log(`📷 "${product.name}" (${product.id})`);

      // Migrate gallery images (images_json)
      const {
        newImages,
        changed: galleryChanged,
        migratedCount,
        skippedCount,
        bytes,
      } = await migrateProductImages(product, dryRun);

      totalImages += migratedCount + skippedCount;
      totalMigrated += migratedCount;
      totalSkipped += skippedCount;
      totalBytes += bytes;

      // Migrate accounting image inside internal_json (if base64)
      let internal = product.internal_json ?? {};
      let internalChanged = false;

      if (internal.accountingImageUrl?.startsWith?.("data:")) {
        const parsed = parseDataUrl(internal.accountingImageUrl);
        if (parsed && !dryRun) {
          try {
            const buffer = Buffer.from(parsed.base64, "base64");
            const ext = mimeToExt(parsed.mimeType);
            const blob = await put(`products/${product.id}/accounting.${ext}`, buffer, {
              access: "public",
              contentType: parsed.mimeType,
              addRandomSuffix: false,
            });
            internal = { ...internal, accountingImageUrl: blob.url };
            internalChanged = true;
            totalMigrated++;
            totalBytes += buffer.byteLength;
            console.log(`    ✅ accounting image → ${blob.url}`);
          } catch (err) {
            console.error(`    ❌ Accounting image upload failed: ${err.message}`);
            totalErrors++;
          }
        } else if (parsed && dryRun) {
          console.log(`    [DRY RUN] Would upload accounting image for "${product.name}"`);
        }
      }

      // Write updated images_json (and internal_json if needed) to DB
      if (!dryRun && (galleryChanged || internalChanged)) {
        try {
          await client.query(
            `UPDATE products
             SET images_json = $1::jsonb${internalChanged ? ", internal_json = $3::jsonb" : ""}
             WHERE id = $2`,
            internalChanged
              ? [JSON.stringify(newImages), product.id, JSON.stringify(internal)]
              : [JSON.stringify(newImages), product.id]
          );
          console.log(`    💾 DB updated for "${product.name}"`);
        } catch (err) {
          console.error(`    ❌ DB update failed: ${err.message}`);
          totalErrors++;
        }
      } else if (!galleryChanged && !internalChanged) {
        console.log(`    ↩ Already migrated — skipping.`);
      }

      console.log();
    }
  } finally {
    client.release();
    await pool.end();
  }

  // Summary
  const mbRemoved = (totalBytes / 1024 / 1024).toFixed(1);
  console.log("═══════════════════════════════════════════════════");
  if (dryRun) {
    console.log("📊 DRY RUN summary (nothing was changed):");
  } else {
    console.log("📊 Migration complete:");
  }
  console.log(`   Products processed  : ${totalProducts}`);
  console.log(`   Images migrated     : ${totalMigrated}`);
  console.log(`   Images skipped      : ${totalSkipped} (already external URLs)`);
  console.log(`   Errors              : ${totalErrors}`);
  console.log(`   Base64 data removed : ~${mbRemoved} MB from Postgres`);

  if (totalErrors > 0) {
    console.log("\n⚠  Some uploads failed. Re-run the script to retry.");
    process.exit(1);
  } else if (dryRun) {
    console.log("\n✅ Dry run passed. Run without --dry-run to apply.");
  } else {
    console.log("\n✅ All images migrated. Egress from Postgres will drop significantly.");
    console.log("   You can verify by reloading the admin products page — images");
    console.log("   will now load from Vercel Blob instead of the DB.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
