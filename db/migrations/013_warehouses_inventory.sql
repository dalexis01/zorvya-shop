CREATE TABLE IF NOT EXISTS public.warehouses (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address_line TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'Suriname',
  contact_name TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.warehouse_inventory (
  id TEXT PRIMARY KEY,
  warehouse_id TEXT NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  quantity_reserved INTEGER NOT NULL DEFAULT 0,
  reorder_threshold INTEGER NOT NULL DEFAULT 0,
  last_counted_at TIMESTAMPTZ NULL,
  last_synced_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_id, product_id)
);

CREATE INDEX IF NOT EXISTS warehouse_inventory_product_idx
  ON public.warehouse_inventory (product_id);

CREATE INDEX IF NOT EXISTS warehouse_inventory_warehouse_idx
  ON public.warehouse_inventory (warehouse_id);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id TEXT PRIMARY KEY,
  warehouse_id TEXT NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  order_id TEXT NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL,
  quantity_delta INTEGER NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inventory_movements_product_idx
  ON public.inventory_movements (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS inventory_movements_order_idx
  ON public.inventory_movements (order_id);

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.warehouses FROM anon, authenticated;
REVOKE ALL ON TABLE public.warehouse_inventory FROM anon, authenticated;
REVOKE ALL ON TABLE public.inventory_movements FROM anon, authenticated;
