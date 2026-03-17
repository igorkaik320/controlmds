import { supabase } from '@/integrations/supabase/client';

export interface Obra {
  id: string;
  nome: string;
  descricao: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function fetchObras(): Promise<Obra[]> {
  const { data, error } = await supabase.from('obras').select('*').order('nome');
  if (error) throw error;
  return data || [];
}

export async function saveObra(nome: string, descricao: string | null, userId: string) {
  const { data, error } = await supabase
    .from('obras')
    .insert({ nome, descricao, created_by: userId } as any)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateObra(id: string, nome: string, descricao: string | null) {
  const { error } = await supabase
    .from('obras')
    .update({ nome, descricao, updated_at: new Date().toISOString() } as any)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteObra(id: string) {
  const { error } = await supabase.from('obras').delete().eq('id', id);
  if (error) throw error;
}
