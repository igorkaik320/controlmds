-- Adicionar colunas de valores na tabela servicos_maquinas
ALTER TABLE servicos_maquinas 
ADD COLUMN valor_mao_obra DECIMAL(10,2),
ADD COLUMN valor_material DECIMAL(10,2),
ADD COLUMN valor_total DECIMAL(10,2);

-- Adicionar comentários nas novas colunas
COMMENT ON COLUMN servicos_maquinas.valor_mao_obra IS 'Valor da mão de obra do serviço';
COMMENT ON COLUMN servicos_maquinas.valor_material IS 'Valor do material utilizado no serviço';
COMMENT ON COLUMN servicos_maquinas.valor_total IS 'Valor total do serviço (soma de mão de obra e material)';
