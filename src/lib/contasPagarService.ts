import { supabase } from '@/integrations/supabase/client';
import { recordAuditEntry } from '@/lib/audit';

// Types
export interface ContaPagar {
  id: string;
  data_emissao: string;
  empresa_id: string | null;
  empresa_nome: string | null;
  fornecedor_id: string | null;
  fornecedor_nome: string | null;
  valor_total: number;
  quantidade_parcelas: number;
  observacao: string | null;
  status: 'aberto' | 'pago' | 'cancelado';
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
}

export interface ContaPagarParcela {
  id: string;
  conta_pagar_id: string;
  numero_parcela: number;
  valor_parcela: number;
  data_vencimento: string;
  data_pagamento: string | null;
  valor_pago: number | null;
  status: 'aberta' | 'paga' | 'vencida' | 'cancelada';
  observacao: string | null;
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
}

export interface ContaPagarComParcelas extends ContaPagar {
  parcelas: ContaPagarParcela[];
}

// ---- Contas a Pagar ----
export async function fetchContasPagar(): Promise<ContaPagarComParcelas[]> {
  const { data, error } = await supabase
    .from('contas_pagar')
    .select(`
      *,
      contas_pagar_parcelas (
        id,
        numero_parcela,
        valor_parcela,
        data_vencimento,
        data_pagamento,
        valor_pago,
        status,
        observacao
      )
    `)
    .order('data_emissao', { ascending: false });

  if (error) {
    console.error('Erro ao buscar contas a pagar:', error);
    throw new Error('Não foi possível carregar as contas a pagar');
  }

  return (data || []).map((item: any) => ({
    ...item,
    parcelas: (item.contas_pagar_parcelas || []).map((p: any) => ({
      ...p,
      created_by: p.created_by || '',
      created_at: p.created_at || '',
      updated_at: p.updated_at || '',
    })),
  }));
}

export async function saveContaPagar(conta: Omit<ContaPagar, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<ContaPagar> {
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('contas_pagar')
    .insert({ ...conta, created_at: timestamp, updated_at: timestamp } as any)
    .select()
    .single();

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'contas_pagar',
    entity_id: data.id,
    action: 'criacao',
    new_values: data,
    user_id: userId,
  });

  return data;
}

export async function updateContaPagar(id: string, conta: Partial<ContaPagar>, userId: string): Promise<ContaPagar> {
  const { data: previous } = await supabase
    .from('contas_pagar')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('contas_pagar')
    .update({ ...conta, updated_at: new Date().toISOString(), updated_by: userId } as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'contas_pagar',
    entity_id: id,
    action: 'edicao',
    old_values: previous,
    new_values: data,
    user_id: userId,
  });

  return data;
}

export async function deleteContaPagar(id: string, userId: string): Promise<void> {
  const { data: previous } = await supabase
    .from('contas_pagar')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('contas_pagar').delete().eq('id', id);

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'contas_pagar',
    entity_id: id,
    action: 'exclusao',
    old_values: previous,
    user_id: userId,
  });
}

// ---- Parcelas ----
export async function saveParcelas(
  parcelas: Omit<ContaPagarParcela, 'id' | 'created_at' | 'updated_at'>[],
  userId: string
): Promise<ContaPagarParcela[]> {

  const timestamp = new Date().toISOString();

  // 🔥 CORREÇÃO AQUI TAMBÉM (garante que nunca vai string vazia)
  const parcelasCorrigidas = parcelas.map(p => ({
    ...p,
    data_pagamento: p.data_pagamento ? p.data_pagamento : null,
    data_vencimento: p.data_vencimento ? p.data_vencimento : null,
    valor_pago: p.valor_pago ?? null,
    observacao: p.observacao ?? null,
    created_by: userId,
    created_at: timestamp,
    updated_at: timestamp
  }));

  const { data, error } = await supabase
    .from('contas_pagar_parcelas')
    .insert(parcelasCorrigidas as any)
    .select();

  if (error) throw error;

  return data || [];
}

export async function updateParcela(
  id: string,
  parcela: Partial<ContaPagarParcela>,
  userId: string
): Promise<ContaPagarParcela> {

  const { data: previous } = await supabase
    .from('contas_pagar_parcelas')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  // 🔥🔥🔥 CORREÇÃO DEFINITIVA AQUI
  const payload = {
    ...parcela,
    data_pagamento: parcela.data_pagamento ? parcela.data_pagamento : null,
    data_vencimento: parcela.data_vencimento ? parcela.data_vencimento : null,
    valor_pago: parcela.valor_pago ?? null,
    observacao: parcela.observacao ?? null,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  const { data, error } = await supabase
    .from('contas_pagar_parcelas')
    .update(payload as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'contas_pagar_parcelas',
    entity_id: id,
    action: 'edicao',
    old_values: previous,
    new_values: data,
    user_id: userId,
  });

  return data;
}

export async function deleteParcela(id: string, userId: string): Promise<void> {
  const { data: previous } = await supabase
    .from('contas_pagar_parcelas')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('contas_pagar_parcelas').delete().eq('id', id);

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'contas_pagar_parcelas',
    entity_id: id,
    action: 'exclusao',
    old_values: previous,
    user_id: userId,
  });
}

// ---- Funções auxiliares ----
export function gerarParcelas(
  contaPagarId: string,
  valorTotal: number,
  quantidadeParcelas: number,
  dataPrimeiroVencimento: string,
  userId: string
): Omit<ContaPagarParcela, 'id' | 'created_at' | 'updated_at'>[] {

  const parcelas: Omit<ContaPagarParcela, 'id' | 'created_at' | 'updated_at'>[] = [];

  const valorParcela = Math.round((valorTotal / quantidadeParcelas) * 100) / 100;
  const valorUltimaParcela = valorTotal - (valorParcela * (quantidadeParcelas - 1));

  for (let i = 1; i <= quantidadeParcelas; i++) {
    const dataVencimento = new Date(dataPrimeiroVencimento);
    dataVencimento.setMonth(dataVencimento.getMonth() + (i - 1));

    parcelas.push({
      conta_pagar_id: contaPagarId,
      numero_parcela: i,
      valor_parcela: i === quantidadeParcelas ? valorUltimaParcela : valorParcela,
      data_vencimento: dataVencimento.toISOString().split('T')[0],
      data_pagamento: null,
      valor_pago: null,
      status: 'aberta',
      observacao: null,
      created_by: userId,
    });
  }

  return parcelas;
}
