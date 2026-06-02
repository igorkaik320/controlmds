import { supabase } from '@/integrations/supabase/client';
import { recordAuditEntry } from '@/lib/audit';

const BUCKET = 'contas-pagar-anexos';

export interface ContaPagarParcelaAnexo {
  id: string;
  parcela_id: string;
  nome_arquivo: string;
  nome_exibicao: string | null;
  caminho_storage: string;
  tipo_arquivo: string | null;
  tamanho_bytes: number | null;
  created_by: string | null;
  created_at: string;
}

function sanitizeFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'arquivo';
}

export async function fetchAnexosParcelas(parcelaIds: string[]): Promise<ContaPagarParcelaAnexo[]> {
  const ids = parcelaIds.filter(Boolean);
  if (ids.length === 0) return [];

  const { data, error } = await (supabase as any)
    .from('contas_pagar_parcela_anexos')
    .select('*')
    .in('parcela_id', ids)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ContaPagarParcelaAnexo[];
}

export async function uploadParcelaAnexo(
  parcelaId: string,
  file: File,
  userId: string
): Promise<ContaPagarParcelaAnexo> {
  const safeName = sanitizeFileName(file.name);
  const path = `${parcelaId}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) throw uploadError;

  const { data, error } = await (supabase as any)
    .from('contas_pagar_parcela_anexos')
    .insert({
      parcela_id: parcelaId,
      nome_arquivo: file.name,
      nome_exibicao: file.name,
      caminho_storage: path,
      tipo_arquivo: file.type || null,
      tamanho_bytes: file.size,
      created_by: userId,
    } as any)
    .select()
    .single();

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'contas_pagar_parcela_anexos',
    entity_id: data.id,
    action: 'criacao',
    new_values: data,
    user_id: userId,
  });

  return data as ContaPagarParcelaAnexo;
}

export async function renameParcelaAnexo(
  anexo: ContaPagarParcelaAnexo,
  nomeExibicao: string,
  userId: string
): Promise<ContaPagarParcelaAnexo> {
  const nextName = nomeExibicao.trim();
  if (!nextName) throw new Error('Informe um nome para o anexo.');

  const { data, error } = await (supabase as any)
    .from('contas_pagar_parcela_anexos')
    .update({ nome_exibicao: nextName })
    .eq('id', anexo.id)
    .select()
    .maybeSingle();

  if (error) throw error;
  const updated = (data || { ...anexo, nome_exibicao: nextName }) as ContaPagarParcelaAnexo;

  await recordAuditEntry({
    entity_type: 'contas_pagar_parcela_anexos',
    entity_id: anexo.id,
    action: 'edicao',
    old_values: anexo,
    new_values: updated,
    user_id: userId,
  });

  return updated;
}

export async function getParcelaAnexoUrl(anexo: ContaPagarParcelaAnexo): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(anexo.caminho_storage, 60);

  if (error) throw error;
  return data.signedUrl;
}

export async function deleteParcelaAnexo(anexo: ContaPagarParcelaAnexo, userId: string): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([anexo.caminho_storage]);

  if (storageError) throw storageError;

  const { error } = await (supabase as any)
    .from('contas_pagar_parcela_anexos')
    .delete()
    .eq('id', anexo.id);

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'contas_pagar_parcela_anexos',
    entity_id: anexo.id,
    action: 'exclusao',
    old_values: anexo,
    user_id: userId,
  });
}
