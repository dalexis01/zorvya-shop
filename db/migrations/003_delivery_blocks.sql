CREATE TABLE IF NOT EXISTS delivery_blocks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  route_distance_km NUMERIC(10,2) NULL,
  route_duration_minutes INTEGER NULL,
  route_polyline TEXT NULL,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'admin',
  notes TEXT NULL
);

CREATE TABLE IF NOT EXISTS delivery_block_orders (
  block_id TEXT NOT NULL REFERENCES delivery_blocks(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  leg_distance_km NUMERIC(10,2) NULL,
  leg_duration_minutes INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (block_id, order_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_block_orders_order_id
  ON delivery_block_orders (order_id);

CREATE INDEX IF NOT EXISTS idx_delivery_block_orders_block_id
  ON delivery_block_orders (block_id, position);

CREATE INDEX IF NOT EXISTS idx_delivery_blocks_status
  ON delivery_blocks (status, created_at DESC);
