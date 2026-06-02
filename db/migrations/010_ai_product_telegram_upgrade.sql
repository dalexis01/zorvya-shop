ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_srd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_telegram_image_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS original_source TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS generated_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS seo_title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS specifications JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE products
  ALTER COLUMN review_status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_products_original_source
  ON products (original_source, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_supplier_name
  ON products (supplier_name, updated_at DESC);

ALTER TABLE ai_product_batches
  ADD COLUMN IF NOT EXISTS supplier_name_detected TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS telegram_message_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS total_items INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_items INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_items INTEGER NOT NULL DEFAULT 0;

ALTER TABLE ai_product_batch_items
  ADD COLUMN IF NOT EXISTS generated_product_id TEXT NULL REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS error_message TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_telegram_image_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS generated_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS seo_title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS supplier_name_detected TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_ai_product_batches_telegram_chat
  ON ai_product_batches (telegram_chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_product_batch_items_status
  ON ai_product_batch_items (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_product_batch_items_generated_product_id
  ON ai_product_batch_items (generated_product_id);
