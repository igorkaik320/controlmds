import { supabase } from '@/integrations/supabase/client';
import { recordAuditEntry } from '@/lib/audit';

export type CategoriaFinanceiraTipo = 'receita' | 'despesa';
export type CategoriaFinanceiraNatureza = 'totalizadora' | 'movimento';

export interface CategoriaFinanceira {
  id: string;
  codigo: string;
  nome: string;
  tipo: CategoriaFinanceiraTipo;
  natureza: CategoriaFinanceiraNatureza;
  parent_id: string | null;
  ativa: boolean;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

export async function fetchCategoriasFinanceiras(): Promise<CategoriaFinanceira[]> {
  const { data, error } = await supabase
    .from('categorias_financeiras')
    .select('*')
    .order('codigo', { ascending: true });

  if (error) throw error;
  return (data || []) as CategoriaFinanceira[];
}

export async function saveCategoriaFinanceira(
  categoria: Omit<CategoriaFinanceira, 'id' | 'created_at' | 'updated_at'>,
  userId: string
): Promise<CategoriaFinanceira> {
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('categorias_financeiras')
    .insert({
      ...categoria,
      created_by: userId,
      created_at: timestamp,
      updated_by: userId,
      updated_at: timestamp,
    } as any)
    .select()
    .single();

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'categorias_financeiras',
    entity_id: data.id,
    action: 'criacao',
    new_values: data,
    user_id: userId,
  });

  return data as CategoriaFinanceira;
}

export async function updateCategoriaFinanceira(
  id: string,
  categoria: Partial<CategoriaFinanceira>,
  userId: string
): Promise<CategoriaFinanceira> {
  const { data: previous } = await supabase
    .from('categorias_financeiras')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('categorias_financeiras')
    .update({
      ...categoria,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'categorias_financeiras',
    entity_id: id,
    action: 'edicao',
    old_values: previous,
    new_values: data,
    user_id: userId,
  });

  return data as CategoriaFinanceira;
}

export async function deleteCategoriaFinanceira(id: string, userId: string): Promise<void> {
  const { data: previous } = await supabase
    .from('categorias_financeiras')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('categorias_financeiras')
    .delete()
    .eq('id', id);

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'categorias_financeiras',
    entity_id: id,
    action: 'exclusao',
    old_values: previous,
    user_id: userId,
  });
}

