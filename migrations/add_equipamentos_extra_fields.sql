-- Adiciona novos campos ao cadastro de equipamentos
-- Execute este script no SQL Editor do seu Supabase

ALTER TABLE equipamentos
  ADD COLUMN IF NOT EXISTS n_patrimonio VARCHAR(100),
  ADD COLUMN IF NOT EXISTS n_serie VARCHAR(255),
  ADD COLUMN IF NOT EXISTS nota_fiscal VARCHAR(255),
  ADD COLUMN IF NOT EXISTS origem_obra_id UUID REFERENCES obras(id),
  ADD COLUMN IF NOT EXISTS origem_obra_nome VARCHAR(255),
  ADD COLUMN IF NOT EXISTS localizacao_obra_id UUID REFERENCES obras(id),
  ADD COLUMN IF NOT EXISTS localizacao_obra_nome VARCHAR(255),
  ADD COLUMN IF NOT EXISTS situacao VARCHAR(50) DEFAULT 'estoque';

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_equipamentos_n_patrimonio ON equipamentos(n_patrimonio);
CREATE INDEX IF NOT EXISTS idx_equipamentos_situacao ON equipamentos(situacao);
CREATE INDEX IF NOT EXISTS idx_equipamentos_origem_obra ON equipamentos(origem_obra_id);
CREATE INDEX IF NOT EXISTS idx_equipamentos_localizacao_obra ON equipamentos(localizacao_obra_id);

-- Comentário sobre situações válidas:
-- estoque, incinerado, fazer_busca, assistencia, defeito_sede
