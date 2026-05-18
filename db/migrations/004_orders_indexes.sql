-- Migration 004: Add composite and search indexes for admin orders queries

-- Composite index for the most common admin tab query:
-- "pending delivery orders" = cancelled_at IS NULL + delivery_type + created_at DESC
CREATE INDEX IF NOT EXISTS idx_orders_delivery_pending
  ON orders (delivery_type, created_at DESC, id DESC)
  WHERE cancelled_at IS NULL;

-- Composite index for all-orders admin view with date cursor
CREATE INDEX IF NOT EXISTS idx_orders_type_created
  ON orders (delivery_type, cancelled_at, created_at DESC, id DESC);

-- Index for customer name search (ILIKE — partial, but helps with left-anchored queries)
CREATE INDEX IF NOT EXISTS idx_orders_customer_name_lower
  ON orders (lower(customer_name));

-- Index for customer phone search
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone
  ON orders (customer_phone);

-- Partial index for pending orders (most accessed in the admin panel)
CREATE INDEX IF NOT EXISTS idx_orders_pending_created
  ON orders (created_at DESC, id DESC)
  WHERE cancelled_at IS NULL AND admin_status IS DISTINCT FROM 'Pedido completado';
