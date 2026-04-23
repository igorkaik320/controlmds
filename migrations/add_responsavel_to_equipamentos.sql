-- Adiciona campo responsável ao cadastro de equipamentos
-- Execute este script no SQL Editor do seu Supabase

ALTER TABLE equipamentos
  ADD COLUMN IF NOT EXISTS responsavel TEXT;

CREATE INDEX IF NOT EXISTS idx_equipamentos_responsavel ON equipamentos(responsavel);
