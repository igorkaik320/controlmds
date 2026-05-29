UPDATE public.contas_pagar cp
SET
  empresa_id = o.empresa_id,
  empresa_nome = e.nome,
  obra_id = COALESCE(cp.obra_id, o.id),
  updated_at = now()
FROM public.obras o
JOIN public.empresas e ON e.id = o.empresa_id
WHERE cp.origem = 'CF'
  AND cp.obra_nome IS NOT NULL
  AND o.empresa_id IS NOT NULL
  AND (
    cp.empresa_id IS NULL
    OR cp.empresa_nome IS NULL
    OR cp.empresa_nome = ''
  )
  AND lower(trim(regexp_replace(cp.obra_nome, '\s+', ' ', 'g'))) = lower(trim(regexp_replace(o.nome, '\s+', ' ', 'g')));
