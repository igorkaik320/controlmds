import { supabase } from '@/integrations/supabase/client';

export type TransactionType = 'entrada' | 'saida' | 'inicializacao';

export interface Transaction {
  id: string;
  date: string;
  type: string;
  value: number;
  gaveta?: number | null;
  observation: string;
  obra?: string | null;
  fornecedor?: string | null;
  nota_numero?: string | null;
  balance_before: number;
  balance_after: number;
  difference: number;
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at?: string | null;
}

export interface Verification {
  id: string;
  date: string;
  gaveta_value: number;
  system_balance: number;
  difference: number;
  observation: string | null;
  created_by: string;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values: any;
  new_values: any;
  user_id: string;
  created_at: string;
}

export interface PeriodSummary {
  totalEntradas: number;
  totalSaidas: number;
  totalDifferences: number;
  hasDivergence: boolean;
  currentBalance: number;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function recalculateAll(transactions: Transaction[]): Transaction[] {
  const sorted = [...transactions].sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    if (dc !== 0) return dc;
    return a.created_at.localeCompare(b.created_at);
  });

  let currentBalance = 0;
  return sorted.map((t) => {
    const balanceBefore = currentBalance;
    let balanceAfter: number;

    if (t.type === 'inicializacao') {
      balanceAfter = t.value;
    } else if (t.type === 'entrada') {
      balanceAfter = balanceBefore + t.value;
    } else {
      balanceAfter = balanceBefore - t.value;
    }

    const difference = t.gaveta != null ? t.gaveta - balanceAfter : 0;
    currentBalance = balanceAfter;

    return { ...t, balance_before: balanceBefore, balance_after: balanceAfter, difference };
  });
}

export function getSummary(transactions: Transaction[], verifications: Verification[] = []): PeriodSummary {
  let totalEntradas = 0, totalSaidas = 0;
  for (const t of transactions) {
    if (t.type === 'entrada') totalEntradas += t.value;
    if (t.type === 'saida') totalSaidas += t.value;
  }
  const latestDifference = verifications.length > 0 ? verifications[verifications.length - 1].difference : 0;
  const currentBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance_after : 0;
  return { totalEntradas, totalSaidas, totalDifferences: latestDifference, hasDivergence: Math.abs(latestDifference) > 0.01, currentBalance };
}

export function getCurrentBalance(transactions: Transaction[]): number {
  if (transactions.length === 0) return 0;
  return transactions[transactions.length - 1].balance_after;
}

export function filterByDateRange<T extends { date: string }>(items: T[], dateFrom?: string, dateTo?: string): T[] {
  let filtered = items;
  if (dateFrom) filtered = filtered.filter((i) => i.date >= dateFrom);
  if (dateTo) filtered = filtered.filter((i) => i.date <= dateTo);
  return filtered;
}

// ----- DB Operations -----

export async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase.from('transactions').select('*').order('date').order('created_at');
  if (error) throw error;
  return recalculateAll(data || []);
}

export async function saveTransactionToDB(
  tx: Omit<Transaction, 'id' | 'balance_before' | 'balance_after' | 'difference' | 'created_at' | 'updated_by' | 'updated_at'>,
  userId: string
) {
  const { data, error } = await supabase.from('transactions').insert({
    date: tx.date,
    type: tx.type,
    value: tx.value,
    gaveta: tx.gaveta,
    observation: tx.observation,
    obra: tx.obra,
    fornecedor: tx.fornecedor,
    nota_numero: tx.nota_numero,
    created_by: userId,
  } as any).select().single();
  if (error) throw error;

  await supabase.from('audit_log').insert({
    entity_type: 'transaction',
    entity_id: data.id,
    action: 'criacao',
    new_values: data,
    user_id: userId,
  } as any);

  return data;
}

export async function updateTransactionInDB(
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'created_at' | 'created_by'>>,
  userId: string,
  oldValues: any
) {
  const { data, error } = await supabase.from('transactions').update({
    ...updates,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  } as any).eq('id', id).select().single();
  if (error) throw error;

  await supabase.from('audit_log').insert({
    entity_type: 'transaction',
    entity_id: id,
    action: 'edicao',
    old_values: oldValues,
    new_values: data,
    user_id: userId,
  } as any);

  return data;
}

export async function deleteTransactionFromDB(id: string, userId: string, oldValues: any) {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;

  await supabase.from('audit_log').insert({
    entity_type: 'transaction',
    entity_id: id,
    action: 'exclusao',
    old_values: oldValues,
    user_id: userId,
  } as any);
}

export async function recalculateAndSave(): Promise<Transaction[]> {
  const all = await fetchTransactions();
  for (const t of all) {
    await supabase.from('transactions').update({
      balance_before: t.balance_before,
      balance_after: t.balance_after,
      difference: t.difference,
    } as any).eq('id', t.id);
  }
  return all;
}

// ----- Verifications -----

export async function fetchVerifications(): Promise<Verification[]> {
  const { data, error } = await supabase.from('verifications').select('*').order('date').order('created_at');
  if (error) throw error;
  return data || [];
}

export async function saveVerification(
  v: { date: string; gaveta_value: number; observation: string },
  systemBalance: number,
  userId: string
) {
  const difference = v.gaveta_value - systemBalance;
  const { data, error } = await supabase.from('verifications').insert({
    date: v.date,
    gaveta_value: v.gaveta_value,
    system_balance: systemBalance,
    difference,
    observation: v.observation || '',
    created_by: userId,
  } as any).select().single();
  if (error) throw error;

  await supabase.from('audit_log').insert({
    entity_type: 'verification',
    entity_id: data.id,
    action: 'criacao',
    new_values: data,
    user_id: userId,
  } as any);

  return data;
}

export async function deleteVerificationFromDB(id: string, userId: string, oldValues: any) {
  const { error } = await supabase.from('verifications').delete().eq('id', id);
  if (error) throw error;

  await supabase.from('audit_log').insert({
    entity_type: 'verification',
    entity_id: id,
    action: 'exclusao',
    old_values: oldValues,
    user_id: userId,
  } as any);
}

// ----- Audit -----

export async function fetchAuditLog(filters?: { userId?: string; action?: string; dateFrom?: string; dateTo?: string }): Promise<AuditEntry[]> {
  let q = supabase.from('audit_log').select('*').order('created_at', { ascending: false });
  if (filters?.userId) q = q.eq('user_id', filters.userId);
  if (filters?.action) q = q.eq('action', filters.action);
  if (filters?.dateFrom) q = q.gte('created_at', filters.dateFrom);
  if (filters?.dateTo) q = q.lte('created_at', filters.dateTo + 'T23:59:59');
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function deleteAuditEntry(id: string) {
  const { error } = await supabase.from('audit_log').delete().eq('id', id);
  if (error) throw error;
}

// ----- Profiles -----

export async function fetchProfiles(): Promise<Record<string, string>> {
  const { data } = await supabase.from('profiles').select('user_id, display_name');
  const map: Record<string, string> = {};
  for (const p of data || []) map[p.user_id] = p.display_name;
  return map;
}

// ----- User Management -----

export interface UserWithRole {
  user_id: string;
  display_name: string;
  role: string;
  created_at: string;
}

export async function fetchAllUsersWithRoles(): Promise<UserWithRole[]> {
  const { data: profiles } = await supabase.from('profiles').select('user_id, display_name, created_at');
  const { data: roles } = await supabase.from('user_roles').select('user_id, role');

  const roleMap: Record<string, string> = {};
  for (const r of roles || []) {
    const current = roleMap[r.user_id];
    if (!current || r.role === 'admin' || (r.role === 'conferente' && current === 'operador')) {
      roleMap[r.user_id] = r.role;
    }
  }

  return (profiles || []).map((p) => ({
    user_id: p.user_id,
    display_name: p.display_name,
    role: roleMap[p.user_id] || 'operador',
    created_at: p.created_at,
  }));
}

export async function updateUserRole(userId: string, newRole: string) {
  await supabase.from('user_roles').delete().eq('user_id', userId);
  const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: newRole } as any);
  if (error) throw error;
}
