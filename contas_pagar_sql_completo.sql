-- SQL COMPLETO PARA CONTAS A PAGAR - EXECUTAR NO SUPABASE
-- Este arquivo recria todas as tabelas e configurações necessárias

-- 1. Remover tabelas existentes
DROP TABLE IF EXISTS contas_pagar_parcelas CASCADE;
DROP TABLE IF EXISTS contas_pagar CASCADE;

-- 2. Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Função para gerar UUID
CREATE OR REPLACE FUNCTION gen_random_uuid() RETURNS UUID AS $$
BEGIN
    RETURN uuid_generate_v4();
EXCEPTION WHEN undefined_function THEN
    RETURN uuid_generate_v4();
END;
$$ LANGUAGE plpgsql;

-- 4. Tabela de Contas a Pagar
CREATE TABLE contas_pagar (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
    empresa_id UUID,
    empresa_nome VARCHAR(255),
    fornecedor_id UUID,
    fornecedor_nome VARCHAR(255),
    valor_total DECIMAL(12,2) NOT NULL,
    quantidade_parcelas INTEGER NOT NULL DEFAULT 1,
    observacao TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'pago', 'cancelado')),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabela de Parcelas de Contas a Pagar
CREATE TABLE contas_pagar_parcelas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conta_pagar_id UUID NOT NULL,
    numero_parcela INTEGER NOT NULL,
    valor_parcela DECIMAL(12,2) NOT NULL,
    data_vencimento DATE NOT NULL,
    data_pagamento DATE,
    valor_pago DECIMAL(12,2),
    status VARCHAR(20) NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'paga', 'vencida', 'cancelada')),
    observacao TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Chaves estrangeiras
ALTER TABLE contas_pagar_parcelas 
ADD CONSTRAINT fk_contas_pagar_parcelas_conta_pagar 
FOREIGN KEY (conta_pagar_id) REFERENCES contas_pagar(id) ON DELETE CASCADE;

-- 7. Habilitar RLS (Row Level Security)
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_pagar_parcelas ENABLE ROW LEVEL SECURITY;

-- 8. Políticas de segurança para contas_pagar
CREATE POLICY "Users can view contas_pagar" ON contas_pagar
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert contas_pagar" ON contas_pagar
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update contas_pagar" ON contas_pagar
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete contas_pagar" ON contas_pagar
    FOR DELETE USING (auth.role() = 'authenticated');

-- 9. Políticas de segurança para contas_pagar_parcelas
CREATE POLICY "Users can view contas_pagar_parcelas" ON contas_pagar_parcelas
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert contas_pagar_parcelas" ON contas_pagar_parcelas
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update contas_pagar_parcelas" ON contas_pagar_parcelas
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete contas_pagar_parcelas" ON contas_pagar_parcelas
    FOR DELETE USING (auth.role() = 'authenticated');

-- 10. Índices para performance
CREATE INDEX idx_contas_pagar_empresa_id ON contas_pagar(empresa_id);
CREATE INDEX idx_contas_pagar_fornecedor_id ON contas_pagar(fornecedor_id);
CREATE INDEX idx_contas_pagar_status ON contas_pagar(status);
CREATE INDEX idx_contas_pagar_data_emissao ON contas_pagar(data_emissao);
CREATE INDEX idx_contas_pagar_created_at ON contas_pagar(created_at);

CREATE INDEX idx_contas_pagar_parcelas_conta_pagar_id ON contas_pagar_parcelas(conta_pagar_id);
CREATE INDEX idx_contas_pagar_parcelas_status ON contas_pagar_parcelas(status);
CREATE INDEX idx_contas_pagar_parcelas_data_vencimento ON contas_pagar_parcelas(data_vencimento);
CREATE INDEX idx_contas_pagar_parcelas_created_at ON contas_pagar_parcelas(created_at);

-- 11. Inserir dados de exemplo (opcional)
INSERT INTO contas_pagar (data_emissao, empresa_nome, fornecedor_nome, valor_total, quantidade_parcelas, observacao) VALUES
('2024-01-15', 'Empresa Exemplo 1', 'Fornecedor Exemplo 1', 1500.00, 3, 'Conta de exemplo 1'),
('2024-01-20', 'Empresa Exemplo 2', 'Fornecedor Exemplo 2', 2500.00, 2, 'Conta de exemplo 2');

-- 12. Inserir parcelas de exemplo
INSERT INTO contas_pagar_parcelas (conta_pagar_id, numero_parcela, valor_parcela, data_vencimento) 
SELECT 
    id,
    generate_series(1, quantidade_parcelas) as numero_parcela,
    valor_total / quantidade_parcelas as valor_parcela,
    data_emissao + (generate_series(1, quantidade_parcelas) - 1) * INTERVAL '1 month' as data_vencimento
FROM contas_pagar;

-- 13. Verificar se as tabelas foram criadas corretamente
SELECT 
    'contas_pagar' as tabela_nome,
    COUNT(*) as total_registros
FROM contas_pagar
UNION ALL
SELECT 
    'contas_pagar_parcelas' as tabela_nome,
    COUNT(*) as total_registros
FROM contas_pagar_parcelas;
