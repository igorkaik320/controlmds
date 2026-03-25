import { formatDateSafe } from './formatters';

export interface Installment {
  due: string;
  value: number;
}

const SPLIT_RE = /[|,;]+/;
const BR_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toBrDateString(value?: string | null): string {
  if (!value?.trim()) return '';
  const trimmed = value.trim();

  const brMatch = trimmed.match(BR_DATE_RE);
  if (brMatch) return trimmed;

  const isoMatch = trimmed.match(ISO_DATE_RE);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${dd}/${mm}/${yyyy}`;
  }

  const safe = formatDateSafe(trimmed);
  return safe === '—' ? trimmed : safe;
}

export function toIsoDateString(value?: string | null): string {
  if (!value?.trim()) return '';
  const trimmed = value.trim();

  const isoMatch = trimmed.match(ISO_DATE_RE);
  if (isoMatch) return trimmed;

  const brMatch = trimmed.match(BR_DATE_RE);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    return `${yyyy}-${mm}-${dd}`;
  }

  const safe = toBrDateString(trimmed);
  const safeMatch = safe.match(BR_DATE_RE);
  if (!safeMatch) return '';

  const [, dd, mm, yyyy] = safeMatch;
  return `${yyyy}-${mm}-${dd}`;
}

export function normalizeVencimentos(text?: string | null, fallback?: string): string[] {
  if (!text?.trim()) {
    const fallbackDate = toBrDateString(fallback);
    return fallbackDate ? [fallbackDate] : [];
  }

  const parts = text
    .split(SPLIT_RE)
    .map((segment) => toBrDateString(segment))
    .filter((segment) => segment.length > 0);

  if (parts.length > 0) return parts;
  const fallbackDate = toBrDateString(fallback);
  if (fallbackDate) return [fallbackDate];
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
        const due = toBrDateString(entry.due);
        if (!due) return null;
        const value = typeof entry.value === 'number' ? entry.value : parseFloat(entry.value);
        if (Number.isNaN(value)) return null;
        return { due, value };
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

  const fallbackDate = item.data_liquidacao ? formatDateSafe(item.data_liquidacao) : formatDateSafe(item.data);
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

