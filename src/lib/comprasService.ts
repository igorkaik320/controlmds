import { supabase } from '@/integrations/supabase/client';
import { recordAuditEntry } from '@/lib/audit';
import { buildInstallmentsFromItem, toBrDateString, toIsoDateString } from '@/lib/parcelas';
import {
  saveContaPagar,
  saveParcelas,
  updateContaPagar,
  ContaPagarParcela,
} from '@/lib/contasPagarService';

// Types
export interface CompraFaturada {
  id: string;
  data: string;
  fornecedor: string;
  pedido: string | null;
  forma_pagamento: string | null;
  condicao_pagamento: string | null;
  vencimentos: string | null;
  parcelas?: string | null;
  data_liquidacao: string | null;
  cnpj_cpf: string | null;
  valor: number;
  obra: string | null;
  observacao: string | null;
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
}

export interface CompraAvista {
  id: string;
  data: string;
  fornecedor: string;
  pedido: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  cnpj_cpf: string | null;
  valor: number;
  obra: string | null;
  observacao: string | null;
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
}

export interface Fornecedor {
  id: string;
  nome_fornecedor: string;
  razao_social: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  cnpj_cpf: string | null;
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at?: string;
}

export interface ConfigRelatorio {
  id: string;
  logo_esquerda: string | null;
  logo_direita: string | null;
  fonte: string;
  tamanho_fonte: number;
  negrito: boolean;
  cor_texto: string;
  cor_cabecalho: string;
  cor_linhas: string;
  cor_rodape: string;
  cor_total: string;
}

export interface EspelhoItem {
  source_id?: string;
  item: number;
  fornecedor: string;
  razao_social: string;
  banco: string;
  agencia: string;
  conta: string;
  obra: string;
  pedido: string;
  valor_por_obra: number;
  total_fornecedor: number;
}

export interface ProgramacaoSemanal {
  id: string;
  data: string;
  fornecedor: string;
  pedido: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  cnpj_cpf: string | null;
  valor: number;
  obra: string | null;
  observacao: string | null;
  responsavel: string | null;
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
}

export interface Responsavel {
  id: string;
  nome: string;
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
}

// ---- Fornecedores ----
export async function fetchFornecedores(): Promise<Fornecedor[]> {
  const { data, error } = await supabase.from('fornecedores').select('*').order('nome_fornecedor');
  if (error) throw error;
  return data || [];
}

export async function saveFornecedor(f: Omit<Fornecedor, 'id' | 'created_at'>, userId: string) {
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('fornecedores')
    .insert({ ...f, created_by: userId, created_at: timestamp } as any)
    .select()
    .single();
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'fornecedores',
    entity_id: data.id,
    action: 'criacao',
    new_values: data,
    user_id: userId,
  });

  return data;
}

export async function updateFornecedor(id: string, f: Partial<Fornecedor>, userId: string) {
  const { data: previous } = await supabase.from('fornecedores').select('*').eq('id', id).maybeSingle();

  const { data, error } = await supabase
    .from('fornecedores')
    .update({ ...f, updated_at: new Date().toISOString(), updated_by: userId } as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'fornecedores',
    entity_id: id,
    action: 'edicao',
    old_values: previous,
    new_values: data,
    user_id: userId,
  });
}

export async function deleteFornecedor(id: string, userId: string) {
  const { data: previous } = await supabase.from('fornecedores').select('*').eq('id', id).maybeSingle();

  const { error } = await supabase.from('fornecedores').delete().eq('id', id);
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'fornecedores',
    entity_id: id,
    action: 'exclusao',
    old_values: previous,
    user_id: userId,
  });
}

// ---- Compras Faturadas ----
export async function fetchComprasFaturadas(): Promise<CompraFaturada[]> {
  const { data, error } = await supabase
    .from('previsao_compras_faturadas')
    .select('*')
    .order('data', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveCompraFaturada(
  c: Omit<CompraFaturada, 'id' | 'created_at' | 'updated_at'>,
  userId: string
) {
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('previsao_compras_faturadas')
    .insert({ ...c, created_by: userId, created_at: timestamp, updated_at: timestamp } as any)
    .select()
    .single();
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'previsao_compras_faturadas',
    entity_id: data.id,
    action: 'criacao',
    new_values: data,
    user_id: userId,
  });

  await syncContaPagarFromCompraFaturada(data as CompraFaturada, userId);

  return data;
}

export async function updateCompraFaturada(id: string, c: Partial<CompraFaturada>, userId: string) {
  const { data: previous } = await supabase
    .from('previsao_compras_faturadas')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('previsao_compras_faturadas')
    .update({ ...c, updated_at: new Date().toISOString(), updated_by: userId } as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'previsao_compras_faturadas',
    entity_id: id,
    action: 'edicao',
    old_values: previous,
    new_values: data,
    user_id: userId,
  });

  await syncContaPagarFromCompraFaturada(data as CompraFaturada, userId);
}

export async function deleteCompraFaturada(id: string, userId: string) {
  const { data: previous } = await supabase
    .from('previsao_compras_faturadas')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data: contasGeradas } = await supabase
    .from('contas_pagar')
    .select('*')
    .eq('origem', 'CF')
    .eq('origem_id', id);

  if (contasGeradas?.length) {
    const { error: contasError } = await supabase
      .from('contas_pagar')
      .delete()
      .eq('origem', 'CF')
      .eq('origem_id', id);
    if (contasError) throw contasError;
  }

  const { error } = await supabase.from('previsao_compras_faturadas').delete().eq('id', id);
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'previsao_compras_faturadas',
    entity_id: id,
    action: 'exclusao',
    old_values: previous,
    user_id: userId,
  });

  if (contasGeradas?.length) {
    for (const conta of contasGeradas) {
      await recordAuditEntry({
        entity_type: 'contas_pagar',
        entity_id: conta.id,
        action: 'exclusao',
        old_values: conta,
        user_id: userId,
      });
    }
  }
}

export async function syncContaPagarFromCompraFaturada(compra: CompraFaturada, userId: string) {
  const installments = buildInstallmentsFromItem(compra);
  const firstDueDate = toIsoDateString(installments[0]?.due) || compra.data_liquidacao || compra.data;

  const { data: existing, error: existingError } = await supabase
    .from('contas_pagar')
    .select('id')
    .eq('origem', 'CF')
    .eq('origem_id', compra.id)
    .maybeSingle();

  if (existingError) throw existingError;

  let contaId = existing?.id as string | undefined;

  const contaPayload = {
    origem: 'CF' as const,
    origem_id: compra.id,
    data_emissao: compra.data,
    data_primeiro_vencimento: firstDueDate || null,
    empresa_id: null,
    empresa_nome: null,
    fornecedor_id: null,
    fornecedor_nome: compra.fornecedor,
    obra_id: null,
    obra_nome: compra.obra || null,
    categoria_financeira_id: null,
    categoria_codigo: null,
    categoria_nome: null,
    valor_total: compra.valor,
    quantidade_parcelas: Math.max(installments.length, 1),
    observacao: compra.observacao || null,
    status: 'aberto' as const,
    created_by: compra.created_by || userId,
    updated_by: userId,
  };

  if (contaId) {
    await updateContaPagar(contaId, contaPayload, userId);
  } else {
    const saved = await saveContaPagar(contaPayload, userId);
    contaId = saved.id;
  }

  const { data: previousParcelas } = await supabase
    .from('contas_pagar_parcelas')
    .select('*')
    .eq('conta_pagar_id', contaId);

  const previousByNumber = new Map<number, ContaPagarParcela>(
    (previousParcelas || []).map((parcela: any) => [parcela.numero_parcela, parcela])
  );

  if (previousParcelas?.length) {
    const { error: deleteParcelasError } = await supabase
      .from('contas_pagar_parcelas')
      .delete()
      .eq('conta_pagar_id', contaId);
    if (deleteParcelasError) throw deleteParcelasError;
  }

  const parcelas = installments.map((installment, index) => {
    const numeroParcela = index + 1;
    const previous = previousByNumber.get(numeroParcela);

    return {
      conta_pagar_id: contaId!,
      numero_parcela: numeroParcela,
      valor_parcela: installment.value,
      data_vencimento: toIsoDateString(installment.due) || firstDueDate,
      data_pagamento: previous?.data_pagamento || null,
      valor_pago: previous?.valor_pago ?? null,
      status: (previous?.status as ContaPagarParcela['status']) || 'aberta',
      observacao: previous?.observacao || null,
      created_by: userId,
    };
  });

  if (parcelas.length > 0) {
    await saveParcelas(parcelas, userId);
  } else {
    await saveParcelas([
      {
        conta_pagar_id: contaId,
        numero_parcela: 1,
        valor_parcela: compra.valor,
        data_vencimento: firstDueDate || compra.data,
        data_pagamento: null,
        valor_pago: null,
        status: 'aberta',
        observacao: null,
        created_by: userId,
      },
    ], userId);
  }
}

export async function syncCompraFaturadaParcelasFromContaPagar(
  compraId: string,
  parcelas: Pick<ContaPagarParcela, 'numero_parcela' | 'data_vencimento' | 'valor_parcela'>[],
  userId: string
) {
  const ordenadas = [...parcelas]
    .filter((parcela) => parcela.data_vencimento)
    .sort((a, b) => a.numero_parcela - b.numero_parcela);

  const parcelasJson = ordenadas.map((parcela) => ({
    due: toBrDateString(parcela.data_vencimento),
    value: Number(parcela.valor_parcela) || 0,
  }));

  const payload = {
    parcelas: parcelasJson.length > 0 ? JSON.stringify(parcelasJson) : null,
    vencimentos: parcelasJson.map((parcela) => parcela.due).filter(Boolean).join(' | ') || null,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };

  const { data: previous } = await supabase
    .from('previsao_compras_faturadas')
    .select('*')
    .eq('id', compraId)
    .maybeSingle();

  const { data, error } = await supabase
    .from('previsao_compras_faturadas')
    .update(payload as any)
    .eq('id', compraId)
    .select()
    .single();

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'previsao_compras_faturadas',
    entity_id: compraId,
    action: 'edicao',
    old_values: previous,
    new_values: data,
    user_id: userId,
  });
}

// ---- Compras à Vista ----
export async function fetchComprasAvista(): Promise<CompraAvista[]> {
  const { data, error } = await supabase
    .from('previsao_compras_avista')
    .select('*')
    .order('data', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveCompraAvista(c: Omit<CompraAvista, 'id' | 'created_at' | 'updated_at'>) {
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('previsao_compras_avista')
    .insert({
      ...c,
      created_at: timestamp,
      updated_at: timestamp,
    } as any)
    .select()
    .single();
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'previsao_compras_avista',
    entity_id: data.id,
    action: 'criacao',
    new_values: data,
    user_id: c.created_by,
  });

  return data;
}

export async function updateCompraAvista(id: string, c: Partial<CompraAvista>) {
  const { data: previous } = await supabase
    .from('previsao_compras_avista')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('previsao_compras_avista')
    .update({ ...c, updated_at: timestamp } as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  await recordAuditEntry({
    entity_type: 'previsao_compras_avista',
    entity_id: id,
    action: 'edicao',
    old_values: previous,
    new_values: data,
    user_id: (c.updated_by as string) || '',
  });
  return data;
}

export async function deleteCompraAvista(id: string, userId: string) {
  const { data: previous } = await supabase
    .from('previsao_compras_avista')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('previsao_compras_avista').delete().eq('id', id);
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'previsao_compras_avista',
    entity_id: id,
    action: 'exclusao',
    old_values: previous,
    user_id: userId,
  });
}

// ---- Programação Semanal ----
export async function fetchProgramacaoSemanal(): Promise<ProgramacaoSemanal[]> {
  const { data, error } = await supabase
    .from('programacao_semanal')
    .select('*')
    .order('data', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveProgramacaoSemanal(c: Omit<ProgramacaoSemanal, 'id' | 'created_at' | 'updated_at'>) {
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('programacao_semanal')
    .insert({
      ...c,
      created_at: timestamp,
      updated_at: timestamp,
    } as any)
    .select()
    .single();
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'programacao_semanal',
    entity_id: data.id,
    action: 'criacao',
    new_values: data,
    user_id: c.created_by,
  });

  return data;
}

export async function updateProgramacaoSemanal(id: string, c: Partial<ProgramacaoSemanal>) {
  const { data: previous } = await supabase
    .from('programacao_semanal')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('programacao_semanal')
    .update({ ...c, updated_at: timestamp } as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'programacao_semanal',
    entity_id: id,
    action: 'edicao',
    old_values: previous,
    new_values: data,
    user_id: (c.updated_by as string) || '',
  });
  return data;
}

export async function deleteProgramacaoSemanal(id: string, userId: string) {
  const { data: previous } = await supabase
    .from('programacao_semanal')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('programacao_semanal').delete().eq('id', id);
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'programacao_semanal',
    entity_id: id,
    action: 'exclusao',
    old_values: previous,
    user_id: userId,
  });
}

// ---- Responsáveis ----
export async function fetchResponsaveis(): Promise<Responsavel[]> {
  const { data, error } = await supabase.from('responsaveis').select('*').order('nome');
  if (error) throw error;
  return data || [];
}

export async function saveResponsavel(nome: string, userId: string) {
  const { data, error } = await supabase
    .from('responsaveis')
    .insert({ nome, created_by: userId } as any)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateResponsavel(id: string, nome: string) {
  const { error } = await supabase
    .from('responsaveis')
    .update({ nome, updated_at: new Date().toISOString() } as any)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteResponsavel(id: string) {
  const { error } = await supabase.from('responsaveis').delete().eq('id', id);
  if (error) throw error;
}

// ---- Config Relatório ----
export async function fetchConfigRelatorio(): Promise<ConfigRelatorio | null> {
  const { data, error } = await supabase.from('config_relatorio').select('*').limit(1).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export async function saveConfigRelatorio(c: Partial<ConfigRelatorio>, userId: string) {
  const existing = await fetchConfigRelatorio();
  if (existing) {
    const { error } = await supabase
      .from('config_relatorio')
      .update({ ...c, updated_by: userId, updated_at: new Date().toISOString() } as any)
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('config_relatorio')
      .insert({ ...c, updated_by: userId } as any);
    if (error) throw error;
  }
}

// ---- Espelho Geral ----
export function buildEspelho(compras: CompraAvista[], fornecedores: Fornecedor[]): EspelhoItem[] {
  const fornMap = new Map<string, Fornecedor>();
  for (const f of fornecedores) {
    fornMap.set(f.nome_fornecedor.toLowerCase(), f);
  }

  const totals = new Map<string, number>();
  for (const c of compras) {
    const key = c.fornecedor.toLowerCase();
    totals.set(key, (totals.get(key) || 0) + c.valor);
  }

  const sorted = [...compras].sort((a, b) => {
    const f = a.fornecedor.localeCompare(b.fornecedor);
    if (f !== 0) return f;
    return (a.obra || '').localeCompare(b.obra || '');
  });

  const items: EspelhoItem[] = [];
  let itemNum = 0;
  let lastForn = '';
  for (const c of sorted) {
    const key = c.fornecedor.toLowerCase();
    const forn = fornMap.get(key);
    if (key !== lastForn) {
      itemNum++;
      lastForn = key;
    }
    items.push({
      source_id: c.id,
      item: itemNum,
      fornecedor: c.fornecedor,
      razao_social: forn?.razao_social || '',
      banco: c.banco || forn?.banco || '',
      agencia: c.agencia || forn?.agencia || '',
      conta: c.conta || forn?.conta || '',
      obra: c.obra || 'Sem obra',
      pedido: c.pedido || '',
      valor_por_obra: c.valor,
      total_fornecedor: totals.get(key) || 0,
    });
  }
  return items;
}

// ---- Espelho Semanal ----
export function buildEspelhoSemanal(compras: ProgramacaoSemanal[], fornecedores: Fornecedor[]): EspelhoItem[] {
  const fornMap = new Map<string, Fornecedor>();
  for (const f of fornecedores) {
    fornMap.set(f.nome_fornecedor.toLowerCase(), f);
  }

  const totals = new Map<string, number>();
  for (const c of compras) {
    const key = c.fornecedor.toLowerCase();
    totals.set(key, (totals.get(key) || 0) + c.valor);
  }

  const sorted = [...compras].sort((a, b) => {
    const f = a.fornecedor.localeCompare(b.fornecedor);
    if (f !== 0) return f;
    return (a.obra || '').localeCompare(b.obra || '');
  });

  const items: EspelhoItem[] = [];
  let itemNum = 0;
  let lastForn = '';
  for (const c of sorted) {
    const key = c.fornecedor.toLowerCase();
    const forn = fornMap.get(key);
    if (key !== lastForn) {
      itemNum++;
      lastForn = key;
    }
    items.push({
      source_id: c.id,
      item: itemNum,
      fornecedor: c.fornecedor,
      razao_social: forn?.razao_social || '',
      banco: c.banco || forn?.banco || '',
      agencia: c.agencia || forn?.agencia || '',
      conta: c.conta || forn?.conta || '',
      obra: c.obra || 'Sem obra',
      pedido: c.pedido || '',
      valor_por_obra: c.valor,
      total_fornecedor: totals.get(key) || 0,
    });
  }
  return items;
}

export function formatCurrencyBR(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso || typeof iso !== 'string') return '';
  try {
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return '';
    return `${d}/${m}/${y}`;
  } catch {
    return '';
  }
}
