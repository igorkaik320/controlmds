ALTER TABLE public.financeiro_tags
  ADD COLUMN IF NOT EXISTS ordem INTEGER;

CREATE INDEX IF NOT EXISTS idx_financeiro_tags_ordem
  ON public.financeiro_tags (ordem, nome);
