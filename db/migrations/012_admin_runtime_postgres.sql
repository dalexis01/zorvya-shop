CREATE TABLE IF NOT EXISTS public.admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  permissions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NULL,
  created_by TEXT NOT NULL DEFAULT 'system'
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_lower_idx
  ON public.admin_users (LOWER(email));

CREATE TABLE IF NOT EXISTS public.admin_runtime_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_product_reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_id TEXT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_product_reviews_product_id_idx
  ON public.admin_product_reviews (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_product_reviews_user_id_idx
  ON public.admin_product_reviews (user_id);

CREATE TABLE IF NOT EXISTS public.admin_support_messages (
  id TEXT PRIMARY KEY,
  order_id TEXT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  category TEXT NOT NULL DEFAULT 'other',
  source TEXT NOT NULL DEFAULT 'chatbot',
  customer_token TEXT NULL,
  chat_entries_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  responses_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  admin_seen_at TIMESTAMPTZ NULL,
  customer_seen_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS admin_support_messages_status_idx
  ON public.admin_support_messages (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS admin_support_messages_customer_id_idx
  ON public.admin_support_messages (customer_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_status_logs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  action TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_by_name TEXT NOT NULL,
  changes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_status_logs_target_idx
  ON public.admin_status_logs (target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_status_logs_type_idx
  ON public.admin_status_logs (type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_featured_content (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  product_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS admin_featured_content_type_idx
  ON public.admin_featured_content (type, position ASC);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_runtime_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_featured_content ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_users FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_runtime_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_product_reviews FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_support_messages FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_status_logs FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_featured_content FROM anon, authenticated;
