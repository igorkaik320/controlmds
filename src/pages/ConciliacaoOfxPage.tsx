import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, FileUp, Landmark, Link2, Loader2, RotateCcw, Search, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchContasPagar, ContaPagarComParcelas } from '@/lib/contasPagarService';
import { fetchContasCorrentes, ContaCorrente } from '@/lib/contasCorrentesService';
import { useAuth } from '@/lib/auth';
import {
  buildOfxIdentifier,
  conciliarOfxLancamentoComParcela,
  desfazerConciliacaoOfx,
  fetchOfxLancamentos,
  importarOfx,
  ignorarOfxLancamento,
  matchContaCorrente,
  normalizeText,
  OfxImportacao,
  OfxLancamento,
  parseOfx,
  ParsedOfx,
  ParcelaSuggestion,
  scoreSuggestion,
} from '@/lib/ofxConciliacaoService';
import { publishDataRefresh } from '@/lib/dataRefreshEvents';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatCurrency(value: number) {
  return currency.format(value || 0);
}

function formatDate(date?: string | null) {
  if (!date) return '-';
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR');
}

function suggestionLevel(score: number) {
  if (score >= 85) return { label: 'Forte', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  if (score >= 70) return { label: 'Media', className: 'bg-amber-100 text-amber-700 border-amber-200' };
  return { label: 'Fraca', className: 'bg-muted text-muted-foreground border-border' };
}

function statusLabel(status: OfxLancamento['status']) {
  if (status === 'conciliado') return 'Conciliado';
  if (status === 'ignorado') return 'Ignorado';
  return 'Pendente';
}

type ImportedState = {
  parsed: ParsedOfx;
  fileName: string;
  conta: ContaCorrente;
  importacao: OfxImportacao;
  lancamentos: OfxLancamento[];
  duplicados: number;
};

type AccountSummary = {
  conta: ContaCorrente;
  rows: OfxLancamento[];
  found: number;
  suggestions: number;
  notFound: number;
  reconciled: number;
  ignored: number;
};

function decodeOfxBuffer(buffer: ArrayBuffer) {
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  if (!utf8.includes('\uFFFD')) return utf8;
  return new TextDecoder('windows-1252').decode(buffer);
}

function sortRowsAsc<T extends { data_movimento: string; fitid?: string | null }>(rows: T[]) {
  return [...rows].sort((a, b) => `${a.data_movimento}${a.fitid || ''}`.localeCompare(`${b.data_movimento}${b.fitid || ''}`));
}

function isCertainMatch(row: OfxLancamento, suggestions: ParcelaSuggestion[]) {
  if (row.status === 'conciliado') return true;
  return suggestions.some((suggestion) => {
    const parcela = suggestion.parcela;
    const samePaymentDate = parcela.data_pagamento === row.data_movimento;
    const sameDueDate = parcela.data_vencimento === row.data_movimento;
    return row.valor < 0 && parcela.status === 'paga' && suggestion.score >= 85 && (samePaymentDate || sameDueDate);
  });
}

export default function ConciliacaoOfxPage() {
  const { user } = useAuth();
  const [parsed, setParsed] = useState<ParsedOfx | null>(null);
  const [fileName, setFileName] = useState('');
  const [contasCorrentes, setContasCorrentes] = useState<ContaCorrente[]>([]);
  const [contasPagar, setContasPagar] = useState<ContaPagarComParcelas[]>([]);
  const [storedLancamentos, setStoredLancamentos] = useState<OfxLancamento[]>([]);
  const [imported, setImported] = useState<ImportedState | null>(null);
  const [selectedContaId, setSelectedContaId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState(false);
  const [query, setQuery] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingImport, setSavingImport] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  async function loadBaseData() {
    try {
      setLoading(true);
      const [contas, pagar, ofxRows] = await Promise.all([
        fetchContasCorrentes().catch(() => []),
        fetchContasPagar().catch(() => []),
        fetchOfxLancamentos().catch(() => []),
      ]);
      setContasCorrentes(contas);
      setContasPagar(pagar);
      setStoredLancamentos(ofxRows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBaseData();
  }, []);

  async function handleFile(file?: File | null) {
    if (!file) return;
    try {
      const text = decodeOfxBuffer(await file.arrayBuffer());
      const result = parseOfx(text);
      setParsed(result);
      setFileName(file.name);
      setImported(null);
      setSelectedContaId(null);
      setDetailMode(false);
      toast.success(`${result.transactions.length} lancamento(s) lido(s) do OFX.`);
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel ler o OFX.');
    }
  }

  const matchedAccount = useMemo(() => matchContaCorrente(parsed?.account || null, contasCorrentes), [parsed, contasCorrentes]);
  const selectedConta = useMemo(() => contasCorrentes.find((conta) => conta.id === selectedContaId) || null, [contasCorrentes, selectedContaId]);
  const activeRows = imported?.lancamentos || (selectedContaId ? storedLancamentos.filter((row) => row.conta_corrente_id === selectedContaId) : []);
  const showingPersistedRows = Boolean(imported || selectedContaId);

  const parcelasCandidatas = useMemo(() => {
    return contasPagar.flatMap((conta) => conta.parcelas.map((parcela) => ({ ...parcela, conta })));
  }, [contasPagar]);

  const previewRows = useMemo(() => {
    return sortRowsAsc((parsed?.transactions || []).map((transaction) => ({
      id: transaction.id,
      importacao_id: '',
      conta_corrente_id: matchedAccount?.id || null,
      fitid: transaction.fitId,
      checknum: transaction.checkNum,
      tipo: transaction.type,
      data_movimento: transaction.date,
      valor: transaction.amount,
      memo: transaction.memo,
      status: 'pendente' as const,
      parcela_id: null,
      conciliado_por: null,
      conciliado_em: null,
      ignorado_por: null,
      ignorado_em: null,
      created_at: '',
      updated_at: '',
    })));
  }, [parsed, matchedAccount]);

  const periodRows = useMemo(() => {
    const rows = showingPersistedRows ? activeRows : previewRows;
    return sortRowsAsc(rows.filter((row) => {
      if (periodStart && row.data_movimento < periodStart) return false;
      if (periodEnd && row.data_movimento > periodEnd) return false;
      return true;
    }));
  }, [showingPersistedRows, activeRows, previewRows, periodStart, periodEnd]);

  const allRowsInPeriod = useMemo(() => {
    const byId = new Map<string, OfxLancamento>();
    [...periodRows, ...storedLancamentos, ...previewRows].forEach((row) => {
      if (periodStart && row.data_movimento < periodStart) return;
      if (periodEnd && row.data_movimento > periodEnd) return;
      byId.set(row.id, row);
    });
    return sortRowsAsc(Array.from(byId.values()));
  }, [periodRows, storedLancamentos, previewRows, periodStart, periodEnd]);

  const suggestionRows = periodRows;
  const suggestionsById = useMemo(() => {
    const map = new Map<string, ParcelaSuggestion[]>();
    allRowsInPeriod.forEach((row) => {
      const suggestions = parcelasCandidatas
        .map((parcela) => scoreSuggestion(row, parcela))
        .filter(Boolean) as ParcelaSuggestion[];
      map.set(row.id, suggestions.sort((a, b) => b.score - a.score).slice(0, 3));
    });
    return map;
  }, [allRowsInPeriod, parcelasCandidatas]);

  const filteredRows = useMemo(() => {
    const term = normalizeText(query);
    if (!term) return periodRows;
    return periodRows.filter((row) => normalizeText(`${row.memo} ${row.fitid} ${row.checknum} ${row.tipo}`).includes(term));
  }, [periodRows, query]);

  const totals = useMemo(() => {
    return periodRows.reduce(
      (acc, row) => {
        if (row.valor > 0) acc.received += row.valor;
        if (row.valor < 0) acc.paid += Math.abs(row.valor);
        return acc;
      },
      { received: 0, paid: 0 }
    );
  }, [periodRows]);

  const stats = useMemo(() => {
    const debitRows = suggestionRows.filter((row) => row.valor < 0);
    const found = debitRows.filter((row) => isCertainMatch(row, suggestionsById.get(row.id) || [])).length;
    const suggestions = debitRows.filter((row) => {
      if (isCertainMatch(row, suggestionsById.get(row.id) || [])) return false;
      return (suggestionsById.get(row.id) || []).some((item) => item.score >= 70);
    }).length;
    return {
      found,
      suggestions,
      notFound: debitRows.length - found - suggestions,
      reconciled: suggestionRows.filter((row) => row.status === 'conciliado').length,
      ignored: suggestionRows.filter((row) => row.status === 'ignorado').length,
    };
  }, [suggestionRows, suggestionsById]);

  const accountSummaries = useMemo<AccountSummary[]>(() => {
    if (imported) {
      return [{
        conta: imported.conta,
        rows: periodRows,
        found: stats.found,
        suggestions: stats.suggestions,
        notFound: stats.notFound,
        reconciled: stats.reconciled,
        ignored: stats.ignored,
      }];
    }

    const grouped = new Map<string, OfxLancamento[]>();
    const storedRowsInPeriod = storedLancamentos.filter((row) => {
      if (periodStart && row.data_movimento < periodStart) return false;
      if (periodEnd && row.data_movimento > periodEnd) return false;
      return true;
    });

    storedRowsInPeriod.forEach((row) => {
      if (!row.conta_corrente_id) return;
      grouped.set(row.conta_corrente_id, [...(grouped.get(row.conta_corrente_id) || []), row]);
    });

    return Array.from(grouped.entries()).flatMap(([contaId, rows]) => {
      const conta = contasCorrentes.find((item) => item.id === contaId);
      if (!conta) return [];
      const sortedRows = sortRowsAsc(rows);
      const debits = sortedRows.filter((row) => row.valor < 0);
      const found = debits.filter((row) => isCertainMatch(row, suggestionsById.get(row.id) || [])).length;
      const suggestions = debits.filter((row) => {
        if (isCertainMatch(row, suggestionsById.get(row.id) || [])) return false;
        return (suggestionsById.get(row.id) || []).some((item) => item.score >= 70);
      }).length;
      return [{
        conta,
        rows: sortedRows,
        found,
        suggestions,
        notFound: debits.length - found - suggestions,
        reconciled: sortedRows.filter((row) => row.status === 'conciliado').length,
        ignored: sortedRows.filter((row) => row.status === 'ignorado').length,
      }];
    });
  }, [imported, stats, periodRows, storedLancamentos, contasCorrentes, periodStart, periodEnd, suggestionsById]);

  async function handleSaveImport() {
    if (!parsed || !matchedAccount || !user?.id) return;
    try {
      setSavingImport(true);
      const result = await importarOfx({ parsed, fileName, contaCorrenteId: matchedAccount.id, userId: user.id });
      setImported({ parsed, fileName, conta: matchedAccount, ...result });
      setStoredLancamentos((current) => [...result.lancamentos, ...current.filter((row) => !result.lancamentos.some((item) => item.id === row.id))]);
      setDetailMode(false);
      toast.success(`OFX importado. ${result.duplicados} lancamento(s) ja existiam e foram reaproveitados.`);
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel importar o OFX.');
    } finally {
      setSavingImport(false);
    }
  }

  function updateLancamentoLocal(id: string, patch: Partial<OfxLancamento>) {
    setStoredLancamentos((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setImported((current) => current ? { ...current, lancamentos: current.lancamentos.map((item) => (item.id === id ? { ...item, ...patch } : item)) } : current);
  }

  async function handleIgnorar(lancamento: OfxLancamento) {
    if (!user?.id) return;
    try {
      setActionId(lancamento.id);
      await ignorarOfxLancamento(lancamento.id, user.id);
      updateLancamentoLocal(lancamento.id, { status: 'ignorado', ignorado_por: user.id, ignorado_em: new Date().toISOString() });
      toast.success('Lancamento OFX ignorado.');
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel ignorar o lancamento.');
    } finally {
      setActionId(null);
    }
  }

  async function handleConciliar(lancamento: OfxLancamento, suggestion?: ParcelaSuggestion) {
    if (!user?.id || !suggestion) return;
    try {
      setActionId(lancamento.id);
      await conciliarOfxLancamentoComParcela({ lancamento, parcela: suggestion.parcela, userId: user.id });
      updateLancamentoLocal(lancamento.id, {
        status: 'conciliado',
        parcela_id: suggestion.parcela.id,
        conciliado_por: user.id,
        conciliado_em: new Date().toISOString(),
      });
      publishDataRefresh('conciliacao-ofx', 'contas-pagar');
      void loadBaseData();
      toast.success('Lancamento conciliado com a parcela.');
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel conciliar.');
    } finally {
      setActionId(null);
    }
  }

  async function handleDesfazerConciliacao(lancamento: OfxLancamento) {
    if (!user?.id) return;
    try {
      setActionId(lancamento.id);
      await desfazerConciliacaoOfx(lancamento, user.id);
      updateLancamentoLocal(lancamento.id, {
        status: 'pendente',
        parcela_id: null,
        conciliado_por: null,
        conciliado_em: null,
      });
      publishDataRefresh('conciliacao-ofx', 'contas-pagar');
      void loadBaseData();
      toast.success('Conciliacao desfeita.');
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel desfazer a conciliacao.');
    } finally {
      setActionId(null);
    }
  }

  async function handleConciliarEncontrados(rows: OfxLancamento[]) {
    if (!user?.id) return;
    const usados = new Set<string>();
    const candidatos = rows
      .filter((row) => row.status === 'pendente' && row.valor < 0)
      .map((lancamento) => ({ lancamento, suggestion: (suggestionsById.get(lancamento.id) || []).find((item) => item.score >= 85) }))
      .filter((item): item is { lancamento: OfxLancamento; suggestion: ParcelaSuggestion } => Boolean(item.suggestion))
      .filter((item) => {
        if (usados.has(item.suggestion.parcela.id)) return false;
        usados.add(item.suggestion.parcela.id);
        return true;
      });

    if (candidatos.length === 0) {
      toast.info('Nenhuma sugestao forte pendente para conciliar automaticamente.');
      return;
    }

    try {
      setActionId('bulk');
      for (const item of candidatos) {
        await conciliarOfxLancamentoComParcela({ lancamento: item.lancamento, parcela: item.suggestion.parcela, userId: user.id });
        updateLancamentoLocal(item.lancamento.id, {
          status: 'conciliado',
          parcela_id: item.suggestion.parcela.id,
          conciliado_por: user.id,
          conciliado_em: new Date().toISOString(),
        });
      }
      publishDataRefresh('conciliacao-ofx', 'contas-pagar');
      void loadBaseData();
      toast.success(`${candidatos.length} lancamento(s) conciliado(s).`);
    } catch (error: any) {
      toast.error(error?.message || 'Nao foi possivel conciliar todos.');
    } finally {
      setActionId(null);
    }
  }

  const hasContent = Boolean(parsed) || accountSummaries.length > 0 || Boolean(selectedContaId);
  const accountForView = imported?.conta || selectedConta || matchedAccount;
  const identifier = parsed ? buildOfxIdentifier(parsed.account) : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Conciliação OFX</h2>
          <p className="text-sm text-muted-foreground">Importe extratos, localize a conta corrente e concilie com parcelas do Contas a Pagar.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input id="ofx-file" type="file" accept=".ofx,.OFX" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
          <Button asChild>
            <Label htmlFor="ofx-file" className="cursor-pointer gap-2">
              <FileUp className="h-4 w-4" />
              Importar OFX
            </Label>
          </Button>
        </div>
      </div>

      <section className="rounded-md border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[180px_180px_auto]">
          <div>
            <Label>De</Label>
            <Input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
          </div>
          <div>
            <Label>Até</Label>
            <Input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setPeriodStart('');
                setPeriodEnd('');
              }}
            >
              Limpar período
            </Button>
          </div>
        </div>
      </section>

      {!hasContent ? (
        <section className="rounded-lg border border-dashed bg-card p-8 text-center">
          <FileUp className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-3 text-base font-semibold">Selecione um arquivo OFX</h3>
          <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
            A importação identifica a conta pelo ID OFX, evita duplicidade pelo FITID e mostra os lançamentos encontrados ou pendentes de conferência.
          </p>
        </section>
      ) : (
        <>
          {parsed && (
            <>
              <section className="grid gap-3 lg:grid-cols-4">
                <div className="rounded-md border bg-card p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground">Conta OFX</p>
                  <p className="mt-1 font-semibold">{parsed.account.bankName || `Banco ${parsed.account.bankId}`}</p>
                  <p className="text-xs text-muted-foreground">Conta {parsed.account.accountId}</p>
                </div>
                <div className="rounded-md border bg-card p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground">Período</p>
                  <p className="mt-1 font-semibold">{formatDate(parsed.account.startDate)} a {formatDate(parsed.account.endDate)}</p>
                  <p className="text-xs text-muted-foreground">{filteredRows.length} lançamento(s)</p>
                </div>
                <div className="rounded-md border bg-card p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground">Recebido / Pago</p>
                  <p className="mt-1 font-semibold text-emerald-700">{formatCurrency(totals.received)}</p>
                  <p className="text-sm font-semibold text-destructive">{formatCurrency(totals.paid)}</p>
                </div>
                <div className="rounded-md border bg-card p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground">Conferência</p>
                  <p className="mt-1 font-semibold">{stats.found} encontrado(s)</p>
                  <p className="text-xs text-muted-foreground">{stats.suggestions} sugestão(ões) | {stats.notFound} sem equivalência</p>
                </div>
              </section>

              <section className="rounded-md border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-md bg-primary/10 p-2 text-primary">
                      <Landmark className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">Identificação da conta corrente</h3>
                      {accountForView ? (
                        <p className="text-sm text-muted-foreground">
                          Encontrada no cadastro: {accountForView.banco} - Ag. {accountForView.agencia} - Conta {accountForView.numero_conta}
                          {accountForView.digito_verificador ? `-${accountForView.digito_verificador}` : ''}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Nenhuma conta corrente cadastrada foi encontrada para este OFX. Cole o identificador abaixo no cadastro da conta corrente e importe novamente.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    <p className="text-xs text-muted-foreground">Identificador OFX</p>
                    <p className="font-mono font-semibold">{identifier}</p>
                  </div>
                </div>

                {!accountForView && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4" />
                    <p>Como no Sienge, a primeira leitura pode servir para descobrir o identificador da conta. Depois de salvar esse ID em Contas Correntes, a próxima importação reconhece a conta automaticamente.</p>
                  </div>
                )}

                {!imported && (
                  <div className="mt-4 flex justify-end">
                    <Button onClick={handleSaveImport} disabled={!matchedAccount || savingImport || !user?.id}>
                      {savingImport && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Salvar importação
                    </Button>
                  </div>
                )}
              </section>
            </>
          )}

          {accountSummaries.length > 0 && !detailMode && (
            <section className="rounded-md border bg-card p-4 shadow-sm">
              <div className="mb-4">
                <h3 className="text-sm font-semibold">Resultado da consulta</h3>
                <p className="text-xs text-muted-foreground">Cada card representa uma conta corrente com importação OFX salva.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {accountSummaries.map((summary) => (
                  <div key={summary.conta.id} className="rounded-md border bg-background p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-lg font-semibold uppercase tracking-tight">{summary.conta.banco}</h4>
                        <p className="mt-2 text-sm"><strong>Agência:</strong> {summary.conta.agencia}</p>
                        <p className="text-sm"><strong>Conta:</strong> {summary.conta.numero_conta}{summary.conta.digito_verificador ? `-${summary.conta.digito_verificador}` : ''}</p>
                      </div>
                      {summary.ignored > 0 && <Badge variant="outline">Ignorados: {summary.ignored}</Badge>}
                    </div>

                    <div className="mt-6 space-y-3 text-sm">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <span>{summary.found} - lançamento(s) encontrado(s)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        <span>{summary.suggestions} - sugestão(ões)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                        <span>{summary.notFound} - lançamento(s) não encontrado(s)</span>
                      </div>
                      {summary.reconciled > 0 && (
                        <div className="flex items-center gap-3">
                          <Link2 className="h-5 w-5 text-primary" />
                        <span>{summary.reconciled} - lançamento(s) conciliado(s)</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <Button onClick={() => handleConciliarEncontrados(summary.rows)} disabled={actionId === 'bulk'}>
                        {actionId === 'bulk' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Conciliar sugestões fortes
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (!imported) setSelectedContaId(summary.conta.id);
                          setDetailMode(true);
                        }}
                      >
                        Conferir manualmente
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(!showingPersistedRows || detailMode) && (
            <section className="rounded-md border bg-card shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  {showingPersistedRows && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDetailMode(false);
                        if (!imported) setSelectedContaId(null);
                      }}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <div>
                    <h3 className="text-sm font-semibold">{showingPersistedRows ? 'Conferência OFX x Sistema' : 'Prévia dos lançamentos do OFX'}</h3>
                    <p className="text-xs text-muted-foreground">Sugestões baseadas em valor, data e histórico do fornecedor.</p>
                  </div>
                </div>
                <div className="relative w-full max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no extrato..." />
                </div>
              </div>

              {showingPersistedRows ? (
                <div className="divide-y">
                  {filteredRows.map((lancamento) => {
                    const suggestions = suggestionsById.get(lancamento.id) || [];
                    const best = suggestions[0];
                    const level = best ? suggestionLevel(best.score) : null;
                    const busy = actionId === lancamento.id;

                    return (
                      <div key={lancamento.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_1fr]">
                        <div className="rounded-md border bg-background p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className={lancamento.valor < 0 ? 'text-lg font-semibold text-destructive' : 'text-lg font-semibold text-emerald-700'}>{formatCurrency(lancamento.valor)}</p>
                              <p className="text-sm text-muted-foreground">{formatDate(lancamento.data_movimento)}</p>
                            </div>
                            <Badge variant="outline">{statusLabel(lancamento.status)}</Badge>
                          </div>
                          <p className="mt-3 font-medium">{lancamento.memo || '-'}</p>
                          <p className="text-xs text-muted-foreground">FITID {lancamento.fitid || '-'} | Doc. {lancamento.checknum || '-'}</p>
                          <div className="mt-4 flex justify-end gap-2">
                            {lancamento.status === 'conciliado' && (
                              <Button variant="outline" size="sm" onClick={() => handleDesfazerConciliacao(lancamento)} disabled={busy}>
                                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                                Desfazer
                              </Button>
                            )}
                            {lancamento.status === 'pendente' && (
                              <Button variant="outline" size="sm" onClick={() => handleIgnorar(lancamento)} disabled={busy}>Ignorar</Button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-center">
                          <Button variant="outline" disabled={!best || lancamento.status !== 'pendente' || busy} onClick={() => handleConciliar(lancamento, best)}>
                            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Conciliar
                          </Button>
                        </div>

                        <div className="rounded-md border bg-background p-4">
                          {best ? (
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={level?.className}>{level?.label}</Badge>
                                <span className="text-xs text-muted-foreground">{best.score} pontos</span>
                              </div>
                              <p className="font-semibold">{best.parcela.conta.fornecedor_nome || '-'}</p>
                              <p className="text-sm text-muted-foreground">{best.parcela.conta.empresa_nome || '-'} | {best.parcela.conta.obra_nome || '-'}</p>
                              <p className="text-xs text-muted-foreground">Venc. {formatDate(best.parcela.data_vencimento)} | Parcela {best.parcela.numero_parcela}/{best.parcela.conta.quantidade_parcelas} | {formatCurrency(best.parcela.valor_parcela)}</p>
                              <p className="text-xs text-muted-foreground">{best.reasons.join(' + ')}</p>
                            </div>
                          ) : lancamento.valor < 0 ? (
                            <div className="flex h-full min-h-28 items-center justify-center text-center text-sm text-muted-foreground">
                              <div><XCircle className="mx-auto mb-2 h-5 w-5" />Nenhum lançamento equivalente encontrado</div>
                            </div>
                          ) : (
                            <div className="flex h-full min-h-28 items-center justify-center text-center text-sm text-muted-foreground">
                              <div><CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-emerald-600" />Entrada bancária, futura regra de contas a receber</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Histórico OFX</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Possível lançamento no sistema</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((transaction) => {
                      const suggestions = suggestionsById.get(transaction.id) || [];
                      const best = suggestions[0];
                      const level = best ? suggestionLevel(best.score) : null;

                      return (
                        <TableRow key={transaction.id}>
                          <TableCell className="text-muted-foreground">{formatDate(transaction.data_movimento)}</TableCell>
                          <TableCell>
                            <div className="max-w-xl">
                              <p className="font-medium">{transaction.memo || '-'}</p>
                              <p className="text-xs text-muted-foreground">Tipo {transaction.tipo || '-'} | FITID {transaction.fitid || '-'}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{transaction.checknum || '-'}</TableCell>
                          <TableCell className={transaction.valor < 0 ? 'text-right font-semibold text-destructive' : 'text-right font-semibold text-emerald-700'}>{formatCurrency(transaction.valor)}</TableCell>
                          <TableCell>
                            {best ? (
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className={level?.className}>{level?.label}</Badge>
                                  <span className="text-xs text-muted-foreground">{best.score} pontos</span>
                                </div>
                                <div className="rounded-md border bg-muted/30 p-2">
                                  <p className="text-sm font-semibold">{best.parcela.conta.fornecedor_nome || '-'}</p>
                                  <p className="text-xs text-muted-foreground">Venc. {formatDate(best.parcela.data_vencimento)} | Parcela {best.parcela.numero_parcela}/{best.parcela.conta.quantidade_parcelas} | {formatCurrency(best.parcela.valor_parcela)}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">{best.reasons.join(' + ')}</p>
                                </div>
                              </div>
                            ) : transaction.valor < 0 ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground"><XCircle className="h-4 w-4" />Nenhum lançamento equivalente encontrado</div>
                            ) : (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Entrada bancária, futura regra de contas a receber</div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </section>
          )}
        </>
      )}

      {loading && <p className="text-xs text-muted-foreground">Carregando contas correntes e parcelas para sugestoes...</p>}
    </div>
  );
}
