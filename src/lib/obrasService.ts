import { supabase } from '@/integrations/supabase/client';
import { recordAuditEntry } from '@/lib/audit';

export interface Obra {
  id: string;
  nome: string;
  descricao: string | null;
  empresa_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function fetchObras(): Promise<Obra[]> {
  const { data, error } = await supabase.from('obras').select('*').order('nome');
  if (error) throw error;
  return data || [];
}

export async function fetchObrasPorEmpresa(empresaId: string): Promise<Obra[]> {
  const { data, error } = await supabase
    .from('obras')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('nome');
  if (error) throw error;
  return data || [];
}

export async function saveObra(nome: string, descricao: string | null, userId: string, empresaId?: string | null) {
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('obras')
    .insert({
      nome,
      descricao,
      empresa_id: empresaId || null,
      created_by: userId,
      created_at: timestamp,
    } as any)
    .select()
    .single();
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'obras',
    entity_id: data.id,
    action: 'criacao',
    new_values: data,
    user_id: userId,
  });

  return data;
}

export async function updateObra(
  id: string,
  nome: string,
  descricao: string | null,
  userId: string,
  empresaId?: string | null
) {
  const { data: previous } = await supabase
    .from('obras')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('obras')
    .update({
      nome,
      descricao,
      empresa_id: empresaId || null,
      updated_at: timestamp,
      updated_by: userId,
    } as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'obras',
    entity_id: id,
    action: 'edicao',
    old_values: previous,
    new_values: data,
    user_id: userId,
  });

  return data;
}

export async function deleteObra(id: string, userId: string) {
  const { data: previous } = await supabase
    .from('obras')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('obras').delete().eq('id', id);
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'obras',
    entity_id: id,
    action: 'exclusao',
    old_values: previous,
    user_id: userId,
  });
}
