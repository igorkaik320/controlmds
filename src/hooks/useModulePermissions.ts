import { useState, useEffect } from 'react';
import { fetchUserActionPermissions, UserActionPermission, ModuleKey, ActionKey } from '@/lib/modulePermissions';
import { useAuth } from '@/lib/auth';

export interface ActionPermissions {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
}

const ALL_GRANTED: ActionPermissions = {
  can_view: true,
  can_create: true,
  can_edit: true,
  can_delete: true,
  can_export: true,
};

const ALL_DENIED: ActionPermissions = {
  can_view: false,
  can_create: false,
  can_edit: false,
  can_delete: false,
  can_export: false,
};

export function useModulePermissions() {
  const { user, userRole, loading: authLoading } = useAuth();
  const [permissionsMap, setPermissionsMap] = useState<Record<string, ActionPermissions>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      setLoading(false);
      return;
    }
    if (userRole === 'admin') {
      setLoading(false);
      return;
    }
    fetchUserActionPermissions(user.id)
      .then((perms) => {
        const map: Record<string, ActionPermissions> = {};
        for (const p of perms) {
          map[p.module] = {
            can_view: p.can_view,
            can_create: p.can_create,
            can_edit: p.can_edit,
            can_delete: p.can_delete,
            can_export: p.can_export,
          };
        }
        setPermissionsMap(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, userRole, authLoading]);

  function getPermissions(module: ModuleKey): ActionPermissions {
    if (userRole === 'admin') return ALL_GRANTED;
    return permissionsMap[module] || ALL_DENIED;
  }

  // Legacy compat
  const canAccess = (module: ModuleKey) => getPermissions(module).can_view;

  const canView = (module: ModuleKey) => getPermissions(module).can_view;
  const canCreate = (module: ModuleKey) => getPermissions(module).can_create;
  const canEdit = (module: ModuleKey) => getPermissions(module).can_edit;
  const canDelete = (module: ModuleKey) => getPermissions(module).can_delete;
  const canExport = (module: ModuleKey) => getPermissions(module).can_export;

  // Legacy compat
  const permissions: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(permissionsMap)) {
    permissions[k] = v.can_view;
  }

  return {
    permissions,
    permissionsMap,
    loading: loading || authLoading,
    canAccess,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canExport,
    getPermissions,
  };
}
