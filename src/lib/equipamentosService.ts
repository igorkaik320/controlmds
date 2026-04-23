import { supabase } from '@/integrations/supabase/client';
import { recordAuditEntry } from '@/lib/audit';

export type SituacaoEquipamento =
  | 'estoque'
  | 'incinerado'
  | 'fazer_busca'
  | 'assistencia'
  | 'defeito_sede';

export const SITUACOES_EQUIPAMENTO: { value: SituacaoEquipamento; label: string }[] = [
  { value: 'estoque', label: 'Estoque' },
  { value: 'incinerado', label: 'Incinerado' },
  { value: 'fazer_busca', label: 'Fazer Busca' },
  { value: 'assistencia', label: 'Assistência' },
  { value: 'defeito_sede', label: 'Com Defeito na Sede' },
];

export interface Equipamento {
  id: string;
  nome: string;
  marca?: string | null;
  modelo?: string | null;
  setor_id?: string | null;
  setor_nome?: string | null;
  n_patrimonio?: string | null;
  n_serie?: string | null;
  nota_fiscal?: string | null;
  origem_obra_id?: string | null;
  origem_obra_nome?: string | null;
  localizacao_obra_id?: string | null;
  localizacao_obra_nome?: string | null;
  situacao?: SituacaoEquipamento | null;
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
}

export interface Setor {
  id: string;
  nome: string;
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
}

export interface Manutencao {
  id: string;
  equipamento_id: string;
  equipamento_nome: string;
  setor_id: string;
  setor_nome: string;
  fornecedor_id?: string;
  fornecedor_nome?: string;
  data: string;
  valor: number;
  proxima_manutencao: string;
  avisar_dias_antes: number;
  ativo: boolean;
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
}

// ---- Equipamentos ----
export async function fetchEquipamentos(): Promise<Equipamento[]> {
  const { data, error } = await supabase
    .from('equipamentos')
    .select('*')
    .order('nome');
  if (error) {
    console.error('Erro ao buscar equipamentos:', error);
    throw error;
  }
  return data || [];
}

export async function saveEquipamento(e: Omit<Equipamento, 'id' | 'created_at' | 'updated_at'>, userId: string) {
  // Buscar nome do setor se fornecido
  let setorNome = (e as any).setor_nome ?? null;
  if (e.setor_id && !setorNome) {
    const { data: setorData } = await supabase
      .from('setores')
      .select('nome')
      .eq('id', e.setor_id)
      .single();
    setorNome = setorData?.nome || null;
  }

  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('equipamentos')
    .insert({
      ...e,
      setor_nome: setorNome,
      created_by: userId,
      created_at: timestamp,
      updated_at: timestamp,
    } as any)
    .select()
    .single();
  if (error) {
    console.error('Erro ao salvar equipamento:', error);
    throw error;
  }

  await recordAuditEntry({
    entity_type: 'equipamentos',
    entity_id: data.id,
    action: 'criacao',
    new_values: data,
    user_id: userId,
  });

  return data;
}

export async function updateEquipamento(id: string, e: Partial<Equipamento>, userId: string) {
  const { data: previous } = await supabase
    .from('equipamentos')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('equipamentos')
    .update({ ...e, updated_at: timestamp, updated_by: userId } as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'equipamentos',
    entity_id: id,
    action: 'edicao',
    old_values: previous,
    new_values: data,
    user_id: userId,
  });

  return data;
}

export async function deleteEquipamento(id: string, userId: string) {
  const { data: previous } = await supabase
    .from('equipamentos')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('equipamentos').delete().eq('id', id);
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'equipamentos',
    entity_id: id,
    action: 'exclusao',
    old_values: previous,
    user_id: userId,
  });
}

// ---- Setores ----
export async function fetchSetores(): Promise<Setor[]> {
  const { data, error } = await supabase
    .from('setores')
    .select('*')
    .order('nome');
  if (error) throw error;
  return data || [];
}

export async function saveSetor(nome: string, userId: string) {
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('setores')
    .insert({ nome, created_by: userId, created_at: timestamp } as any)
    .select()
    .single();
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'setores',
    entity_id: data.id,
    action: 'criacao',
    new_values: data,
    user_id: userId,
  });

  return data;
}

export async function updateSetor(id: string, nome: string, userId: string) {
  const { data: previous } = await supabase
    .from('setores')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('setores')
    .update({ nome, updated_at: timestamp, updated_by: userId } as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'setores',
    entity_id: id,
    action: 'edicao',
    old_values: previous,
    new_values: data,
    user_id: userId,
  });

  return data;
}

export async function deleteSetor(id: string, userId: string) {
  const { data: previous } = await supabase
    .from('setores')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('setores').delete().eq('id', id);
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'setores',
    entity_id: id,
    action: 'exclusao',
    old_values: previous,
    user_id: userId,
  });
}

// ---- Manutenções ----
export async function fetchManutencoes(): Promise<Manutencao[]> {
  const { data, error } = await supabase
    .from('manutencoes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveManutencao(m: Omit<Manutencao, 'id' | 'created_at' | 'updated_at'>, userId: string) {
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('manutencoes')
    .insert({
      ...m,
      created_by: userId,
      created_at: timestamp,
      updated_at: timestamp,
    } as any)
    .select()
    .single();
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'manutencoes',
    entity_id: data.id,
    action: 'criacao',
    new_values: data,
    user_id: userId,
  });

  return data;
}

export async function updateManutencao(id: string, m: Partial<Manutencao>, userId: string) {
  const { data: previous } = await supabase
    .from('manutencoes')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('manutencoes')
    .update({ ...m, updated_at: timestamp, updated_by: userId } as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'manutencoes',
    entity_id: id,
    action: 'edicao',
    old_values: previous,
    new_values: data,
    user_id: userId,
  });

  return data;
}

export async function deleteManutencao(id: string, userId: string) {
  const { data: previous } = await supabase
    .from('manutencoes')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('manutencoes').delete().eq('id', id);
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'manutencoes',
    entity_id: id,
    action: 'exclusao',
    old_values: previous,
    user_id: userId,
  });
}
