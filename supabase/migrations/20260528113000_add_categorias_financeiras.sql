CREATE TABLE IF NOT EXISTS public.categorias_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  natureza TEXT NOT NULL CHECK (natureza IN ('totalizadora', 'movimento')),
  parent_id UUID REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view categorias_financeiras"
  ON public.categorias_financeiras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert categorias_financeiras"
  ON public.categorias_financeiras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update categorias_financeiras"
  ON public.categorias_financeiras FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete categorias_financeiras"
  ON public.categorias_financeiras FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS update_categorias_financeiras_updated_at ON public.categorias_financeiras;
CREATE TRIGGER update_categorias_financeiras_updated_at
  BEFORE UPDATE ON public.categorias_financeiras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_categorias_financeiras_tipo ON public.categorias_financeiras (tipo);
CREATE INDEX IF NOT EXISTS idx_categorias_financeiras_natureza ON public.categorias_financeiras (natureza);
CREATE INDEX IF NOT EXISTS idx_categorias_financeiras_parent ON public.categorias_financeiras (parent_id);

ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS categoria_financeira_id UUID REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS categoria_codigo TEXT,
  ADD COLUMN IF NOT EXISTS categoria_nome TEXT;

CREATE INDEX IF NOT EXISTS idx_contas_pagar_categoria_financeira_id
  ON public.contas_pagar (categoria_financeira_id);
