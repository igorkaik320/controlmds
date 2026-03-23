create table if not exists public.postos_combustivel (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  observacao text null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.postos_combustivel enable row level security;

drop policy if exists "Authenticated users can view postos combustivel" on public.postos_combustivel;
create policy "Authenticated users can view postos combustivel"
on public.postos_combustivel
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert postos combustivel" on public.postos_combustivel;
create policy "Authenticated users can insert postos combustivel"
on public.postos_combustivel
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update postos combustivel" on public.postos_combustivel;
create policy "Authenticated users can update postos combustivel"
on public.postos_combustivel
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete postos combustivel" on public.postos_combustivel;
create policy "Authenticated users can delete postos combustivel"
on public.postos_combustivel
for delete
to authenticated
using (true);

alter table public.veiculos_maquinas
add column if not exists obra_id uuid null references public.obras(id) on delete set null;

alter table public.abastecimentos
add column if not exists posto_id uuid null references public.postos_combustivel(id) on delete set null;

create index if not exists idx_veiculos_maquinas_obra_id on public.veiculos_maquinas(obra_id);
create index if not exists idx_abastecimentos_posto_id on public.abastecimentos(posto_id);
