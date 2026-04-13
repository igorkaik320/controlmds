-- Remover tabelas existentes para recriar com estrutura correta
DROP TABLE IF EXISTS contas_pagar_parcelas CASCADE;
DROP TABLE IF EXISTS contas_pagar CASCADE;

-- Habilitar extensão UUID se não existir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Função para gerar UUID se gen_random_uuid não existir
CREATE OR REPLACE FUNCTION gen_random_uuid() RETURNS UUID AS $$
BEGIN
    RETURN uuid_generate_v4();
EXCEPTION WHEN undefined_function THEN
    RETURN uuid_generate_v4();
END;
$$ LANGUAGE plpgsql;

-- Tabela de Contas a Pagar
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
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Parcelas de Contas a Pagar
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
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar chave estrangeira para contas_pagar_parcelas
ALTER TABLE contas_pagar_parcelas 
ADD CONSTRAINT fk_contas_pagar_parcelas_conta_pagar 
FOREIGN KEY (conta_pagar_id) REFERENCES contas_pagar(id) ON DELETE CASCADE;

-- Habilitar RLS (Row Level Security)
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_pagar_parcelas ENABLE ROW LEVEL SECURITY;

-- Política para contas_pagar (usuários autenticados podem ver tudo)
CREATE POLICY "Users can view contas_pagar" ON contas_pagar
    FOR SELECT USING (auth.role() = 'authenticated');

-- Política para contas_pagar (usuários autenticados podem inserir)
CREATE POLICY "Users can insert contas_pagar" ON contas_pagar
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND created_by = auth.uid());

-- Política para contas_pagar (criador pode atualizar)
CREATE POLICY "Users can update contas_pagar" ON contas_pagar
    FOR UPDATE USING (auth.role() = 'authenticated' AND created_by = auth.uid());

-- Política para contas_pagar (criador pode deletar)
CREATE POLICY "Users can delete contas_pagar" ON contas_pagar
    FOR DELETE USING (auth.role() = 'authenticated' AND created_by = auth.uid());

-- Política para contas_pagar_parcelas (usuários autenticados podem ver tudo)
CREATE POLICY "Users can view contas_pagar_parcelas" ON contas_pagar_parcelas
    FOR SELECT USING (auth.role() = 'authenticated');

-- Política para contas_pagar_parcelas (usuários autenticados podem inserir)
CREATE POLICY "Users can insert contas_pagar_parcelas" ON contas_pagar_parcelas
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND created_by = auth.uid());

-- Política para contas_pagar_parcelas (criador pode atualizar)
CREATE POLICY "Users can update contas_pagar_parcelas" ON contas_pagar_parcelas
    FOR UPDATE USING (auth.role() = 'authenticated' AND created_by = auth.uid());

-- Política para contas_pagar_parcelas (criador pode deletar)
CREATE POLICY "Users can delete contas_pagar_parcelas" ON contas_pagar_parcelas
    FOR DELETE USING (auth.role() = 'authenticated' AND created_by = auth.uid());

-- Criar índices para melhor performance
CREATE INDEX idx_contas_pagar_empresa_id ON contas_pagar(empresa_id);
CREATE INDEX idx_contas_pagar_fornecedor_id ON contas_pagar(fornecedor_id);
CREATE INDEX idx_contas_pagar_status ON contas_pagar(status);
CREATE INDEX idx_contas_pagar_data_emissao ON contas_pagar(data_emissao);
CREATE INDEX idx_contas_pagar_created_by ON contas_pagar(created_by);

CREATE INDEX idx_contas_pagar_parcelas_conta_pagar_id ON contas_pagar_parcelas(conta_pagar_id);
CREATE INDEX idx_contas_pagar_parcelas_status ON contas_pagar_parcelas(status);
CREATE INDEX idx_contas_pagar_parcelas_data_vencimento ON contas_pagar_parcelas(data_vencimento);
CREATE INDEX idx_contas_pagar_parcelas_created_by ON contas_pagar_parcelas(created_by);

-- Inserir dados de exemplo (opcional)
INSERT INTO contas_pagar (data_emissao, empresa_id, empresa_nome, fornecedor_id, fornecedor_nome, valor_total, quantidade_parcelas, observacao, created_by) VALUES
('2024-01-15', NULL, 'Empresa Exemplo 1', NULL, 'Fornecedor Exemplo 1', 1500.00, 3, 'Conta de exemplo 1', '00000000-0000-0000-0000-000000000000'),
('2024-01-20', NULL, 'Empresa Exemplo 2', NULL, 'Fornecedor Exemplo 2', 2500.00, 2, 'Conta de exemplo 2', '00000000-0000-0000-0000-000000000000');

-- Inserir parcelas de exemplo
INSERT INTO contas_pagar_parcelas (conta_pagar_id, numero_parcela, valor_parcela, data_vencimento, created_by) 
SELECT 
    id,
    generate_series(1, quantidade_parcelas) as numero_parcela,
    valor_total / quantidade_parcelas as valor_parcela,
    data_emissao + (generate_series(1, quantidade_parcelas) - 1) * INTERVAL '1 month' as data_vencimento,
    created_by
FROM contas_pagar;
