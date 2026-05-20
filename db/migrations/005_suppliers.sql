CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_date TIMESTAMPTZ NOT NULL,
  block_id TEXT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'admin'
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name
  ON suppliers (name);

CREATE INDEX IF NOT EXISTS idx_suppliers_updated_at
  ON suppliers (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier_id
  ON supplier_payments (supplier_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_block_id
  ON supplier_payments (block_id);
