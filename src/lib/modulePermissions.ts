import { supabase } from '@/integrations/supabase/client';

export const MODULES = [
  { key: 'controle_caixa', label: 'Controle de Caixa' },
  { key: 'compras_faturadas', label: 'Compras Faturadas' },
  { key: 'compras_avista', label: 'Compras à Vista' },
  { key: 'espelho_geral', label: 'Espelho Geral' },
  { key: 'programacao_semanal', label: 'Programação Semanal' },
  { key: 'espelho_semanal', label: 'Espelho Semanal' },
  { key: 'fornecedores', label: 'Fornecedores' },
  { key: 'obras', label: 'Obras' },
  { key: 'responsaveis', label: 'Responsáveis' },
] as const;

export type ModuleKey = typeof MODULES[number]['key'];

export interface ModulePermission {
  id: string;
  user_id: string;
  module: string;
  granted: boolean;
  granted_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchUserPermissions(userId: string): Promise<Record<string, boolean>> {
  const { data, error } = await supabase
    .from('module_permissions')
    .select('module, granted')
    .eq('user_id', userId);
  if (error) throw error;
  const perms: Record<string, boolean> = {};
  for (const p of data || []) {
    perms[p.module] = p.granted;
  }
  return perms;
}

export async function fetchAllPermissions(): Promise<ModulePermission[]> {
  const { data, error } = await supabase.from('module_permissions').select('*');
  if (error) throw error;
  return data || [];
}

export async function setModulePermission(userId: string, module: string, granted: boolean, grantedBy: string) {
  const { data: existing } = await supabase
    .from('module_permissions')
    .select('id')
    .eq('user_id', userId)
    .eq('module', module)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('module_permissions')
      .update({ granted, granted_by: grantedBy, updated_at: new Date().toISOString() } as any)
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('module_permissions')
      .insert({ user_id: userId, module, granted, granted_by: grantedBy } as any);
    if (error) throw error;
  }
}

export function hasModuleAccess(permissions: Record<string, boolean>, module: ModuleKey, userRole: string): boolean {
  if (userRole === 'admin') return true;
  return permissions[module] === true;
}
