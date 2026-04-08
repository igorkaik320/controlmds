-- Tabela de Equipamentos
CREATE TABLE IF NOT EXISTS equipamentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    marca VARCHAR(255),
    modelo VARCHAR(255),
    setor_id UUID REFERENCES setores(id),
    setor_nome VARCHAR(255),
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Setores
CREATE TABLE IF NOT EXISTS setores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(255) NOT NULL UNIQUE,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Manutenções
CREATE TABLE IF NOT EXISTS manutencoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    equipamento_id UUID REFERENCES equipamentos(id) NOT NULL,
    equipamento_nome VARCHAR(255) NOT NULL,
    setor_id UUID REFERENCES setores(id) NOT NULL,
    setor_nome VARCHAR(255) NOT NULL,
    fornecedor_id UUID REFERENCES fornecedores(id),
    fornecedor_nome VARCHAR(255),
    data DATE NOT NULL,
    valor DECIMAL(10,2) NOT NULL DEFAULT 0,
    proxima_manutencao DATE NOT NULL,
    avisar_dias_antes INTEGER NOT NULL DEFAULT 10,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_equipamentos_nome ON equipamentos(nome);
CREATE INDEX IF NOT EXISTS idx_equipamentos_setor_id ON equipamentos(setor_id);
CREATE INDEX IF NOT EXISTS idx_setores_nome ON setores(nome);
CREATE INDEX IF NOT EXISTS idx_manutencoes_equipamento ON manutencoes(equipamento_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_setor ON manutencoes(setor_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_fornecedor ON manutencoes(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_proxima_manutencao ON manutencoes(proxima_manutencao);
CREATE INDEX IF NOT EXISTS idx_manutencoes_ativo ON manutencoes(ativo);

-- Row Level Security (RLS)
ALTER TABLE equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE manutencoes ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança para equipamentos
CREATE POLICY "Equipamentos - Visualização" ON equipamentos
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Equipamentos - Inserção" ON equipamentos
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Equipamentos - Atualização" ON equipamentos
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Equipamentos - Exclusão" ON equipamentos
    FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas de segurança para setores
CREATE POLICY "Setores - Visualização" ON setores
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Setores - Inserção" ON setores
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Setores - Atualização" ON setores
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Setores - Exclusão" ON setores
    FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas de segurança para manutenções
CREATE POLICY "Manutenções - Visualização" ON manutencoes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Manutenções - Inserção" ON manutencoes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Manutenções - Atualização" ON manutencoes
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Manutenções - Exclusão" ON manutencoes
    FOR DELETE USING (auth.role() = 'authenticated');

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at automaticamente
CREATE TRIGGER update_equipamentos_updated_at 
    BEFORE UPDATE ON equipamentos 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_setores_updated_at 
    BEFORE UPDATE ON setores 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_manutencoes_updated_at 
    BEFORE UPDATE ON manutencoes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
