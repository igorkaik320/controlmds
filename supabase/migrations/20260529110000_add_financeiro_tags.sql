CREATE TABLE IF NOT EXISTS public.financeiro_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#ef4444',
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_financeiro_tags_nome_unique
  ON public.financeiro_tags (lower(trim(nome)));

ALTER TABLE public.financeiro_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view financeiro tags" ON public.financeiro_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert financeiro tags" ON public.financeiro_tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update financeiro tags" ON public.financeiro_tags FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete financeiro tags" ON public.financeiro_tags FOR DELETE TO authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_financeiro_tags_updated_at'
  ) THEN
    CREATE TRIGGER update_financeiro_tags_updated_at
    BEFORE UPDATE ON public.financeiro_tags
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS tag_id UUID REFERENCES public.financeiro_tags(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tag_nome TEXT,
  ADD COLUMN IF NOT EXISTS tag_cor TEXT;
