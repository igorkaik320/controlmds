CREATE TABLE IF NOT EXISTS public.ofx_importacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_corrente_id UUID REFERENCES public.contas_correntes(id) ON DELETE SET NULL,
  id_ofx TEXT NOT NULL,
  banco_id TEXT,
  banco_nome TEXT,
  conta_ofx TEXT,
  data_inicio DATE,
  data_fim DATE,
  nome_arquivo TEXT,
  total_recebido NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_pago NUMERIC(14,2) NOT NULL DEFAULT 0,
  quantidade_lancamentos INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ofx_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id UUID NOT NULL REFERENCES public.ofx_importacoes(id) ON DELETE CASCADE,
  conta_corrente_id UUID REFERENCES public.contas_correntes(id) ON DELETE SET NULL,
  fitid TEXT NOT NULL,
  checknum TEXT,
  tipo TEXT,
  data_movimento DATE NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'conciliado', 'ignorado')),
  parcela_id UUID REFERENCES public.contas_pagar_parcelas(id) ON DELETE SET NULL,
  conciliado_por UUID,
  conciliado_em TIMESTAMPTZ,
  ignorado_por UUID,
  ignorado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conciliacoes_ofx (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ofx_lancamento_id UUID NOT NULL REFERENCES public.ofx_lancamentos(id) ON DELETE CASCADE,
  parcela_id UUID NOT NULL REFERENCES public.contas_pagar_parcelas(id) ON DELETE CASCADE,
  conta_corrente_id UUID REFERENCES public.contas_correntes(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'baixa_automatica' CHECK (tipo IN ('baixa_automatica', 'vinculo_manual', 'confirmacao_baixa')),
  valor NUMERIC(14,2) NOT NULL,
  data_conciliacao DATE NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ofx_lancamentos_conta_fitid
  ON public.ofx_lancamentos (conta_corrente_id, fitid)
  WHERE conta_corrente_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conciliacoes_ofx_lancamento
  ON public.conciliacoes_ofx (ofx_lancamento_id);

CREATE INDEX IF NOT EXISTS idx_ofx_lancamentos_conta_status
  ON public.ofx_lancamentos (conta_corrente_id, status);

CREATE INDEX IF NOT EXISTS idx_ofx_lancamentos_data
  ON public.ofx_lancamentos (data_movimento);

ALTER TABLE public.ofx_importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ofx_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conciliacoes_ofx ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ofx imports"
  ON public.ofx_importacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert ofx imports"
  ON public.ofx_importacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update ofx imports"
  ON public.ofx_importacoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete ofx imports"
  ON public.ofx_importacoes FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can view ofx transactions"
  ON public.ofx_lancamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert ofx transactions"
  ON public.ofx_lancamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update ofx transactions"
  ON public.ofx_lancamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete ofx transactions"
  ON public.ofx_lancamentos FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can view ofx reconciliations"
  ON public.conciliacoes_ofx FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert ofx reconciliations"
  ON public.conciliacoes_ofx FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update ofx reconciliations"
  ON public.conciliacoes_ofx FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete ofx reconciliations"
  ON public.conciliacoes_ofx FOR DELETE TO authenticated USING (true);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_ofx_lancamentos_updated_at'
  ) THEN
    CREATE TRIGGER update_ofx_lancamentos_updated_at
    BEFORE UPDATE ON public.ofx_lancamentos
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
