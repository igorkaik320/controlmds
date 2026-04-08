import { useState, useEffect, useCallback } from 'react';
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
