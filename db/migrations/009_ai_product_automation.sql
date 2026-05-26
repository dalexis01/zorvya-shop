ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_id TEXT,
  ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS accounting_original_image_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS original_slack_image_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ai_batch_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS created_by_ai BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_confidence_score NUMERIC(5, 2) NULL;

CREATE INDEX IF NOT EXISTS idx_products_ai_batch_id
  ON products (ai_batch_id);

CREATE INDEX IF NOT EXISTS idx_products_review_status
  ON products (review_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_created_by_ai
  ON products (created_by_ai, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_product_batches (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'n8n',
  supplier_id TEXT NULL REFERENCES suppliers(id) ON DELETE SET NULL,
  batch_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_product_batch_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES ai_product_batches(id) ON DELETE CASCADE,
  product_id TEXT NULL REFERENCES products(id) ON DELETE SET NULL,
  supplier_id TEXT NULL REFERENCES suppliers(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  price_srd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  stock_code TEXT NOT NULL DEFAULT '',
  public_image_url TEXT NOT NULL DEFAULT '',
  original_image_url TEXT NOT NULL DEFAULT '',
  original_slack_image_url TEXT NOT NULL DEFAULT '',
  review_status TEXT NOT NULL DEFAULT 'draft',
  created_by_ai BOOLEAN NOT NULL DEFAULT TRUE,
  ai_confidence_score NUMERIC(5, 2) NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ NULL,
  rejected_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_product_batches_status
  ON ai_product_batches (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_product_batches_supplier_id
  ON ai_product_batches (supplier_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_product_batch_items_batch_id
  ON ai_product_batch_items (batch_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_product_batch_items_product_id
  ON ai_product_batch_items (product_id);

CREATE INDEX IF NOT EXISTS idx_ai_product_batch_items_supplier_id
  ON ai_product_batch_items (supplier_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_product_batch_items_review_status
  ON ai_product_batch_items (review_status, updated_at DESC);

ALTER TABLE ai_product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_product_batch_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE ai_product_batches FROM anon;
REVOKE ALL ON TABLE ai_product_batches FROM authenticated;
REVOKE ALL ON TABLE ai_product_batch_items FROM anon;
REVOKE ALL ON TABLE ai_product_batch_items FROM authenticated;
