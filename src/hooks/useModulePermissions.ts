import { useState, useEffect } from 'react';
import { fetchUserPermissions, hasModuleAccess, ModuleKey } from '@/lib/modulePermissions';
import { useAuth } from '@/lib/auth';

export function useModulePermissions() {
  const { user, userRole, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) { setLoading(false); return; }
    if (userRole === 'admin') { setLoading(false); return; }
    fetchUserPermissions(user.id)
      .then(setPermissions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, userRole, authLoading]);

  const canAccess = (module: ModuleKey) => hasModuleAccess(permissions, module, userRole);

  return { permissions, loading: loading || authLoading, canAccess };
}
