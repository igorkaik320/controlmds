import { supabase } from '@/integrations/supabase/client';

export interface AuditPayload {
  entity_type: string;
  entity_id: string;
  action: 'criacao' | 'edicao' | 'exclusao' | string;
  user_id: string;
  old_values?: any;
  new_values?: any;
}

export async function recordAuditEntry(payload: AuditPayload) {
  const { error } = await supabase.from('audit_log').insert({
    ...payload,
    created_at: new Date().toISOString(),
  } as any);

  if (error) {
    console.error('Erro ao gravar auditoria:', error);
    throw new Error(`Falha ao gravar auditoria: ${error.message}`);
  }
}

