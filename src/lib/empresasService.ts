import { supabase } from '@/integrations/supabase/client';

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string | null;
  logo_esquerda: string | null;
  logo_direita: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function fetchEmpresas(): Promise<Empresa[]> {
  const { data, error } = await supabase.from('empresas').select('*').order('nome');
  if (error) throw error;
  return data || [];
}

export async function fetchEmpresaById(id: string): Promise<Empresa | null> {
  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function saveEmpresa(
  empresa: {
    nome: string;
    cnpj?: string | null;
    logo_esquerda?: string | null;
    logo_direita?: string | null;
  },
  userId: string
) {
  const { data, error } = await supabase
    .from('empresas')
    .insert({ ...empresa, created_by: userId } as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEmpresa(id: string, empresa: Partial<Empresa>) {
  const { error } = await supabase
    .from('empresas')
    .update({ ...empresa, updated_at: new Date().toISOString() } as any)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteEmpresa(id: string) {
  const { error } = await supabase.from('empresas').delete().eq('id', id);
  if (error) throw error;
}
