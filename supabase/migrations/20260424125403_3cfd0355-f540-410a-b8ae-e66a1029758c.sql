-- Tabela para registrar movimentações de ferramentas/equipamentos
-- Tipos: transferencia (entre obras) ou baixa (doacao, extravio, incinerado)

CREATE TABLE IF NOT EXISTS public.equipamentos_movimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipamento_id UUID NOT NULL,
  equipamento_nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('transferencia', 'baixa')),
  -- Para transferência
  obra_origem_id UUID,
  obra_origem_nome TEXT,
  obra_destino_id UUID,
  obra_destino_nome TEXT,
  -- Para baixa
  motivo_baixa TEXT CHECK (motivo_baixa IN ('doacao', 'extravio', 'incinerado') OR motivo_baixa IS NULL),
  -- Comum
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipamentos_movimentos_equipamento_id
  ON public.equipamentos_movimentos(equipamento_id);
CREATE INDEX IF NOT EXISTS idx_equipamentos_movimentos_data
  ON public.equipamentos_movimentos(data DESC);

ALTER TABLE public.equipamentos_movimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view equipamentos_movimentos"
  ON public.equipamentos_movimentos FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Auth users can insert equipamentos_movimentos"
  ON public.equipamentos_movimentos FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Auth users can update equipamentos_movimentos"
  ON public.equipamentos_movimentos FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Auth users can delete equipamentos_movimentos"
  ON public.equipamentos_movimentos FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER update_equipamentos_movimentos_updated_at
  BEFORE UPDATE ON public.equipamentos_movimentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();