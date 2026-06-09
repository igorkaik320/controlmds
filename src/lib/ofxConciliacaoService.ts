import { supabase } from '@/integrations/supabase/client';
import { ContaCorrente } from '@/lib/contasCorrentesService';
import { ContaPagarComParcelas, ContaPagarParcela, pagarParcelaContaPagar } from '@/lib/contasPagarService';

export interface OfxAccountInfo {
  bankId: string;
  bankName: string;
  accountId: string;
  accountType: string;
  currency: string;
  startDate: string;
  endDate: string;
}

export interface OfxTransaction {
  id: string;
  type: string;
  date: string;
  amount: number;
  fitId: string;
  checkNum: string;
  memo: string;
}

export interface ParsedOfx {
  account: OfxAccountInfo;
  transactions: OfxTransaction[];
}

export interface OfxImportacao {
  id: string;
  conta_corrente_id: string | null;
  id_ofx: string;
  banco_id: string | null;
  banco_nome: string | null;
  conta_ofx: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  nome_arquivo: string | null;
  total_recebido: number;
  total_pago: number;
  quantidade_lancamentos: number;
  created_by: string | null;
  created_at: string;
}

export interface OfxLancamento {
  id: string;
  importacao_id: string;
  conta_corrente_id: string | null;
  fitid: string;
  checknum: string | null;
  tipo: string | null;
  data_movimento: string;
  valor: number;
  memo: string | null;
  status: 'pendente' | 'conciliado' | 'ignorado';
  parcela_id: string | null;
  conciliado_por: string | null;
  conciliado_em: string | null;
  ignorado_por: string | null;
  ignorado_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportarOfxResult {
  importacao: OfxImportacao;
  lancamentos: OfxLancamento[];
  duplicados: number;
}

export interface ParcelaSuggestion {
  parcela: ContaPagarParcela & { conta: ContaPagarComParcelas };
  score: number;
  reasons: string[];
}

export function normalizeText(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function onlyDigits(value?: string | null) {
  return String(value || '').replace(/\D/g, '');
}

function extractTag(block: string, tag: string) {
  const closed = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
  if (closed) return closed[1].trim();

  const open = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(block);
  return open?.[1]?.trim() || '';
}

function parseOfxDate(value: string) {
  const clean = String(value || '').trim().slice(0, 8);
  if (!/^\d{8}$/.test(clean)) return '';
  return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
}

export function parseOfx(content: string): ParsedOfx {
  const bankAccountBlock = /<BANKACCTFROM>([\s\S]*?)<\/BANKACCTFROM>/i.exec(content)?.[1] || '';
  const fiBlock = /<FI>([\s\S]*?)<\/FI>/i.exec(content)?.[1] || '';
  const transactionBlocks = Array.from(content.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi));

  const account: OfxAccountInfo = {
    bankId: extractTag(bankAccountBlock, 'BANKID') || extractTag(fiBlock, 'FID'),
    bankName: extractTag(fiBlock, 'ORG'),
    accountId: extractTag(bankAccountBlock, 'ACCTID'),
    accountType: extractTag(bankAccountBlock, 'ACCTTYPE'),
    currency: extractTag(content, 'CURDEF') || 'BRL',
    startDate: parseOfxDate(extractTag(content, 'DTSTART')),
    endDate: parseOfxDate(extractTag(content, 'DTEND')),
  };

  const transactions = transactionBlocks.map((match, index) => {
    const block = match[1];
    const fitId = extractTag(block, 'FITID') || `${extractTag(block, 'DTPOSTED')}-${index}`;
    return {
      id: `${fitId}-${index}`,
      type: extractTag(block, 'TRNTYPE'),
      date: parseOfxDate(extractTag(block, 'DTPOSTED')),
      amount: Number(extractTag(block, 'TRNAMT').replace(',', '.')) || 0,
      fitId,
      checkNum: extractTag(block, 'CHECKNUM'),
      memo: extractTag(block, 'MEMO'),
    };
  });

  if (!account.accountId || transactions.length === 0) {
    throw new Error('Arquivo OFX sem conta ou lancamentos reconhecidos.');
  }

  return { account, transactions };
}

export function buildOfxIdentifier(account?: OfxAccountInfo | null) {
  if (!account) return '';
  return `${account.bankId || 'SEM-BANCO'}|${account.accountId}`.toUpperCase();
}

export function matchContaCorrente(account: OfxAccountInfo | null, contas: ContaCorrente[]) {
  if (!account) return null;
  const identifier = buildOfxIdentifier(account);
  const byOfxId = contas.find((conta) => String(conta.id_ofx || '').trim().toUpperCase() === identifier);
  if (byOfxId) return byOfxId;

  const ofxAccountDigits = onlyDigits(account.accountId);
  const bankId = onlyDigits(account.bankId);
  const bankName = normalizeText(account.bankName);

  return contas.find((conta) => {
    const contaDigits = onlyDigits(`${conta.numero_conta}${conta.digito_verificador || ''}`);
    const bancoDigits = onlyDigits(conta.banco);
    const bancoText = normalizeText(conta.banco);
    const sameAccount = contaDigits && ofxAccountDigits && contaDigits === ofxAccountDigits;
    const sameBank = !bankId || bancoDigits.includes(bankId) || bankName.includes(bancoText) || bancoText.includes(bankName);
    return sameAccount && sameBank;
  }) || null;
}

export function getDateDistanceDays(a: string, b: string) {
  if (!a || !b) return 999;
  const timeA = new Date(`${a}T00:00:00`).getTime();
  const timeB = new Date(`${b}T00:00:00`).getTime();
  return Math.round(Math.abs(timeA - timeB) / 86400000);
}

export function scoreSuggestion(
  transaction: OfxTransaction | OfxLancamento,
  parcela: ContaPagarParcela & { conta: ContaPagarComParcelas }
): ParcelaSuggestion | null {
  const amount = 'amount' in transaction ? transaction.amount : transaction.valor;
  const date = 'date' in transaction ? transaction.date : transaction.data_movimento;
  const memo = 'memo' in transaction ? transaction.memo : transaction.memo;

  if (amount >= 0) return null;
  if (!['aberta', 'vencida', 'paga'].includes(parcela.status)) return null;

  const transactionContaId = 'conta_corrente_id' in transaction ? transaction.conta_corrente_id : null;
  if (parcela.status === 'paga' && parcela.conta_corrente_id !== transactionContaId) return null;

  const absValue = Math.abs(amount);
  const parcelaValue = Number(parcela.valor_parcela || 0);
  const valueDiff = Math.abs(absValue - parcelaValue);
  if (valueDiff > 0.01) return null;

  const reasons = ['Valor igual'];
  let score = 60;
  const paymentDays = parcela.data_pagamento ? getDateDistanceDays(date, parcela.data_pagamento) : 999;
  const dueDays = getDateDistanceDays(date, parcela.data_vencimento);

  if (paymentDays === 0) {
    score += 35;
    reasons.push('Mesma data de pagamento');
  } else if (paymentDays <= 3) {
    score += 18;
    reasons.push(`Pagamento proximo (${paymentDays} dia${paymentDays === 1 ? '' : 's'})`);
  } else if (dueDays === 0) {
    score += 25;
    reasons.push('Mesma data de vencimento');
  } else if (dueDays <= 3) {
    score += 15;
    reasons.push(`Data proxima (${dueDays} dia${dueDays === 1 ? '' : 's'})`);
  } else if (dueDays <= 10) {
    score += 8;
    reasons.push(`Data dentro de ${dueDays} dias`);
  }

  const memoText = normalizeText(memo);
  const fornecedor = normalizeText(parcela.conta.fornecedor_nome);
  const fornecedorTokens = fornecedor.split(' ').filter((token) => token.length >= 4);
  const hits = fornecedorTokens.filter((token) => memoText.includes(token)).length;
  if (hits > 0) {
    score += Math.min(25, hits * 8);
    reasons.push('Historico parecido com fornecedor');
  }

  if (parcela.status === 'paga' && paymentDays !== 0) {
    score -= 10;
    reasons.push('Parcela ja baixada');
  } else if (parcela.status === 'paga') {
    reasons.push('Parcela ja baixada');
  }

  return { parcela, score, reasons };
}

export async function importarOfx(params: {
  parsed: ParsedOfx;
  fileName: string;
  contaCorrenteId: string;
  userId: string;
}): Promise<ImportarOfxResult> {
  const { parsed, fileName, contaCorrenteId, userId } = params;
  const totals = parsed.transactions.reduce(
    (acc, transaction) => {
      if (transaction.amount > 0) acc.received += transaction.amount;
      if (transaction.amount < 0) acc.paid += Math.abs(transaction.amount);
      return acc;
    },
    { received: 0, paid: 0 }
  );

  const fitIds = parsed.transactions.map((item) => item.fitId).filter(Boolean);
  const { data: existentes, error: existentesError } = await (supabase as any)
    .from('ofx_lancamentos')
    .select('*')
    .eq('conta_corrente_id', contaCorrenteId)
    .in('fitid', fitIds);

  if (existentesError && !String(existentesError.message || '').includes('ofx_lancamentos')) {
    throw existentesError;
  }

  const existentesPorFitId = new Map<string, OfxLancamento>();
  ((existentes || []) as OfxLancamento[]).forEach((item) => existentesPorFitId.set(item.fitid, item));

  const { data: importacao, error: importacaoError } = await (supabase as any)
    .from('ofx_importacoes')
    .insert({
      conta_corrente_id: contaCorrenteId,
      id_ofx: buildOfxIdentifier(parsed.account),
      banco_id: parsed.account.bankId || null,
      banco_nome: parsed.account.bankName || null,
      conta_ofx: parsed.account.accountId || null,
      data_inicio: parsed.account.startDate || null,
      data_fim: parsed.account.endDate || null,
      nome_arquivo: fileName,
      total_recebido: totals.received,
      total_pago: totals.paid,
      quantidade_lancamentos: parsed.transactions.length,
      created_by: userId,
    })
    .select()
    .single();

  if (importacaoError) throw importacaoError;

  const novos = parsed.transactions
    .filter((transaction) => !existentesPorFitId.has(transaction.fitId))
    .map((transaction) => ({
      importacao_id: importacao.id,
      conta_corrente_id: contaCorrenteId,
      fitid: transaction.fitId,
      checknum: transaction.checkNum || null,
      tipo: transaction.type || null,
      data_movimento: transaction.date,
      valor: transaction.amount,
      memo: transaction.memo || null,
    }));

  let inseridos: OfxLancamento[] = [];
  if (novos.length > 0) {
    const { data, error } = await (supabase as any)
      .from('ofx_lancamentos')
      .insert(novos)
      .select();

    if (error) throw error;
    inseridos = (data || []) as OfxLancamento[];
  }

  return {
    importacao: importacao as OfxImportacao,
    lancamentos: [...Array.from(existentesPorFitId.values()), ...inseridos].sort((a, b) =>
      `${a.data_movimento}${a.fitid}`.localeCompare(`${b.data_movimento}${b.fitid}`)
    ),
    duplicados: existentesPorFitId.size,
  };
}

export async function fetchOfxLancamentos(): Promise<OfxLancamento[]> {
  const { data, error } = await (supabase as any)
    .from('ofx_lancamentos')
    .select('*')
    .order('data_movimento', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as OfxLancamento[];
}

export async function ignorarOfxLancamento(lancamentoId: string, userId: string) {
  const { error } = await (supabase as any)
    .from('ofx_lancamentos')
    .update({
      status: 'ignorado',
      ignorado_por: userId,
      ignorado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', lancamentoId);

  if (error) throw error;
}

export async function conciliarOfxLancamentoComParcela(params: {
  lancamento: OfxLancamento;
  parcela: ContaPagarParcela & { conta: ContaPagarComParcelas };
  userId: string;
}) {
  const { lancamento, parcela, userId } = params;
  if (!lancamento.conta_corrente_id) {
    throw new Error('O lancamento OFX precisa estar vinculado a uma conta corrente.');
  }

  if (parcela.status !== 'paga') {
    await pagarParcelaContaPagar(parcela.id, lancamento.data_movimento, lancamento.conta_corrente_id, userId);
  }

  const { error: conciliacaoError } = await (supabase as any)
    .from('conciliacoes_ofx')
    .upsert({
      ofx_lancamento_id: lancamento.id,
      parcela_id: parcela.id,
      conta_corrente_id: lancamento.conta_corrente_id,
      tipo: parcela.status === 'paga' ? 'confirmacao_baixa' : 'baixa_automatica',
      valor: Math.abs(Number(lancamento.valor || 0)),
      data_conciliacao: lancamento.data_movimento,
      created_by: userId,
    }, { onConflict: 'ofx_lancamento_id' });

  if (conciliacaoError) throw conciliacaoError;

  const { error: lancamentoError } = await (supabase as any)
    .from('ofx_lancamentos')
    .update({
      status: 'conciliado',
      parcela_id: parcela.id,
      conciliado_por: userId,
      conciliado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', lancamento.id);

  if (lancamentoError) throw lancamentoError;
}

export async function desfazerConciliacaoOfx(lancamento: OfxLancamento, userId: string) {
  const { data: conciliacao, error: conciliacaoFetchError } = await (supabase as any)
    .from('conciliacoes_ofx')
    .select('*')
    .eq('ofx_lancamento_id', lancamento.id)
    .maybeSingle();

  if (conciliacaoFetchError) throw conciliacaoFetchError;

  if (conciliacao?.tipo === 'baixa_automatica' && conciliacao.parcela_id) {
    await (supabase as any)
      .from('contas_correntes_movimentacoes')
      .delete()
      .eq('origem_tipo', 'contas_pagar_parcela')
      .eq('origem_id', conciliacao.parcela_id);

    const { data: parcelaAtual, error: parcelaFetchError } = await (supabase as any)
      .from('contas_pagar_parcelas')
      .select('data_vencimento')
      .eq('id', conciliacao.parcela_id)
      .maybeSingle();

    if (parcelaFetchError) throw parcelaFetchError;

    const hoje = new Date().toISOString().split('T')[0];
    const status = parcelaAtual?.data_vencimento && parcelaAtual.data_vencimento < hoje ? 'vencida' : 'aberta';

    const { error: parcelaUpdateError } = await (supabase as any)
      .from('contas_pagar_parcelas')
      .update({
        status,
        data_pagamento: null,
        conta_corrente_id: null,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conciliacao.parcela_id);

    if (parcelaUpdateError) throw parcelaUpdateError;
  }

  const { error: deleteError } = await (supabase as any)
    .from('conciliacoes_ofx')
    .delete()
    .eq('ofx_lancamento_id', lancamento.id);

  if (deleteError) throw deleteError;

  const { error: lancamentoError } = await (supabase as any)
    .from('ofx_lancamentos')
    .update({
      status: 'pendente',
      parcela_id: null,
      conciliado_por: null,
      conciliado_em: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lancamento.id);

  if (lancamentoError) throw lancamentoError;
}
