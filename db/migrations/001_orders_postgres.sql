CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  customer_address TEXT NOT NULL DEFAULT '',
  delivery_type TEXT NOT NULL,
  pickup_date TEXT NULL,
  pickup_time TEXT NULL,
  requested_agent_call BOOLEAN NOT NULL DEFAULT FALSE,
  items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  delivery_distance_km NUMERIC(10, 2) NULL,
  delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ NULL,
  cancellation_reason TEXT NULL,
  cancelled_by TEXT NULL,
  cancelled_by_name TEXT NULL,
  admin_reviewed_at TIMESTAMPTZ NULL,
  admin_status TEXT NULL,
  status_history_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  issues_json JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_orders_user_created_desc
  ON orders (user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_orders_created_desc
  ON orders (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_orders_delivery_type
  ON orders (delivery_type);

CREATE INDEX IF NOT EXISTS idx_orders_admin_status
  ON orders (admin_status);

CREATE INDEX IF NOT EXISTS idx_orders_cancelled_at
  ON orders (cancelled_at);

CREATE INDEX IF NOT EXISTS idx_orders_admin_reviewed_at
  ON orders (admin_reviewed_at);

CREATE INDEX IF NOT EXISTS idx_orders_customer_email
  ON orders (customer_email);

CREATE INDEX IF NOT EXISTS idx_orders_id_tail
  ON orders ((right(id, 4)));
