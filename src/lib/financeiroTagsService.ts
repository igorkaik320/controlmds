import { supabase } from '@/integrations/supabase/client';
import { recordAuditEntry } from '@/lib/audit';

export interface FinanceiroTag {
  id: string;
  nome: string;
  cor: string;
  ativa: boolean;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

export async function fetchFinanceiroTags(): Promise<FinanceiroTag[]> {
  const { data, error } = await supabase
    .from('financeiro_tags')
    .select('*')
    .order('nome', { ascending: true });

  if (error) throw error;
  return (data || []) as FinanceiroTag[];
}

export async function saveFinanceiroTag(
  tag: Omit<FinanceiroTag, 'id' | 'created_at' | 'updated_at'>,
  userId: string
): Promise<FinanceiroTag> {
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('financeiro_tags')
    .insert({
      ...tag,
      created_by: userId,
      created_at: timestamp,
      updated_by: userId,
      updated_at: timestamp,
    } as any)
    .select()
    .single();

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'financeiro_tags',
    entity_id: data.id,
    action: 'criacao',
    new_values: data,
    user_id: userId,
  });

  return data as FinanceiroTag;
}

export async function updateFinanceiroTag(
  id: string,
  tag: Partial<FinanceiroTag>,
  userId: string
): Promise<FinanceiroTag> {
  const { data: previous } = await supabase
    .from('financeiro_tags')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('financeiro_tags')
    .update({
      ...tag,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'financeiro_tags',
    entity_id: id,
    action: 'edicao',
    old_values: previous,
    new_values: data,
    user_id: userId,
  });

  return data as FinanceiroTag;
}

export async function deleteFinanceiroTag(id: string, userId: string): Promise<void> {
  const { data: previous } = await supabase
    .from('financeiro_tags')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('financeiro_tags')
    .delete()
    .eq('id', id);

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'financeiro_tags',
    entity_id: id,
    action: 'exclusao',
    old_values: previous,
    user_id: userId,
  });
}
