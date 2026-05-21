CREATE TABLE IF NOT EXISTS public.debug_egress_metrics (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  route TEXT NOT NULL,
  rows_count INTEGER NOT NULL DEFAULT 0,
  payload_kb INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  cache_status TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debug_egress_metrics_created_at
  ON public.debug_egress_metrics (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_debug_egress_metrics_source_created_at
  ON public.debug_egress_metrics (source, created_at DESC);

ALTER TABLE public.debug_egress_metrics ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.debug_egress_metrics FROM anon;
REVOKE ALL ON TABLE public.debug_egress_metrics FROM authenticated;
