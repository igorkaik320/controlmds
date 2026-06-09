ALTER TABLE public.contas_correntes
  ADD COLUMN IF NOT EXISTS id_ofx TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contas_correntes_id_ofx
  ON public.contas_correntes (id_ofx)
  WHERE id_ofx IS NOT NULL AND btrim(id_ofx) <> '';
