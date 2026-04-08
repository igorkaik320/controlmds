import { supabase } from '@/integrations/supabase/client';

export interface Equipamento {
  id: string;
  nome: string;
  marca?: string;
  modelo?: string;
  setor_id?: string;
  setor_nome?: string;
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
  console.log('Buscando equipamentos...');
  const { data, error } = await supabase
    .from('equipamentos')
    .select('*')
    .order('nome');
  if (error) {
    console.error('Erro ao buscar equipamentos:', error);
    throw error;
  }
  console.log('Equipamentos encontrados:', data);
  return data || [];
}

export async function saveEquipamento(e: Omit<Equipamento, 'id' | 'created_at' | 'updated_at'>, userId: string) {
  console.log('Salvando equipamento:', e, 'userId:', userId);
  
  // Buscar nome do setor se fornecido
  let setorNome = null;
  if (e.setor_id) {
    const { data: setorData } = await supabase
      .from('setores')
      .select('nome')
      .eq('id', e.setor_id)
      .single();
    setorNome = setorData?.nome || null;
  }
  
  const { data, error } = await supabase
    .from('equipamentos')
    .insert({ 
      ...e, 
      setor_nome: setorNome,
      created_by: userId 
    } as any)
    .select()
    .single();
  if (error) {
    console.error('Erro ao salvar equipamento:', error);
    throw error;
  }
  console.log('Equipamento salvo:', data);
  return data;
}

export async function updateEquipamento(id: string, e: Partial<Equipamento>) {
  const { error } = await supabase
    .from('equipamentos')
    .update({ ...e, updated_at: new Date().toISOString() } as any)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteEquipamento(id: string) {
  const { error } = await supabase.from('equipamentos').delete().eq('id', id);
  if (error) throw error;
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
  const { data, error } = await supabase
    .from('setores')
    .insert({ nome, created_by: userId } as any)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSetor(id: string, nome: string) {
  const { error } = await supabase
    .from('setores')
    .update({ nome, updated_at: new Date().toISOString() } as any)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSetor(id: string) {
  const { error } = await supabase.from('setores').delete().eq('id', id);
  if (error) throw error;
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
  const { data, error } = await supabase
    .from('manutencoes')
    .insert({ ...m, created_by: userId } as any)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateManutencao(id: string, m: Partial<Manutencao>) {
  const { error } = await supabase
    .from('manutencoes')
    .update({ ...m, updated_at: new Date().toISOString() } as any)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteManutencao(id: string) {
  const { error } = await supabase.from('manutencoes').delete().eq('id', id);
  if (error) throw error;
}
