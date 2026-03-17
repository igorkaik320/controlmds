import { supabase } from '@/integrations/supabase/client';

// Types
export interface CompraFaturada {
  id: string; data: string; fornecedor: string; pedido: string | null; forma_pagamento: string | null;
  data_liquidacao: string | null; cnpj_cpf: string | null; valor: number; obra: string | null;
  observacao: string | null; created_by: string; created_at: string; updated_at: string;
}

export interface CompraAvista {
  id: string; data: string; fornecedor: string; pedido: string | null; banco: string | null; agencia: string | null;
  conta: string | null; cnpj_cpf: string | null; valor: number; obra: string | null;
  observacao: string | null; created_by: string; created_at: string; updated_at: string;
}

export interface Fornecedor {
  id: string; nome_fornecedor: string; razao_social: string | null; banco: string | null;
  agencia: string | null; conta: string | null; cnpj_cpf: string | null; created_by: string; created_at: string;
}

export interface ConfigRelatorio {
  id: string; logo_esquerda: string | null; logo_direita: string | null; fonte: string;
  tamanho_fonte: number; negrito: boolean; cor_texto: string; cor_cabecalho: string;
  cor_linhas: string; cor_rodape: string; cor_total: string;
}

export interface EspelhoItem {
  item: number; fornecedor: string; razao_social: string; banco: string; agencia: string;
  conta: string; obra: string; pedido: string; valor_por_obra: number; total_fornecedor: number;
}

export interface ProgramacaoSemanal {
  id: string; data: string; fornecedor: string; pedido: string | null; banco: string | null; agencia: string | null;
  conta: string | null; cnpj_cpf: string | null; valor: number; obra: string | null;
  observacao: string | null; responsavel: string | null; created_by: string; created_at: string; updated_at: string;
}

export interface Responsavel {
  id: string; nome: string; created_by: string; created_at: string; updated_at: string;
}

// ---- Fornecedores ----
export async function fetchFornecedores(): Promise<Fornecedor[]> {
  const { data, error } = await supabase.from('fornecedores').select('*').order('nome_fornecedor');
  if (error) throw error;
  return data || [];
}

export async function saveFornecedor(f: Omit<Fornecedor, 'id' | 'created_at'>, userId: string) {
  const { data, error } = await supabase.from('fornecedores').insert({ ...f, created_by: userId } as any).select().single();
  if (error) throw error;
  return data;
}

export async function updateFornecedor(id: string, f: Partial<Fornecedor>) {
  const { error } = await supabase.from('fornecedores').update({ ...f, updated_at: new Date().toISOString() } as any).eq('id', id);
  if (error) throw error;
}

export async function deleteFornecedor(id: string) {
  const { error } = await supabase.from('fornecedores').delete().eq('id', id);
  if (error) throw error;
}

// ---- Compras Faturadas ----
export async function fetchComprasFaturadas(): Promise<CompraFaturada[]> {
  const { data, error } = await supabase.from('previsao_compras_faturadas').select('*').order('data', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveCompraFaturada(c: Omit<CompraFaturada, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase.from('previsao_compras_faturadas').insert(c as any).select().single();
  if (error) throw error;
  return data;
}

export async function updateCompraFaturada(id: string, c: Partial<CompraFaturada>) {
  const { error } = await supabase.from('previsao_compras_faturadas').update({ ...c, updated_at: new Date().toISOString() } as any).eq('id', id);
  if (error) throw error;
}

export async function deleteCompraFaturada(id: string) {
  const { error } = await supabase.from('previsao_compras_faturadas').delete().eq('id', id);
  if (error) throw error;
}

// ---- Compras à Vista ----
export async function fetchComprasAvista(): Promise<CompraAvista[]> {
  const { data, error } = await supabase.from('previsao_compras_avista').select('*').order('data', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveCompraAvista(c: Omit<CompraAvista, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase.from('previsao_compras_avista').insert(c as any).select().single();
  if (error) throw error;
  return data;
}

export async function updateCompraAvista(id: string, c: Partial<CompraAvista>) {
  const { error } = await supabase.from('previsao_compras_avista').update({ ...c, updated_at: new Date().toISOString() } as any).eq('id', id);
  if (error) throw error;
}

export async function deleteCompraAvista(id: string) {
  const { error } = await supabase.from('previsao_compras_avista').delete().eq('id', id);
  if (error) throw error;
}

// ---- Programação Semanal ----
export async function fetchProgramacaoSemanal(): Promise<ProgramacaoSemanal[]> {
  const { data, error } = await supabase.from('programacao_semanal').select('*').order('data', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveProgramacaoSemanal(c: Omit<ProgramacaoSemanal, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase.from('programacao_semanal').insert(c as any).select().single();
  if (error) throw error;
  return data;
}

export async function updateProgramacaoSemanal(id: string, c: Partial<ProgramacaoSemanal>) {
  const { error } = await supabase.from('programacao_semanal').update({ ...c, updated_at: new Date().toISOString() } as any).eq('id', id);
  if (error) throw error;
}

export async function deleteProgramacaoSemanal(id: string) {
  const { error } = await supabase.from('programacao_semanal').delete().eq('id', id);
  if (error) throw error;
}

// ---- Responsáveis ----
export async function fetchResponsaveis(): Promise<Responsavel[]> {
  const { data, error } = await supabase.from('responsaveis').select('*').order('nome');
  if (error) throw error;
  return data || [];
}

export async function saveResponsavel(nome: string, userId: string) {
  const { data, error } = await supabase.from('responsaveis').insert({ nome, created_by: userId } as any).select().single();
  if (error) throw error;
  return data;
}

export async function updateResponsavel(id: string, nome: string) {
  const { error } = await supabase.from('responsaveis').update({ nome, updated_at: new Date().toISOString() } as any).eq('id', id);
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
    const { error } = await supabase.from('config_relatorio').update({ ...c, updated_by: userId, updated_at: new Date().toISOString() } as any).eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('config_relatorio').insert({ ...c, updated_by: userId } as any);
    if (error) throw error;
  }
}

// ---- Espelho Geral ----
export function buildEspelho(compras: CompraAvista[], fornecedores: Fornecedor[]): EspelhoItem[] {
  const fornMap = new Map<string, Fornecedor>();
  for (const f of fornecedores) {
    fornMap.set(f.nome_fornecedor.toLowerCase(), f);
  }

  // Calculate total per fornecedor
  const totals = new Map<string, number>();
  for (const c of compras) {
    const key = c.fornecedor.toLowerCase();
    totals.set(key, (totals.get(key) || 0) + c.valor);
  }

  // Sort by fornecedor then obra
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

// ---- Espelho Semanal (from programacao_semanal) ----
export function buildEspelhoSemanal(compras: ProgramacaoSemanal[], fornecedores: Fornecedor[]): EspelhoItem[] {
  const fornMap = new Map<string, Fornecedor>();
  for (const f of fornecedores) {
    fornMap.set(f.nome_fornecedor.toLowerCase(), f);
  }

  const groups = new Map<string, { obras: Map<string, number>; total: number }>();
  for (const c of compras) {
    const key = c.fornecedor.toLowerCase();
    if (!groups.has(key)) groups.set(key, { obras: new Map(), total: 0 });
    const g = groups.get(key)!;
    const obra = c.obra || 'Sem obra';
    g.obras.set(obra, (g.obras.get(obra) || 0) + c.valor);
    g.total += c.valor;
  }

  const items: EspelhoItem[] = [];
  let itemNum = 1;
  for (const [key, g] of groups) {
    const forn = fornMap.get(key);
    const firstCompra = compras.find(c => c.fornecedor.toLowerCase() === key);
    for (const [obra, valorObra] of g.obras) {
      items.push({
        item: itemNum++,
        fornecedor: firstCompra?.fornecedor || key,
        razao_social: forn?.razao_social || '',
        banco: firstCompra?.banco || forn?.banco || '',
        agencia: firstCompra?.agencia || forn?.agencia || '',
        conta: firstCompra?.conta || forn?.conta || '',
        obra,
        valor_por_obra: valorObra,
        total_fornecedor: g.total,
      });
    }
  }
  return items;
}

export function formatCurrencyBR(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDateBR(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
