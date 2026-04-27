## Objetivo

Criar um módulo de **Serviços de Máquinas Pesadas** que registra, ao longo do tempo, consertos e trocas de peças em veículos/máquinas já cadastrados, alimentando um histórico por máquina (visível pelo "olhinho" no cadastro de Veículos) para análise de recorrência de quebras.

---

## 1. Banco de dados (SQL para você rodar no editor SQL do Supabase)

Duas novas tabelas:

- **`componentes_maquinas`** — cadastro de peças/componentes (ex.: "Bomba hidráulica", "Filtro de óleo").
- **`servicos_maquinas`** — cada serviço executado em um veículo/máquina, com obra alocada, horímetro, tipo, observação.
- **`servicos_maquinas_pecas`** — N peças trocadas/com defeito por serviço, com observação individual.

```sql
-- 1) Componentes / Peças
create table if not exists public.componentes_maquinas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text null,
  ativo boolean not null default true,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_by uuid null,
  updated_at timestamptz not null default now()
);

alter table public.componentes_maquinas enable row level security;

create policy "Auth view componentes_maquinas" on public.componentes_maquinas
  for select to authenticated using (true);
create policy "Auth insert componentes_maquinas" on public.componentes_maquinas
  for insert to authenticated with check (true);
create policy "Auth update componentes_maquinas" on public.componentes_maquinas
  for update to authenticated using (true) with check (true);
create policy "Auth delete componentes_maquinas" on public.componentes_maquinas
  for delete to authenticated using (true);

-- 2) Serviços de Máquinas
create table if not exists public.servicos_maquinas (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos_maquinas(id) on delete cascade,
  obra_id uuid null references public.obras(id) on delete set null,
  data date not null default current_date,
  horimetro numeric(12,2) null,
  tipo_servico text not null check (tipo_servico in ('conserto','troca_pecas','conserto_troca_pecas')),
  observacao text null,
  observacao_pecas text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_by uuid null,
  updated_at timestamptz not null default now()
);

alter table public.servicos_maquinas enable row level security;

create policy "Auth view servicos_maquinas" on public.servicos_maquinas
  for select to authenticated using (true);
create policy "Auth insert servicos_maquinas" on public.servicos_maquinas
  for insert to authenticated with check (true);
create policy "Auth update servicos_maquinas" on public.servicos_maquinas
  for update to authenticated using (true) with check (true);
create policy "Auth delete servicos_maquinas" on public.servicos_maquinas
  for delete to authenticated using (true);

create index if not exists idx_servicos_maquinas_veiculo on public.servicos_maquinas(veiculo_id);
create index if not exists idx_servicos_maquinas_data on public.servicos_maquinas(data desc);
create index if not exists idx_servicos_maquinas_obra on public.servicos_maquinas(obra_id);

-- 3) Peças trocadas/defeito por serviço (N por serviço)
create table if not exists public.servicos_maquinas_pecas (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references public.servicos_maquinas(id) on delete cascade,
  componente_id uuid not null references public.componentes_maquinas(id) on delete restrict,
  status text not null default 'trocada' check (status in ('trocada','defeito')),
  observacao text null,
  created_at timestamptz not null default now()
);

alter table public.servicos_maquinas_pecas enable row level security;

create policy "Auth view servicos_pecas" on public.servicos_maquinas_pecas
  for select to authenticated using (true);
create policy "Auth insert servicos_pecas" on public.servicos_maquinas_pecas
  for insert to authenticated with check (true);
create policy "Auth update servicos_pecas" on public.servicos_maquinas_pecas
  for update to authenticated using (true) with check (true);
create policy "Auth delete servicos_pecas" on public.servicos_maquinas_pecas
  for delete to authenticated using (true);

create index if not exists idx_servicos_pecas_servico on public.servicos_maquinas_pecas(servico_id);
create index if not exists idx_servicos_pecas_componente on public.servicos_maquinas_pecas(componente_id);
```

---

## 2. Frontend — novas páginas

### a) `ComponentesMaquinasPage.tsx`
CRUD simples (igual a Postos/Tipos de Combustível): lista + diálogo Novo/Editar com `nome`, `descricao`, `ativo`. Rota `/componentes-maquinas`.

### b) `ServicosMaquinasPage.tsx`
Rota `/servicos-maquinas`. Tela principal com:
- Botão **Novo serviço**
- Filtros: máquina (search), obra, tipo de serviço, intervalo de datas
- Tabela: Data, Máquina (placa), Obra, Horímetro, Tipo, Peças (badges), Observação, Auditoria, Ações

**Diálogo Novo/Editar serviço:**
- Máquina (Select de `veiculos_maquinas` — reutiliza `VeiculoSearchSelect`)
- Obra alocada (Select de `obras`)
- Data do serviço
- Horímetro atual (numérico, em horas)
- Tipo de serviço (radio/select): Conserto / Troca de peças / Conserto + Troca de peças
- Observação do serviço (Textarea — visível em todos os tipos)
- Bloco "Peças" (visível quando tipo ≠ Conserto):
  - Lista dinâmica (adicionar/remover) de linhas: Componente (Select com busca, com botão "+ cadastrar nova peça" abrindo um mini-dialog), Status (Trocada / Com defeito), Observação da peça
- Validação: Conserto não exige peças; demais tipos exigem ≥1 peça.

### c) Histórico dentro do cadastro de Veículo (o "olhinho")
Em `VeiculosMaquinasPage.tsx`, adicionar coluna "Ações" um botão **Eye** que abre um diálogo `HistoricoMaquinaDialog` mostrando, para aquela máquina:
- Cards-resumo: total de serviços, último horímetro registrado, intervalo médio (em dias) entre serviços, peça mais trocada
- Tabela cronológica (mais recente primeiro): Data, Horímetro, Tipo, Peças, Obra, Observação
- Por peça: tabela agrupada com nome da peça, qtd de trocas, datas, intervalo médio entre trocas (esse é o ponto-chave para você ver "de quanto em quanto tempo a peça quebra")
- Botão **Exportar PDF/Excel** seguindo o padrão de relatórios (landscape, tabular, conforme `mem://style/report-layout`).

---

## 3. Service layer — `src/lib/servicosMaquinasService.ts`

Funções (com auditoria via `recordAuditEntry`, padrão dos outros services):
- `fetchComponentes()`, `saveComponente()`, `updateComponente()`, `deleteComponente()`
- `fetchServicos(filtros?)` — join com veiculo, obra, peças (componente)
- `fetchServicosPorVeiculo(veiculoId)` — para o histórico
- `saveServico(servico, pecas[], userId)` — insere serviço + peças em sequência
- `updateServico(id, servico, pecas[], userId)` — atualiza serviço, recria peças
- `deleteServico(id, userId)` — cascade já remove peças

---

## 4. Navegação e permissões

- Adicionar 2 novos `ModuleKey` em `src/lib/modulePermissions.ts`: `servicos_maquinas` e `componentes_maquinas`.
- Registrar rotas em `src/App.tsx` com `ModuleRoute`.
- Adicionar entradas no `AppSidebar.tsx`, dentro do grupo **Gestão de Ativos**:
  - "Serviços de Máquinas" → `/servicos-maquinas`
  - "Componentes / Peças" → `/componentes-maquinas` (em Cadastros)

---

## 5. Detalhes técnicos

- Tipos TS adicionados ao service (não editar `types.ts`, é auto-gerado).
- Cliente Supabase sem o generic `<Database>` (regra do projeto).
- Auditoria registrada nas 3 tabelas usando `recordAuditEntry` com `entity_type = 'servicos_maquinas'` etc.
- Horímetro: numeric com 2 casas, validação ≥ 0 e idealmente ≥ horímetro do serviço anterior (apenas warning, não bloqueia, para não travar correções).
- O cálculo "intervalo médio entre quebras de uma peça" é feito no front sobre o histórico carregado (diferença em dias entre datas consecutivas de cada `componente_id`).

---

## 6. Entregáveis

1. SQL acima (você roda no editor SQL do Supabase).
2. `src/lib/servicosMaquinasService.ts` (novo).
3. `src/pages/ComponentesMaquinasPage.tsx` (novo).
4. `src/pages/ServicosMaquinasPage.tsx` (novo).
5. `src/components/HistoricoMaquinaDialog.tsx` (novo) — usado no botão olhinho.
6. Edições: `App.tsx` (rotas), `AppSidebar.tsx` (menu), `modulePermissions.ts` (chaves), `VeiculosMaquinasPage.tsx` (botão olhinho).
7. Memória nova: `mem://features/servicos-maquinas` documentando o módulo.

Aprova para eu já enviar o SQL e implementar?