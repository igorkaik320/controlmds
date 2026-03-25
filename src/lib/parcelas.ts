import { formatDateBR } from './formatters';

export interface Installment {
  due: string;
  value: number;
}

const SPLIT_RE = /[|,;]+/;

export function normalizeVencimentos(text?: string | null, fallback?: string): string[] {
  if (!text?.trim()) {
    return fallback ? [fallback] : [];
  }

  const parts = text
    .split(SPLIT_RE)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (parts.length > 0) return parts;
  if (fallback) return [fallback];
  return [];
}

export function distributeInstallmentValues(total: number, count: number): number[] {
  const installments = Math.max(count, 1);
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / installments);
  const remainder = cents - base * installments;

  return Array.from({ length: installments }, (_, idx) => {
    const extra = idx >= installments - remainder ? 1 : 0;
    return (base + extra) / 100;
  });
}

export function parseParcelasJson(raw?: string | null): Installment[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        if (!entry || typeof entry.due !== 'string') return null;
        const value = typeof entry.value === 'number' ? entry.value : parseFloat(entry.value);
        if (Number.isNaN(value)) return null;
        return { due: entry.due, value };
      })
      .filter((entry): entry is Installment => Boolean(entry));
  } catch {
    return [];
  }
}

export function buildInstallmentsFromItem(item: {
  parcelas?: string | null;
  vencimentos?: string | null;
  data: string;
  data_liquidacao?: string | null;
  valor: number;
}): Installment[] {
  const parsed = parseParcelasJson(item.parcelas);
  if (parsed.length > 0) return parsed;

  const fallbackDate = item.data_liquidacao ? formatDateBR(item.data_liquidacao) : formatDateBR(item.data);
  const dueDates = normalizeVencimentos(item.vencimentos, fallbackDate);
  if (dueDates.length === 0) {
    return [{ due: fallbackDate, value: item.valor }];
  }

  const installments = distributeInstallmentValues(item.valor, dueDates.length);
  return dueDates.map((due, idx) => ({
    due,
    value: installments[idx],
  }));
}

