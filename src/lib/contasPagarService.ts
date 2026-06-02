import { supabase } from '@/integrations/supabase/client';
import { recordAuditEntry } from '@/lib/audit';
import type { ContaPagarParcelaAnexo } from '@/lib/contasPagarAnexosService';

// Types
export interface ContaPagar {
  id: string;
  numero: number;
  origem: 'CP' | 'CF' | 'CA';
  origem_id: string | null;
  data_emissao: string;
  data_primeiro_vencimento: string | null;
  empresa_id: string | null;
  empresa_nome: string | null;
  fornecedor_id: string | null;
  fornecedor_nome: string | null;
  obra_id: string | null;
  obra_nome: string | null;
  categoria_financeira_id: string | null;
  categoria_codigo: string | null;
  categoria_nome: string | null;
  tag_id?: string | null;
  tag_nome?: string | null;
  tag_cor?: string | null;
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
  conta_corrente_id?: string | null;
  status: 'aberta' | 'paga' | 'vencida' | 'cancelada';
  observacao: string | null;
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
  anexos?: ContaPagarParcelaAnexo[];
}

export interface ContaPagarComParcelas extends ContaPagar {
  parcelas: ContaPagarParcela[];
}

function dedupeParcelasPorNumero(parcelas: ContaPagarParcela[]): ContaPagarParcela[] {
  const parcelasPorNumero = new Map<number, ContaPagarParcela>();

  [...parcelas]
    .sort((a, b) => {
      if (a.numero_parcela !== b.numero_parcela) return a.numero_parcela - b.numero_parcela;
      return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
    })
    .forEach((parcela) => {
      if (!parcelasPorNumero.has(parcela.numero_parcela)) {
        parcelasPorNumero.set(parcela.numero_parcela, parcela);
      }
    });

  return Array.from(parcelasPorNumero.values()).sort((a, b) => a.numero_parcela - b.numero_parcela);
}

// ---- Contas a Pagar ----
export async function fetchContasPagar(): Promise<ContaPagarComParcelas[]> {
  const selectBase = `
      *,
      contas_pagar_parcelas (
        id,
        numero_parcela,
        valor_parcela,
        data_vencimento,
        data_pagamento,
        valor_pago,
        conta_corrente_id,
        status,
        observacao,
        created_by,
        created_at,
        updated_by,
        updated_at
      )
    `;
  const selectComAnexos = `
      *,
      contas_pagar_parcelas (
        id,
        numero_parcela,
        valor_parcela,
        data_vencimento,
        data_pagamento,
        valor_pago,
        conta_corrente_id,
        status,
        observacao,
        created_by,
        created_at,
        updated_by,
        updated_at,
        contas_pagar_parcela_anexos (
          id,
          parcela_id,
          nome_arquivo,
          nome_exibicao,
          caminho_storage,
          tipo_arquivo,
          tamanho_bytes,
          created_by,
          created_at
        )
      )
    `;

  let { data, error } = await supabase
    .from('contas_pagar')
    .select(selectComAnexos)
    .order('created_at', { ascending: false });

  if (error && String(error.message || '').includes('contas_pagar_parcela_anexos')) {
    const fallback = await supabase
      .from('contas_pagar')
      .select(selectBase)
      .order('created_at', { ascending: false });

    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error('Erro ao buscar contas a pagar:', error);
    throw new Error('Não foi possível carregar as contas a pagar');
  }

  return (data || []).map((item: any) => {
    const parcelas = (item.contas_pagar_parcelas || []).map((p: any) => ({
      ...p,
      created_by: p.created_by || '',
      created_at: p.created_at || '',
      updated_by: p.updated_by || null,
      updated_at: p.updated_at || '',
      conta_corrente_id: p.conta_corrente_id || null,
      anexos: p.contas_pagar_parcela_anexos || [],
    }));

    return {
      ...item,
      origem: item.origem || 'CP',
      origem_id: item.origem_id || null,
      parcelas: dedupeParcelasPorNumero(parcelas),
    };
  });
}

export async function marcarParcelasVencidas(userId?: string): Promise<void> {
  const hoje = new Date().toISOString().split('T')[0];

  const { error } = await supabase
    .from('contas_pagar_parcelas')
    .update({
      status: 'vencida',
      updated_at: new Date().toISOString(),
      ...(userId ? { updated_by: userId } : {}),
    } as any)
    .eq('status', 'aberta')
    .lt('data_vencimento', hoje);

  if (error) throw error;
}

export async function saveContaPagar(
  conta: Omit<ContaPagar, 'id' | 'numero' | 'created_at' | 'updated_at'>,
  userId: string
): Promise<ContaPagar> {
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

export async function updateContaPagar(
  id: string,
  conta: Partial<ContaPagar>,
  userId: string
): Promise<ContaPagar> {
  const { data: previous } = await supabase
    .from('contas_pagar')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { id: _id, numero: _numero, created_by: _createdBy, created_at: _createdAt, ...safeConta } = conta as Partial<ContaPagar> & {
    id?: string;
    numero?: number;
  };

  const { data, error } = await supabase
    .from('contas_pagar')
    .update({
      ...safeConta,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    } as any)
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

  const { error } = await supabase
    .from('contas_pagar')
    .delete()
    .eq('id', id);

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
type ParcelaInsertPayload = Omit<ContaPagarParcela, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string | null;
};

export async function updateParcela(
  id: string,
  parcela: Partial<ContaPagarParcela>,
  userId: string
): Promise<ContaPagarParcela> {
  const payload: any = {
    conta_pagar_id: parcela.conta_pagar_id,
    numero_parcela: parcela.numero_parcela,
    valor_parcela: parcela.valor_parcela,
    data_vencimento: parcela.data_vencimento || null,
    data_pagamento: parcela.data_pagamento || null,
    valor_pago: parcela.valor_pago ?? null,
    conta_corrente_id: parcela.conta_corrente_id ?? null,
    status: parcela.status,
    observacao: parcela.observacao || null,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });

  const { data, error } = await supabase
    .from('contas_pagar_parcelas')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function saveParcelas(
  parcelas: ParcelaInsertPayload[],
  userId: string
): Promise<ContaPagarParcela[]> {
  const timestamp = new Date().toISOString();

  const parcelasLimpas = parcelas.map(({ id: _id, anexos: _anexos, ...p }) => ({
    ...p,
    data_vencimento: p.data_vencimento || null,
    data_pagamento: p.data_pagamento || null,
    valor_pago: p.valor_pago ?? null,
    conta_corrente_id: p.conta_corrente_id ?? null,
    observacao: p.observacao || null,
    created_by: p.created_by || userId,
    created_at: p.created_at || timestamp,
    updated_at: timestamp,
    updated_by: userId,
  }));

  const { data, error } = await supabase
    .from('contas_pagar_parcelas')
    .insert(parcelasLimpas as any)
    .select();

  if (error) throw error;
  return data || [];
}

export async function replaceParcelasConta(
  contaPagarId: string,
  parcelas: ParcelaInsertPayload[],
  userId: string
): Promise<ContaPagarParcela[]> {
  const { data: existentes, error: existentesError } = await supabase
    .from('contas_pagar_parcelas')
    .select('*')
    .eq('conta_pagar_id', contaPagarId);

  if (existentesError) throw existentesError;

  const existentesPorId = new Map<string, ContaPagarParcela>();
  const existentesPorNumero = new Map<number, ContaPagarParcela>();
  ((existentes || []) as ContaPagarParcela[]).forEach((parcela) => {
    existentesPorId.set(parcela.id, parcela);
    if (!existentesPorNumero.has(parcela.numero_parcela)) {
      existentesPorNumero.set(parcela.numero_parcela, parcela);
    }
  });

  const parcelasPorNumero = new Map<number, ParcelaInsertPayload>();

  parcelas
    .filter((parcela) => parcela.conta_pagar_id === contaPagarId)
    .forEach((parcela) => {
      parcelasPorNumero.set(parcela.numero_parcela, parcela);
    });

  const normalizadas = Array.from(parcelasPorNumero.values())
    .sort((a, b) => a.numero_parcela - b.numero_parcela)
    .map((parcela, index) => ({
      ...parcela,
      conta_pagar_id: contaPagarId,
      numero_parcela: index + 1,
      created_by: existentesPorId.get(parcela.id || '')?.created_by
        || existentesPorNumero.get(parcela.numero_parcela)?.created_by
        || parcela.created_by
        || userId,
      created_at: existentesPorId.get(parcela.id || '')?.created_at
        || existentesPorNumero.get(parcela.numero_parcela)?.created_at
        || parcela.created_at
        || null,
    }));

  const { error: deleteError } = await supabase
    .from('contas_pagar_parcelas')
    .delete()
    .eq('conta_pagar_id', contaPagarId);

  if (deleteError) throw deleteError;
  if (normalizadas.length === 0) return [];

  return saveParcelas(normalizadas, userId);
}

export async function deleteParcela(id: string, userId: string): Promise<void> {
  const { data: previous } = await supabase
    .from('contas_pagar_parcelas')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('contas_pagar_parcelas')
    .delete()
    .eq('id', id);

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'contas_pagar_parcelas',
    entity_id: id,
    action: 'exclusao',
    old_values: previous,
    user_id: userId,
  });
}

// Atualizar status de múltiplas parcelas de uma vez
export async function updateParcelasStatus(
  ids: string[],
  status: string,
  userId: string
): Promise<void> {
  if (status !== 'paga') {
    await (supabase as any)
      .from('contas_correntes_movimentacoes')
      .delete()
      .eq('origem_tipo', 'contas_pagar_parcela')
      .in('origem_id', ids);
  }

  const { error } = await supabase
    .from('contas_pagar_parcelas')
    .update({ 
      status, 
      updated_at: new Date().toISOString(), 
      updated_by: userId,
      ...(status !== 'paga' ? { data_pagamento: null, conta_corrente_id: null } : {}),
    } as any)
    .in('id', ids);

  if (error) throw error;
}

export async function pagarParcelaContaPagar(
  parcelaId: string,
  dataPagamento: string,
  contaCorrenteId: string,
  userId: string
): Promise<void> {
  const { data: parcela, error: parcelaError } = await (supabase as any)
    .from('contas_pagar_parcelas')
    .select('*, contas_pagar (fornecedor_nome, observacao)')
    .eq('id', parcelaId)
    .single();

  if (parcelaError) throw parcelaError;

  await (supabase as any)
    .from('contas_correntes_movimentacoes')
    .delete()
    .eq('origem_tipo', 'contas_pagar_parcela')
    .eq('origem_id', parcelaId);

  const { error: updateError } = await (supabase as any)
    .from('contas_pagar_parcelas')
    .update({
      status: 'paga',
      data_pagamento: dataPagamento,
      conta_corrente_id: contaCorrenteId,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', parcelaId);

  if (updateError) throw updateError;

  const fornecedor = parcela?.contas_pagar?.fornecedor_nome || 'Conta a pagar';
  const observacao = parcela?.contas_pagar?.observacao ? ` - ${parcela.contas_pagar.observacao}` : '';
  const { error: movimentoError } = await (supabase as any)
    .from('contas_correntes_movimentacoes')
    .insert({
      conta_corrente_id: contaCorrenteId,
      origem_tipo: 'contas_pagar_parcela',
      origem_id: parcelaId,
      tipo: 'saida',
      data_movimentacao: dataPagamento,
      valor: -Math.abs(Number(parcela.valor_parcela || 0)),
      descricao: `Pagamento - ${fornecedor}${observacao}`,
      created_by: userId,
    });

  if (movimentoError) throw movimentoError;

  await recordAuditEntry({
    entity_type: 'contas_pagar_parcelas',
    entity_id: parcelaId,
    action: 'baixa',
    old_values: parcela,
    new_values: {
      status: 'paga',
      data_pagamento: dataPagamento,
      conta_corrente_id: contaCorrenteId,
    },
    user_id: userId,
  });
}

// ---- Gerar Parcelas ----
export function gerarParcelas(
  contaPagarId: string,
  valorTotal: number,
  quantidadeParcelas: number,
  dataPrimeiroVencimento: string,
  userId: string
): Omit<ContaPagarParcela, 'id' | 'created_at' | 'updated_at'>[] {
  const parcelas = [];
  const valorParcela = Math.round((valorTotal / quantidadeParcelas) * 100) / 100;
  const valorUltima = Math.round((valorTotal - (valorParcela * (quantidadeParcelas - 1))) * 100) / 100;

  for (let i = 1; i <= quantidadeParcelas; i++) {
    const data = new Date(`${dataPrimeiroVencimento}T00:00:00`);
    data.setMonth(data.getMonth() + (i - 1));

    parcelas.push({
      conta_pagar_id: contaPagarId,
      numero_parcela: i,
      valor_parcela: i === quantidadeParcelas ? valorUltima : valorParcela,
      data_vencimento: data.toISOString().split('T')[0],
      data_pagamento: null,
      valor_pago: null,
      conta_corrente_id: null,
      status: 'aberta' as const,
      observacao: null,
      created_by: userId,
    });
  }

  return parcelas;
}


