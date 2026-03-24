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
  { key: 'empresas', label: 'Empresas' },
  { key: 'combustivel_dashboard', label: 'Dashboard Combustível' },
  { key: 'abastecimentos', label: 'Abastecimentos' },
  { key: 'revisoes_combustivel', label: 'Revisoes' },
  { key: 'veiculos_maquinas', label: 'Veículos/Máquinas' },
  { key: 'postos_combustivel', label: 'Postos de Combustível' },
  { key: 'tipos_combustivel', label: 'Tipos de Combustível' },
  { key: 'categorias_veiculos', label: 'Categorias de Veículos' },
  { key: 'usuarios', label: 'Usuários' },
  { key: 'auditoria', label: 'Auditoria' },
  { key: 'config_relatorio', label: 'Config. Relatório' },
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

// Legacy compat
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
  for (const p of perms) {
    result[p.module] = p.can_view;
  }
  return result;
}

export async function fetchAllPermissions(): Promise<ModulePermission[]> {
  const perms = await fetchAllActionPermissions();
  return perms.map(p => ({
    id: p.id,
    user_id: p.user_id,
    module: p.module,
    granted: p.can_view,
    granted_by: p.granted_by,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));
}

export async function setModulePermission(userId: string, module: string, granted: boolean, grantedBy: string) {
  await setUserActionPermission(userId, module, { can_view: granted }, grantedBy);
}

export function hasModuleAccess(permissions: Record<string, boolean>, module: ModuleKey, userRole: string): boolean {
  if (userRole === 'admin') return true;
  return permissions[module] === true;
}

// React hook
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';

export function useModulePermissions() {
  const { user, userRole } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [actionPermissions, setActionPermissions] = useState<UserActionPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      setPermissions({});
      setActionPermissions([]);
      setLoading(false);
      return;
    }

    fetchUserActionPermissions(userId)
      .then((perms) => {
        const map: Record<string, boolean> = {};
        for (const p of perms) {
          map[p.module] = p.can_view;
        }
        setPermissions(map);
        setActionPermissions(perms);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const canAccess = useCallback(
    (module: ModuleKey) => hasModuleAccess(permissions, module, userRole || ''),
    [permissions, userRole]
  );

  const getActionPerm = useCallback(
    (module: string, action: ActionKey): boolean => {
      if (userRole === 'admin') return true;
      const perm = actionPermissions.find((p) => p.module === module);
      return perm ? perm[action] : false;
    },
    [actionPermissions, userRole]
  );

  const canView = useCallback((module: string) => getActionPerm(module, 'can_view'), [getActionPerm]);
  const canCreate = useCallback((module: string) => getActionPerm(module, 'can_create'), [getActionPerm]);
  const canEdit = useCallback((module: string) => getActionPerm(module, 'can_edit'), [getActionPerm]);
  const canDelete = useCallback((module: string) => getActionPerm(module, 'can_delete'), [getActionPerm]);
  const canExport = useCallback((module: string) => getActionPerm(module, 'can_export'), [getActionPerm]);

  return { permissions, actionPermissions, loading, canAccess, canView, canCreate, canEdit, canDelete, canExport };
}
