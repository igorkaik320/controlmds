-- SQL COMPLETO PARA DIAGNÓSTICO E CORREÇÃO DE TODOS OS PROBLEMAS
-- Execute este arquivo no Supabase SQL Editor para verificar e corrigir tudo

-- 1. Verificar estrutura atual das tabelas
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('contas_pagar', 'contas_pagar_parcelas', 'empresas', 'fornecedores')
    AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 2. Verificar chaves estrangeiras existentes
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name IN ('contas_pagar', 'contas_pagar_parcelas')
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 3. Verificar políticas RLS existentes
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('contas_pagar', 'contas_pagar_parcelas')
    AND schemaname = 'public'
ORDER BY tablename, policyname;

-- 4. Verificar dados existentes nas tabelas
SELECT 'empresas' as tabela, COUNT(*) as total_registros FROM empresas
UNION ALL
SELECT 'fornecedores' as tabela, COUNT(*) as total_registros FROM fornecedores
UNION ALL
SELECT 'contas_pagar' as tabela, COUNT(*) as total_registros FROM contas_pagar
UNION ALL
SELECT 'contas_pagar_parcelas' as tabela, COUNT(*) as total_registros FROM contas_pagar_parcelas;

-- 5. Verificar relacionamentos entre tabelas
SELECT 
    cp.id as conta_id,
    cp.empresa_nome,
    cp.fornecedor_nome,
    e.id as empresa_relacionada,
    e.nome as empresa_nome_relacionado,
    f.id as fornecedor_relacionado,
    f.nome_fornecedor as fornecedor_nome_relacionado
FROM contas_pagar cp
LEFT JOIN empresas e ON cp.empresa_id = e.id
LEFT JOIN fornecedores f ON cp.fornecedor_id = f.id
LIMIT 5;

-- 6. Testar busca de empresas (simulando o que a página faz)
SELECT 
    id,
    nome,
    cnpj
FROM empresas 
ORDER BY nome
LIMIT 10;

-- 7. Testar busca de fornecedores (simulando o que a página faz)
SELECT 
    id,
    nome_fornecedor,
    cnpj_cpf
FROM fornecedores 
ORDER BY nome_fornecedor
LIMIT 10;
