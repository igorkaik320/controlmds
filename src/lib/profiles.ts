import { supabase } from '@/integrations/supabase/client';

export async function fetchProfileMap(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('profiles').select('user_id, display_name');
  if (error) throw error;

  const map: Record<string, string> = {};
  (data || []).forEach((profile: any) => {
    map[profile.user_id] = profile.display_name || 'Sem nome';
  });

  return map;
}
