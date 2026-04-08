// ---- CPF / CNPJ / Celular / Moeda formatters ----

export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function formatCPFCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) return formatCPF(value);
  return formatCNPJ(value);
}

export function unformatCPFCNPJ(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCelular(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function formatCurrencyInput(value: string): string {
  // Remove tudo que não for número
  let digits = value.replace(/\D/g, '');
  if (!digits) return '';
  
  // Converte para centavos
  const cents = parseInt(digits, 10);
  const reais = (cents / 100).toFixed(2);
  
  // Formata como moeda BR
  const [intPart, decPart] = reais.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${formattedInt},${decPart}`;
}

export function parseCurrencyInput(formatted: string): number {
  if (!formatted) return 0;
  // Remove R$, pontos de milhar e converte vírgula para ponto
  const clean = formatted.replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

export function currencyInputToString(formatted: string): string {
  const num = parseCurrencyInput(formatted);
  return num ? String(num) : '';
}

function toIsoFromBrDateTime(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ ,]+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;

  const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = match;
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
}

export function parseDateTimeSafe(value?: string | null): Date | null {
  if (!value) return null;

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const normalizedSpace = value.includes(' ') && !value.includes('T') ? value.replace(' ', 'T') : value;
  const normalizedTimezone = normalizedSpace.replace(/([+-]\d{2})$/, '$1:00');
  const retry = new Date(normalizedTimezone);
  if (!Number.isNaN(retry.getTime())) return retry;

  const isoFromBr = toIsoFromBrDateTime(value);
  if (!isoFromBr) return null;

  const parsedBr = new Date(isoFromBr);
  if (Number.isNaN(parsedBr.getTime())) return null;

  return parsedBr;
}

export function formatDateSafe(value?: string | null): string {
  if (!value) return '—';

  // Evita deslocamento de fuso quando a string já contém data YYYY-MM-DD.
  const ymd = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const [, yyyy, mm, dd] = ymd;
    return `${dd}/${mm}/${yyyy}`;
  }

  const parsed = parseDateTimeSafe(value);
  if (!parsed) return '—';

  return parsed.toLocaleDateString('pt-BR');
}

export function parseDateOnly(value: string): Date {
  const isoSegment = value.split('T')[0];
  return new Date(`${isoSegment}T00:00:00`);
}

export function formatLocalDate(value: string): string {
  return parseDateOnly(value).toLocaleDateString('pt-BR');
}
