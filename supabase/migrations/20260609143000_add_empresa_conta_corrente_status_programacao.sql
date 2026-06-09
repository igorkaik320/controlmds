ALTER TABLE public.contas_correntes
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS public.idx_contas_correntes_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contas_correntes_unique
  ON public.contas_correntes (
    coalesce(empresa_id::text, ''),
    lower(trim(banco)),
    lower(trim(agencia)),
    lower(trim(numero_conta)),
    lower(trim(coalesce(digito_verificador, '')))
  );

CREATE INDEX IF NOT EXISTS idx_contas_correntes_empresa_id
  ON public.contas_correntes (empresa_id);

ALTER TABLE public.programacao_semanal
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aberta',
  ADD COLUMN IF NOT EXISTS data_pagamento DATE,
  ADD COLUMN IF NOT EXISTS conta_corrente_id UUID REFERENCES public.contas_correntes(id) ON DELETE SET NULL;

UPDATE public.programacao_semanal
SET status = 'aberta'
WHERE status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'programacao_semanal_status_check'
      AND conrelid = 'public.programacao_semanal'::regclass
  ) THEN
    ALTER TABLE public.programacao_semanal
      ADD CONSTRAINT programacao_semanal_status_check
      CHECK (status IN ('aberta', 'paga', 'vencida', 'cancelada'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_programacao_semanal_status
  ON public.programacao_semanal (status);

CREATE INDEX IF NOT EXISTS idx_programacao_semanal_conta_corrente
  ON public.programacao_semanal (conta_corrente_id);
