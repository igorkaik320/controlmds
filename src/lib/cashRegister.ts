import { supabase } from '@/integrations/supabase/client';
import { recordAuditEntry } from '@/lib/audit';

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
  saldoAnterior: number;
  saldoFinalPeriodo: number;
  diferencaPeriodo: number;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function recalculateAll(transactions: Transaction[]): Transaction[] {
  const sorted = [...transactions].sort((a, b) => {
    const dateA = a.date ?? '';
    const dateB = b.date ?? '';
    const createdAtA = a.created_at ?? '';
    const createdAtB = b.created_at ?? '';

    const dc = dateA.localeCompare(dateB);
    if (dc !== 0) return dc;
    return createdAtA.localeCompare(createdAtB);
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

    return {
      ...t,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      difference,
    };
  });
}

export function getInitialBalanceForPeriod(transactions: Transaction[], dateFrom?: string): number {
  if (!dateFrom || transactions.length === 0) return 0;
  
  // Filtrar transações anteriores ao período
  const previousTransactions = transactions.filter(t => t.date < dateFrom);
  
  if (previousTransactions.length === 0) return 0;
  
  // Retornar o saldo final da última transação anterior ao período
  return previousTransactions[previousTransactions.length - 1].balance_after;
}

export function getSummaryWithInitialBalance(transactions: Transaction[], verifications: Verification[] = [], dateFrom?: string): PeriodSummary {
  let totalEntradas = 0;
  let totalSaidas = 0;
  const initialBalance = getInitialBalanceForPeriod(transactions, dateFrom);

  for (const t of transactions) {
    if (t.type === 'entrada') totalEntradas += t.value;
    if (t.type === 'saida') totalSaidas += t.value;
  }

  const latestDifference = verifications.length > 0 ? verifications[verifications.length - 1].difference : 0;
  const currentBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance_after : initialBalance;

  return {
    totalEntradas,
    totalSaidas,
    totalDifferences: latestDifference,
    hasDivergence: Math.abs(latestDifference) > 0.01,
    currentBalance,
  };
}

export function getSummary(transactions: Transaction[], verifications: Verification[] = []): PeriodSummary {
  let totalEntradas = 0;
  let totalSaidas = 0;

  for (const t of transactions) {
    if (t.type === 'entrada') totalEntradas += t.value;
    if (t.type === 'saida') totalSaidas += t.value;
  }

  const latestDifference = verifications.length > 0 ? verifications[verifications.length - 1].difference : 0;
  const currentBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance_after : 0;

  return {
    totalEntradas,
    totalSaidas,
    totalDifferences: latestDifference,
    hasDivergence: Math.abs(latestDifference) > 0.01,
    currentBalance,
  };
}

export function getCurrentBalance(transactions: Transaction[]): number {
  if (transactions.length === 0) return 0;
  return transactions[transactions.length - 1].balance_after;
}

export function getBalanceAtDate(transactions: Transaction[], date: string, fallback = 0): number {
  if (!date || transactions.length === 0) return fallback;
  const upTo = transactions.filter((t) => (t.date ?? '') <= date);
  if (upTo.length === 0) return 0;
  return upTo[upTo.length - 1].balance_after;
}

export function filterByDateRange<T extends { date: string }>(items: T[], dateFrom?: string, dateTo?: string): T[] {
  let filtered = items;
  if (dateFrom) filtered = filtered.filter((i) => (i.date ?? '') >= dateFrom);
  if (dateTo) filtered = filtered.filter((i) => (i.date ?? '') <= dateTo);
  return filtered;
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date')
    .order('created_at');

  if (error) throw error;

  const safeData: Transaction[] = (data || []).map((item: any) => ({
    id: item.id,
    date: item.date ?? '',
    type: item.type ?? 'saida',
    value: Number(item.value ?? 0),
    gaveta: item.gaveta ?? null,
    observation: item.observation ?? '',
    obra: item.obra ?? null,
    fornecedor: item.fornecedor ?? null,
    nota_numero: item.nota_numero ?? null,
    balance_before: Number(item.balance_before ?? 0),
    balance_after: Number(item.balance_after ?? 0),
    difference: Number(item.difference ?? 0),
    created_by: item.created_by,
    created_at: item.created_at ?? '',
    updated_by: item.updated_by ?? null,
    updated_at: item.updated_at ?? null,
  }));

  return recalculateAll(safeData);
}

export async function saveTransactionToDB(
  tx: Omit<Transaction, 'id' | 'balance_before' | 'balance_after' | 'difference' | 'created_at' | 'updated_by' | 'updated_at'>,
  userId: string
) {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      date: tx.date,
      type: tx.type,
      value: tx.value,
      gaveta: tx.gaveta,
      observation: tx.observation,
      obra: tx.obra,
      fornecedor: tx.fornecedor,
      nota_numero: tx.nota_numero,
      created_by: userId,
    } as any)
    .select()
    .single();

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'transaction',
    entity_id: data.id,
    action: 'criacao',
    new_values: data,
    user_id: userId,
  });

  return data;
}

export async function updateTransactionInDB(
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'created_at' | 'created_by'>>,
  userId: string,
  oldValues: any
) {
  const { data, error } = await supabase
    .from('transactions')
    .update({
      ...updates,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'transaction',
    entity_id: id,
    action: 'edicao',
    old_values: oldValues,
    new_values: data,
    user_id: userId,
  });

  return data;
}

export async function deleteTransactionFromDB(id: string, userId: string, oldValues: any) {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'transaction',
    entity_id: id,
    action: 'exclusao',
    old_values: oldValues,
    user_id: userId,
  });
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

export async function fetchVerifications(): Promise<Verification[]> {
  const { data, error } = await supabase.from('verifications').select('*').order('date').order('created_at');
  if (error) throw error;

  return (data || []).map((item: any) => ({
    id: item.id,
    date: item.date ?? '',
    gaveta_value: Number(item.gaveta_value ?? 0),
    system_balance: Number(item.system_balance ?? 0),
    difference: Number(item.difference ?? 0),
    observation: item.observation ?? '',
    created_by: item.created_by,
    created_at: item.created_at ?? '',
  }));
}

export async function saveVerification(
  v: { date: string; gaveta_value: number; observation: string },
  systemBalance: number,
  userId: string
) {
  const difference = v.gaveta_value - systemBalance;

  const { data, error } = await supabase
    .from('verifications')
    .insert({
      date: v.date,
      gaveta_value: v.gaveta_value,
      system_balance: systemBalance,
      difference,
      observation: v.observation || '',
      created_by: userId,
    } as any)
    .select()
    .single();

  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'verification',
    entity_id: data.id,
    action: 'criacao',
    new_values: data,
    user_id: userId,
  });

  return data;
}

export async function deleteVerificationFromDB(id: string, userId: string, oldValues: any) {
  const { error } = await supabase.from('verifications').delete().eq('id', id);
  if (error) throw error;

  await recordAuditEntry({
    entity_type: 'verification',
    entity_id: id,
    action: 'exclusao',
    old_values: oldValues,
    user_id: userId,
  });
}

export async function fetchAuditLog(filters?: {
  userId?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<AuditEntry[]> {
  let q = supabase.from('audit_log').select('*').order('created_at', { ascending: false });

  if (filters?.userId) q = q.eq('user_id', filters.userId);
  if (filters?.action) q = q.eq('action', filters.action);
  if (filters?.entityType) q = q.eq('entity_type', filters.entityType);
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

export async function fetchProfiles(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('profiles').select('user_id, display_name');

  if (error) throw error;

  const map: Record<string, string> = {};

  for (const p of data || []) {
    map[p.user_id] = p.display_name;
  }

  return map;
}

export interface UserWithRole {
  user_id: string;
  display_name: string;
  role: string;
  created_at: string;
  ativo: boolean;
}

export async function fetchAllUsersWithRoles(): Promise<UserWithRole[]> {
  const { data: profiles, error: profilesError } = await supabase.from('profiles').select('user_id, display_name, created_at');
  const { data: roles, error: rolesError } = await supabase.from('user_roles').select('user_id, role');

  const roleMap: Record<string, string> = {};

  for (const r of roles || []) {
    const current = roleMap[r.user_id];
    if (!current || r.role === 'admin' || (r.role === 'conferente' && current === 'operador')) {
      roleMap[r.user_id] = r.role;
    }
  }

  if (profiles && profiles.length > 0) {
    const profileUserIds = new Set(profiles.map((p) => p.user_id));

    const allUsers: UserWithRole[] = profiles.map((p) => ({
      user_id: p.user_id,
      display_name: p.display_name || 'Sem nome',
      role: roleMap[p.user_id] || 'operador',
      created_at: p.created_at || new Date().toISOString(),
      ativo: true, // Todos usuários considerados ativos por padrão
    }));

    for (const r of roles || []) {
      if (!profileUserIds.has(r.user_id)) {
        allUsers.push({
          user_id: r.user_id,
          display_name: 'Usuário ' + r.user_id.substring(0, 8),
          role: roleMap[r.user_id] || 'operador',
          created_at: new Date().toISOString(),
          ativo: true,
        });
      }
    }

    return allUsers;
  }

  return (roles || []).map((r) => ({
    user_id: r.user_id,
    display_name: 'Usuário ' + r.user_id.substring(0, 8),
    role: roleMap[r.user_id] || 'operador',
    created_at: new Date().toISOString(),
    ativo: true,
  }));
}

export async function updateUserRole(userId: string, newRole: string) {
  await supabase.from('user_roles').delete().eq('user_id', userId);

  const { error } = await supabase.from('user_roles').insert({
    user_id: userId,
    role: newRole,
  } as any);

  if (error) throw error;
}

export async function updateUserDisplayName(userId: string, displayName: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName } as any)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function toggleUserActive(userId: string, ativo: boolean) {
  const { error } = await supabase
    .from('profiles')
    .update({ ativo } as any)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function adminCreateUser(email: string, password: string, displayName: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await supabase.functions.invoke('admin-create-user', {
    body: { email, password, display_name: displayName },
  });

  if (res.error) throw new Error(res.error.message || 'Erro ao criar usuário');
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}
