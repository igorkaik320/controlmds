import { supabase } from '@/integrations/supabase/client';
import { recordAuditEntry } from '@/lib/audit';

export interface ContaCorrente {
  id: string;
  banco: string;
  agencia: string;
  numero_conta: string;
  digito_verificador: string | null;
  data_saldo_inicial: string;
  saldo_inicial: number;
  saldo_atual?: number;
  ativa: boolean;
  observacao: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchContasCorrentes(): Promise<ContaCorrente[]> {
  const { data, error } = await (supabase as any)
    .from('contas_correntes')
    .select('*')
    .order('banco', { ascending: true })
    .order('agencia', { ascending: true });

  if (error) throw error;
  const contas = (data || []) as ContaCorrente[];
  if (contas.length === 0) return [];

  const { data: movimentos, error: movimentosError } = await (supabase as any)
    .from('contas_correntes_movimentacoes')
    .select('conta_corrente_id, valor')
    .in('conta_corrente_id', contas.map((conta) => conta.id));

  if (movimentosError) {
    if (String(movimentosError.message || '').includes('contas_correntes_movimentacoes')) {
      return contas.map((conta) => ({ ...conta, saldo_atual: Number(conta.saldo_inicial || 0) }));
    }
    throw movimentosError;
  }

  const saldoMovimentos = new Map<string, number>();
  (movimentos || []).forEach((movimento: any) => {
    saldoMovimentos.set(
      movimento.conta_corrente_id,
      (saldoMovimentos.get(movimento.conta_corrente_id) || 0) + Number(movimento.valor || 0)
    );
  });

  return contas.map((conta) => ({
    ...conta,
    saldo_atual: Number(conta.saldo_inicial || 0) + (saldoMovimentos.get(conta.id) || 0),
  }));
}

export async function saveContaCorrente(
  conta: Omit<ContaCorrente, 'id' | 'created_at' | 'updated_at'>,
  userId: string
): Promise<ContaCorrente> {
  const timestamp = new Date().toISOString();
  const { data, error } = await (supabase as any)
    .from('contas_correntes')
    .insert({
      ...conta,
      created_by: userId,
      updated_by: userId,
      created_at: timestamp,
      updated_at: timestamp,
    } as any)
    .select()
    .single();

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'contas_correntes',
    entity_id: data.id,
    action: 'criacao',
    new_values: data,
    user_id: userId,
  });

  return data as ContaCorrente;
}

export async function updateContaCorrente(
  id: string,
  conta: Partial<ContaCorrente>,
  userId: string
): Promise<ContaCorrente> {
  const { data: previous } = await (supabase as any)
    .from('contas_correntes')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const {
    id: _id,
    created_by: _createdBy,
    created_at: _createdAt,
    ...safeConta
  } = conta as Partial<ContaCorrente> & { id?: string };

  const { data, error } = await (supabase as any)
    .from('contas_correntes')
    .update({
      ...safeConta,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'contas_correntes',
    entity_id: id,
    action: 'edicao',
    old_values: previous,
    new_values: data,
    user_id: userId,
  });

  return data as ContaCorrente;
}

export async function deleteContaCorrente(id: string, userId: string): Promise<void> {
  const { data: previous } = await (supabase as any)
    .from('contas_correntes')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await (supabase as any)
    .from('contas_correntes')
    .delete()
    .eq('id', id);

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'contas_correntes',
    entity_id: id,
    action: 'exclusao',
    old_values: previous,
    user_id: userId,
  });
}
