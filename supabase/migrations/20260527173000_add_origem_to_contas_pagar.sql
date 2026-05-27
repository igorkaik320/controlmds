ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'CP',
  ADD COLUMN IF NOT EXISTS origem_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contas_pagar_origem_check'
      AND conrelid = 'public.contas_pagar'::regclass
  ) THEN
    ALTER TABLE public.contas_pagar
      ADD CONSTRAINT contas_pagar_origem_check
      CHECK (origem IN ('CP', 'CF', 'CA'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contas_pagar_origem
  ON public.contas_pagar (origem);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contas_pagar_origem_cf_unique
  ON public.contas_pagar (origem, origem_id)
  WHERE origem = 'CF' AND origem_id IS NOT NULL;
