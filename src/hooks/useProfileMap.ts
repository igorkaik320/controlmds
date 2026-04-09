import { useEffect, useState } from 'react';
import { fetchProfileMap } from '@/lib/profiles';

export function useProfileMap() {
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    fetchProfileMap()
      .then((map) => {
        if (mounted) setProfileMap(map);
      })
      .catch(() => {
        if (mounted) setProfileMap({});
      });
    return () => {
      mounted = false;
    };
  }, []);

  return profileMap;
}
