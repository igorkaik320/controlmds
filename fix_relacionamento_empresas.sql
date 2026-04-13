-- Verificar e corrigir relacionamento entre contas_pagar e empresas

-- 1. Remover chave estrangeira se existir
ALTER TABLE contas_pagar DROP CONSTRAINT IF EXISTS fk_contas_pagar_empresa_id;

-- 2. Adicionar chave estrangeira correta
ALTER TABLE contas_pagar 
ADD CONSTRAINT fk_contas_pagar_empresa_id 
FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL;

-- 3. Verificar se as empresas existem
SELECT 
    e.id,
    e.nome,
    COUNT(cp.id) as contas_relacionadas
FROM empresas e
LEFT JOIN contas_pagar cp ON e.id = cp.empresa_id
GROUP BY e.id, e.nome
ORDER BY e.nome;
