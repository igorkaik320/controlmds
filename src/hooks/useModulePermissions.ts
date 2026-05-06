import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import {
  fetchUserActionPermissions,
  hasModuleAccess,
  type ActionKey,
  type ModuleKey,
  type UserActionPermission,
} from '@/lib/modulePermissions';

export {
  ACTION_LABELS,
  ACTIONS,
  MODULES,
  fetchAllActionPermissions,
  fetchAllPermissions,
  fetchUserActionPermissions,
  fetchUserPermissions,
  hasModuleAccess,
  setModulePermission,
  setUserActionPermission,
} from '@/lib/modulePermissions';

export type {
  ActionKey,
  ModuleKey,
  ModulePermission,
  UserActionPermission,
} from '@/lib/modulePermissions';

export function useModulePermissions() {
  const { user, userRole } = useAuth();
  const userId = user?.id ?? null;

  const { data: actionPermissions = [], isLoading } = useQuery({
    queryKey: ['user-action-permissions', userId],
    queryFn: () => fetchUserActionPermissions(userId!),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const permissions = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const p of actionPermissions) map[p.module] = p.can_view;
    return map;
  }, [actionPermissions]);

  const loading = !!userId && isLoading;

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
