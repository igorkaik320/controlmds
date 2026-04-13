-- Adicionar coluna created_by se não existir
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS created_by UUID;

-- Adicionar coluna updated_by se não existir
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Adicionar coluna created_at se não existir
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Adicionar coluna updated_at se não existir
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Adicionar coluna created_by na tabela de parcelas se não existir
ALTER TABLE contas_pagar_parcelas ADD COLUMN IF NOT EXISTS created_by UUID;

-- Adicionar coluna updated_by na tabela de parcelas se não existir
ALTER TABLE contas_pagar_parcelas ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Adicionar coluna created_at na tabela de parcelas se não existir
ALTER TABLE contas_pagar_parcelas ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Adicionar coluna updated_at na tabela de parcelas se não existir
ALTER TABLE contas_pagar_parcelas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
