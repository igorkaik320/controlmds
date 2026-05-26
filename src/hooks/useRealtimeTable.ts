import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Escuta INSERT/UPDATE/DELETE em uma tabela do Supabase via Realtime.
 * Quando qualquer linha muda (por você ou outro usuário), chama `onChange()`.
 *
 * Pré-requisito: a tabela precisa estar na publicação `supabase_realtime`.
 * Rode no SQL editor:
 *   ALTER PUBLICATION supabase_realtime ADD TABLE public.<tabela>;
 */
export function useRealtimeTable(table: string, onChange: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-${table}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        () => onChange()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // onChange deve vir de useCallback no componente; assumimos referência estável
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);
}
