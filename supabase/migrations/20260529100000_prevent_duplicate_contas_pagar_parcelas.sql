WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY conta_pagar_id, numero_parcela
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.contas_pagar_parcelas
)
DELETE FROM public.contas_pagar_parcelas p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contas_pagar_parcelas_conta_numero_unique
  ON public.contas_pagar_parcelas (conta_pagar_id, numero_parcela);
