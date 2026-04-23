-- ============================================================
-- Adiciona campo de Observação aos Equipamentos
-- e torna a Próxima Manutenção opcional
-- Execute este SQL no SQL Editor do seu Supabase
-- ============================================================

-- 1) Campo de observação no cadastro de equipamentos
ALTER TABLE equipamentos
  ADD COLUMN IF NOT EXISTS observacao TEXT;

-- 2) Próxima manutenção passa a ser opcional
ALTER TABLE manutencoes
  ALTER COLUMN proxima_manutencao DROP NOT NULL;
