-- Migration: Add obra fields to contas_pagar table
-- Date: 2025-04-14
-- Description: Add obra_id and obra_nome columns to contas_pagar table

-- Add obra_id column (foreign key to obras table)
ALTER TABLE contas_pagar 
ADD COLUMN obra_id UUID NULL REFERENCES obras(id);

-- Add obra_nome column for caching the obra name
ALTER TABLE contas_pagar 
ADD COLUMN obra_nome TEXT NULL;

-- Create index for obra_id for better query performance
CREATE INDEX idx_contas_pagar_obra_id ON contas_pagar(obra_id);

-- Add comment to describe the new columns
COMMENT ON COLUMN contas_pagar.obra_id IS 'Foreign key reference to obras table';
COMMENT ON COLUMN contas_pagar.obra_nome IS 'Cached obra name for display purposes';
