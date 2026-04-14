
-- Sequência para numeração única que nunca se repete
CREATE SEQUENCE IF NOT EXISTS contas_pagar_numero_seq;

-- Tabela principal
CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero INTEGER NOT NULL UNIQUE DEFAULT nextval('contas_pagar_numero_seq'),
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_primeiro_vencimento DATE,
  empresa_id UUID REFERENCES public.empresas(id),
  empresa_nome TEXT,
  fornecedor_id TEXT,
  fornecedor_nome TEXT,
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantidade_parcelas INTEGER NOT NULL DEFAULT 1,
  observacao TEXT,
  status TEXT NOT NULL DEFAULT 'aberto',
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER SEQUENCE contas_pagar_numero_seq OWNED BY public.contas_pagar.numero;

-- Tabela de parcelas
CREATE TABLE IF NOT EXISTS public.contas_pagar_parcelas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_pagar_id UUID NOT NULL REFERENCES public.contas_pagar(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL DEFAULT 1,
  valor_parcela NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_vencimento DATE,
  data_pagamento DATE,
  valor_pago NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'aberta',
  observacao TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS contas_pagar
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view contas_pagar" ON public.contas_pagar FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert contas_pagar" ON public.contas_pagar FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update contas_pagar" ON public.contas_pagar FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete contas_pagar" ON public.contas_pagar FOR DELETE TO authenticated USING (true);

-- RLS contas_pagar_parcelas
ALTER TABLE public.contas_pagar_parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view parcelas" ON public.contas_pagar_parcelas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert parcelas" ON public.contas_pagar_parcelas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update parcelas" ON public.contas_pagar_parcelas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete parcelas" ON public.contas_pagar_parcelas FOR DELETE TO authenticated USING (true);

-- Trigger updated_at
CREATE TRIGGER update_contas_pagar_updated_at BEFORE UPDATE ON public.contas_pagar FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contas_pagar_parcelas_updated_at BEFORE UPDATE ON public.contas_pagar_parcelas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
