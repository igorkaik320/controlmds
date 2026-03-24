import { supabase } from '@/integrations/supabase/client';

export const MODULES = [
  { key: 'controle_caixa', label: 'Controle de Caixa' },
  { key: 'compras_faturadas', label: 'Compras Faturadas' },
  { key: 'compras_avista', label: 'Compras a Vista' },
  { key: 'espelho_geral', label: 'Espelho Geral' },
  { key: 'programacao_semanal', label: 'Programacao Semanal' },
  { key: 'espelho_semanal', label: 'Espelho Semanal' },
  { key: 'fornecedores', label: 'Fornecedores' },
  { key: 'obras', label: 'Obras' },
  { key: 'responsaveis', label: 'Responsaveis' },
  { key: 'empresas', label: 'Empresas' },
  { key: 'combustivel_dashboard', label: 'Dashboard Combustivel' },
  { key: 'abastecimentos', label: 'Abastecimentos' },
  { key: 'revisoes_combustivel', label: 'Revisoes' },
  { key: 'veiculos_maquinas', label: 'Veiculos/Maquinas' },
  { key: 'postos_combustivel', label: 'Postos de Combustivel' },
  { key: 'tipos_combustivel', label: 'Tipos de Combustivel' },
  { key: 'categorias_veiculos', label: 'Categorias de Veiculos' },
  { key: 'usuarios', label: 'Usuarios' },
  { key: 'auditoria', label: 'Auditoria' },
  { key: 'config_relatorio', label: 'Config. Relatorio' },
] as const;

export type ModuleKey = typeof MODULES[number]['key'];

export const ACTIONS = ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_export'] as const;
export type ActionKey = typeof ACTIONS[number];

export const ACTION_LABELS: Record<ActionKey, string> = {
  can_view: 'Visualizar',
  can_create: 'Criar',
  can_edit: 'Editar',
  can_delete: 'Excluir',
  can_export: 'Exportar',
};

export interface UserActionPermission {
  id: string;
  user_id: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
  granted_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchUserActionPermissions(userId: string): Promise<UserActionPermission[]> {
  const { data, error } = await supabase
    .from('user_action_permissions')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return data || [];
}

export async function fetchAllActionPermissions(): Promise<UserActionPermission[]> {
  const { data, error } = await supabase.from('user_action_permissions').select('*');
  if (error) throw error;
  return data || [];
}

export async function setUserActionPermission(
  userId: string,
  module: string,
  permissions: Partial<Pick<UserActionPermission, 'can_view' | 'can_create' | 'can_edit' | 'can_delete' | 'can_export'>>,
  grantedBy: string
) {
  const { data: existing } = await supabase
    .from('user_action_permissions')
    .select('id')
    .eq('user_id', userId)
    .eq('module', module)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('user_action_permissions')
      .update({ ...permissions, granted_by: grantedBy, updated_at: new Date().toISOString() } as any)
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('user_action_permissions')
      .insert({
        user_id: userId,
        module,
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
        can_export: false,
        ...permissions,
        granted_by: grantedBy,
      } as any);
    if (error) throw error;
  }
}

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
  const perms = await fetchUserActionPermissions(userId);
  const result: Record<string, boolean> = {};
  for (const permission of perms) {
    result[permission.module] = permission.can_view;
  }
  return result;
}

export async function fetchAllPermissions(): Promise<ModulePermission[]> {
  const perms = await fetchAllActionPermissions();
  return perms.map((permission) => ({
    id: permission.id,
    user_id: permission.user_id,
    module: permission.module,
    granted: permission.can_view,
    granted_by: permission.granted_by,
    created_at: permission.created_at,
    updated_at: permission.updated_at,
  }));
}

export async function setModulePermission(userId: string, module: string, granted: boolean, grantedBy: string) {
  await setUserActionPermission(userId, module, { can_view: granted }, grantedBy);
}

export function hasModuleAccess(permissions: Record<string, boolean>, module: ModuleKey, userRole: string): boolean {
  if (userRole === 'admin') return true;
  return permissions[module] === true;
}
