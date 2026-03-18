

## Plano: Fase 4 -- Modulo Combustivel + Melhorias Fornecedores

### Escopo

**A. Melhorias no Cadastro de Fornecedores**
1. Verificacao de duplicidade por CNPJ ao cadastrar -- avisar se ja existe
2. Formatacao automatica de CNPJ (XX.XXX.XXX/XXXX-XX), CPF (XXX.XXX.XXX-XX) e celular ((XX) XXXXX-XXXX) nos campos de entrada
3. Busca inteligente que busca por nome OU razao social (e parcial)

**B. Modulo de Combustivel (novo modulo no sidebar)**

Novas tabelas no Supabase (SQL a ser executado manualmente):

```text
veiculos_maquinas
  id, tipo (veiculo|maquina), placa, modelo, marca, categoria (caterpillar|new_holland|caminhao|carro|outro), created_by, created_at

tipos_combustivel
  id, nome (diesel|gasolina|etanol|etc), created_by, created_at

abastecimentos
  id, veiculo_id (FK), nfe, data, combustivel_id (FK), quantidade_litros, valor_unitario, valor_total, observacao, created_by, created_at, updated_at
```

Novas paginas:
- `src/pages/VeiculosMaquinasPage.tsx` -- CRUD de veiculos e maquinas (dentro de Cadastros no sidebar)
- `src/pages/TiposCombustivelPage.tsx` -- CRUD de tipos de combustivel (dentro de Cadastros)
- `src/pages/AbastecimentosPage.tsx` -- Tela de lancamento de abastecimentos com campos: Veiculo, NF-e, Data, Combustivel, Qtd(L), Valor Unit., Total, e total geral do periodo
- `src/pages/DashboardCombustivelPage.tsx` -- Dashboards com graficos (consumo por veiculo, por periodo, por tipo combustivel) usando Recharts

Novos servicos:
- `src/lib/combustivelService.ts` -- CRUD para veiculos, tipos combustivel, abastecimentos
- `src/lib/combustivelExport.ts` -- Exportacao PDF/Excel dos abastecimentos

Sidebar atualizado:
- Novo grupo "Controle de Combustivel" com: Dashboard Combustivel, Abastecimentos
- Dentro de "Cadastros": adicionar Veiculos/Maquinas e Tipos de Combustivel

Modulo permissions: adicionar as novas module keys (`combustivel_dashboard`, `abastecimentos`, `veiculos_maquinas`, `tipos_combustivel`)

**C. Formatacao de valores nos formularios**
- Campo valor nos formularios de compras (avista, faturadas, programacao semanal, abastecimentos): formatar como moeda brasileira enquanto digita (R$ 1.234,56)

### Arquivos a criar
- `src/lib/combustivelService.ts`
- `src/lib/combustivelExport.ts`
- `src/lib/formatters.ts` (funcoes de formatacao CPF/CNPJ/celular/moeda)
- `src/pages/VeiculosMaquinasPage.tsx`
- `src/pages/TiposCombustivelPage.tsx`
- `src/pages/AbastecimentosPage.tsx`
- `src/pages/DashboardCombustivelPage.tsx`

### Arquivos a modificar
- `src/components/AppSidebar.tsx` -- novo grupo Combustivel + cadastros novos
- `src/App.tsx` -- novas rotas
- `src/lib/modulePermissions.ts` -- novas module keys
- `src/pages/FornecedoresPage.tsx` -- verificacao duplicidade CNPJ, formatacao campos, busca por razao social
- `src/pages/ComprasAvistaPage.tsx` -- formatacao valor
- `src/pages/ComprasFaturadasPage.tsx` -- formatacao valor
- `src/pages/ProgramacaoSemanalPage.tsx` -- formatacao valor

### SQL para o usuario executar no Supabase
Script completo sera fornecido para criar as 3 tabelas novas com RLS habilitado.

