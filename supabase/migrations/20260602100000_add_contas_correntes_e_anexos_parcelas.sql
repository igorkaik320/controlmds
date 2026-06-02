CREATE TABLE IF NOT EXISTS public.contas_correntes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  banco TEXT NOT NULL,
  agencia TEXT NOT NULL,
  numero_conta TEXT NOT NULL,
  digito_verificador TEXT,
  data_saldo_inicial DATE NOT NULL,
  saldo_inicial NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ativa BOOLEAN NOT NULL DEFAULT true,
  observacao TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contas_correntes_unique
  ON public.contas_correntes (
    lower(trim(banco)),
    lower(trim(agencia)),
    lower(trim(numero_conta)),
    lower(trim(coalesce(digito_verificador, '')))
  );

ALTER TABLE public.contas_correntes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view contas correntes"
  ON public.contas_correntes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert contas correntes"
  ON public.contas_correntes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update contas correntes"
  ON public.contas_correntes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete contas correntes"
  ON public.contas_correntes FOR DELETE TO authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_contas_correntes_updated_at'
  ) THEN
    CREATE TRIGGER update_contas_correntes_updated_at
    BEFORE UPDATE ON public.contas_correntes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.contas_pagar_parcela_anexos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parcela_id UUID NOT NULL REFERENCES public.contas_pagar_parcelas(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  nome_exibicao TEXT,
  caminho_storage TEXT NOT NULL,
  tipo_arquivo TEXT,
  tamanho_bytes BIGINT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_parcela_anexos_parcela
  ON public.contas_pagar_parcela_anexos (parcela_id);

ALTER TABLE public.contas_pagar_parcela_anexos
  ADD COLUMN IF NOT EXISTS nome_exibicao TEXT;

ALTER TABLE public.contas_pagar_parcela_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view parcela anexos"
  ON public.contas_pagar_parcela_anexos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert parcela anexos"
  ON public.contas_pagar_parcela_anexos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update parcela anexos"
  ON public.contas_pagar_parcela_anexos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete parcela anexos"
  ON public.contas_pagar_parcela_anexos FOR DELETE TO authenticated USING (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('contas-pagar-anexos', 'contas-pagar-anexos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth users can view contas pagar anexos storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contas-pagar-anexos');

CREATE POLICY "Auth users can upload contas pagar anexos storage"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contas-pagar-anexos');

CREATE POLICY "Auth users can delete contas pagar anexos storage"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contas-pagar-anexos');

ALTER TABLE public.contas_pagar_parcelas
  ADD COLUMN IF NOT EXISTS conta_corrente_id UUID REFERENCES public.contas_correntes(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.contas_correntes_movimentacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_corrente_id UUID NOT NULL REFERENCES public.contas_correntes(id) ON DELETE CASCADE,
  origem_tipo TEXT NOT NULL,
  origem_id UUID,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  data_movimentacao DATE NOT NULL,
  valor NUMERIC(14, 2) NOT NULL,
  descricao TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contas_correntes_movimentos_conta
  ON public.contas_correntes_movimentacoes (conta_corrente_id);
CREATE INDEX IF NOT EXISTS idx_contas_correntes_movimentos_origem
  ON public.contas_correntes_movimentacoes (origem_tipo, origem_id);

ALTER TABLE public.contas_correntes_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view contas correntes movimentos"
  ON public.contas_correntes_movimentacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert contas correntes movimentos"
  ON public.contas_correntes_movimentacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can delete contas correntes movimentos"
  ON public.contas_correntes_movimentacoes FOR DELETE TO authenticated USING (true);
