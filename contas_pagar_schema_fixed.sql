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
CREATE TABLE IF NOT EXISTS contas_pagar (
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
CREATE TABLE IF NOT EXISTS contas_pagar_parcelas (
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

-- Adicionar foreign key constraints se as tabelas existirem
DO $$
BEGIN
    -- Verificar se tabela empresas existe antes de adicionar FK
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'empresas' AND table_schema = 'public') THEN
        ALTER TABLE contas_pagar ADD CONSTRAINT fk_contas_pagar_empresa 
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL;
    END IF;
    
    -- Verificar se tabela fornecedores existe antes de adicionar FK
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fornecedores' AND table_schema = 'public') THEN
        ALTER TABLE contas_pagar ADD CONSTRAINT fk_contas_pagar_fornecedor 
            FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id) ON DELETE SET NULL;
    END IF;
    
    -- Adicionar FK para contas_pagar_parcelas
    ALTER TABLE contas_pagar_parcelas ADD CONSTRAINT fk_contas_pagar_parcelas_conta 
        FOREIGN KEY (conta_pagar_id) REFERENCES contas_pagar(id) ON DELETE CASCADE;
END $$;

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_contas_pagar_data_emissao ON contas_pagar(data_emissao);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_id ON contas_pagar(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_fornecedor_id ON contas_pagar(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON contas_pagar(status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_parcelas_conta_id ON contas_pagar_parcelas(conta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_parcelas_vencimento ON contas_pagar_parcelas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_parcelas_status ON contas_pagar_parcelas(status);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Remover triggers existentes antes de criar
DROP TRIGGER IF EXISTS update_contas_pagar_updated_at ON contas_pagar;
DROP TRIGGER IF EXISTS update_contas_pagar_parcelas_updated_at ON contas_pagar_parcelas;

-- Criar triggers
CREATE TRIGGER update_contas_pagar_updated_at BEFORE UPDATE ON contas_pagar
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contas_pagar_parcelas_updated_at BEFORE UPDATE ON contas_pagar_parcelas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS (Row Level Security)
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_pagar_parcelas ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para contas_pagar
DROP POLICY IF EXISTS "Users can view contas_pagar" ON contas_pagar;
CREATE POLICY "Users can view contas_pagar" ON contas_pagar
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can insert contas_pagar" ON contas_pagar;
CREATE POLICY "Users can insert contas_pagar" ON contas_pagar
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update contas_pagar" ON contas_pagar;
CREATE POLICY "Users can update contas_pagar" ON contas_pagar
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete contas_pagar" ON contas_pagar;
CREATE POLICY "Users can delete contas_pagar" ON contas_pagar
    FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas de RLS para contas_pagar_parcelas
DROP POLICY IF EXISTS "Users can view contas_pagar_parcelas" ON contas_pagar_parcelas;
CREATE POLICY "Users can view contas_pagar_parcelas" ON contas_pagar_parcelas
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can insert contas_pagar_parcelas" ON contas_pagar_parcelas;
CREATE POLICY "Users can insert contas_pagar_parcelas" ON contas_pagar_parcelas
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update contas_pagar_parcelas" ON contas_pagar_parcelas;
CREATE POLICY "Users can update contas_pagar_parcelas" ON contas_pagar_parcelas
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete contas_pagar_parcelas" ON contas_pagar_parcelas;
CREATE POLICY "Users can delete contas_pagar_parcelas" ON contas_pagar_parcelas
    FOR DELETE USING (auth.role() = 'authenticated');

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE 'Tabelas contas_pagar e contas_pagar_parcelas criadas com sucesso!';
END $$;
