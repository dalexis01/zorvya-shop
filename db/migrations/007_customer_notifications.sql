CREATE TABLE IF NOT EXISTS customer_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id TEXT NULL REFERENCES orders(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_notifications_user_created
  ON customer_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_notifications_user_read
  ON customer_notifications (user_id, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_notifications_order
  ON customer_notifications (order_id, created_at DESC)
  WHERE order_id IS NOT NULL;

ALTER TABLE customer_notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE customer_notifications FROM anon, authenticated;
