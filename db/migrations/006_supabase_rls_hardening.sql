BEGIN;

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.products ENABLE ROW LEVEL SECURITY';
  END IF;

  IF to_regclass('public.orders') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY';
  END IF;

  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.users ENABLE ROW LEVEL SECURITY';
  END IF;

  IF to_regclass('public.addresses') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY';
  END IF;

  IF to_regclass('public.auth_codes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.auth_codes ENABLE ROW LEVEL SECURITY';
  END IF;

  IF to_regclass('public.auth_security_events') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.auth_security_events ENABLE ROW LEVEL SECURITY';
  END IF;

  IF to_regclass('public.delivery_blocks') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.delivery_blocks ENABLE ROW LEVEL SECURITY';
  END IF;

  IF to_regclass('public.delivery_block_orders') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.delivery_block_orders ENABLE ROW LEVEL SECURITY';
  END IF;

  IF to_regclass('public.suppliers') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY';
  END IF;

  IF to_regclass('public.supplier_payments') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

REVOKE ALL ON TABLE public.products FROM anon, authenticated;
REVOKE ALL ON TABLE public.orders FROM anon, authenticated;
REVOKE ALL ON TABLE public.users FROM anon, authenticated;
REVOKE ALL ON TABLE public.addresses FROM anon, authenticated;
REVOKE ALL ON TABLE public.auth_codes FROM anon, authenticated;
REVOKE ALL ON TABLE public.auth_security_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.delivery_blocks FROM anon, authenticated;
REVOKE ALL ON TABLE public.delivery_block_orders FROM anon, authenticated;
REVOKE ALL ON TABLE public.suppliers FROM anon, authenticated;
REVOKE ALL ON TABLE public.supplier_payments FROM anon, authenticated;

GRANT SELECT ON TABLE public.products TO anon, authenticated;

DROP POLICY IF EXISTS products_public_select ON public.products;
CREATE POLICY products_public_select
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND is_visible = true);

COMMIT;
