import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, FileDown, FileSpreadsheet, Search, RotateCcw } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  CompraFaturada,
  fetchComprasFaturadas,
  saveCompraFaturada,
  updateCompraFaturada,
  deleteCompraFaturada,
  fetchConfigRelatorio,
  formatCurrencyBR,
  formatDateBR,
} from '@/lib/comprasService';
import { exportFaturadasPDF, exportFaturadasXLSX } from '@/lib/comprasExport';
import { formatCPFCNPJ, formatCurrencyInput, parseCurrencyInput } from '@/lib/formatters';
import FornecedorSelect from '@/components/compras/FornecedorSelect';
import ObraSelect from '@/components/compras/ObraSelect';
import EmpresaSelect from '@/components/compras/EmpresaSelect';
import { useFormDraft } from '@/hooks/useFormDraft';
import { toast } from 'sonner';
import type { Fornecedor } from '@/lib/comprasService';
import { fetchObras, Obra } from '@/lib/obrasService';
import { fetchEmpresas } from '@/lib/empresasService';
import { fetchProfiles } from '@/lib/cashRegister';
import AuditInfo from '@/components/AuditInfo';
import { useDataRefreshFlash } from '@/hooks/useDataRefreshFlash';
import {
  buildInstallmentsFromItem,
  distributeInstallmentValues,
  Installment,
  normalizeVencimentos,
  toBrDateString,
  toIsoDateString,
} from '@/lib/parcelas';

const emptyForm = {
  data: '',
  fornecedor: '',
  pedido: '',
  forma_pagamento: '',
  condicao_pagamento: '',
  vencimentos: '',
  cnpj_cpf: '',
  valor: '',
  obra: '',
  observacao: '',
};

type ParcelaDraft = {
  id: string;
  due: string;
  value: string;
};

const createDraftId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function formatDraftValue(value: number) {
  return formatCurrencyInput(String(Math.round(value * 100)));
}

function buildDraftsFromInstallments(installments: Installment[]): ParcelaDraft[] {
  return installments.map((installment) => ({
    id: createDraftId(),
    due: toIsoDateString(installment.due),
    value: formatDraftValue(installment.value),
  }));
}

function installmentsFromDrafts(drafts: ParcelaDraft[]) {
  return drafts
    .map((draft) => {
      const value = parseCurrencyInput(draft.value);
      return draft.due ? { due: draft.due, value } : null;
    })
    .filter((entry): entry is Installment => Boolean(entry) && entry.value >= 0);
}

function serializeParcels(drafts: ParcelaDraft[]): string | null {
  const normalized = installmentsFromDrafts(drafts)
    .map((installment) => ({
      ...installment,
      due: toBrDateString(installment.due),
    }))
    .filter((installment) => Boolean(installment.due));
  if (normalized.length === 0) return null;
  return JSON.stringify(normalized);
}

function joinDueText(drafts: ParcelaDraft[]) {
  return drafts.map((draft) => toBrDateString(draft.due)).filter(Boolean).join(' | ');
}

function totalFromDrafts(drafts: ParcelaDraft[]) {
  return drafts.reduce((sum, draft) => sum + parseCurrencyInput(draft.value), 0);
}

function parseConditionDays(condicao: string): number[] {
  const matches = condicao.match(/\d+/g);
  if (!matches) return [];
  return matches
    .map((n) => parseInt(n, 10))
    .filter((n) => !Number.isNaN(n) && n >= 0);
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  base.setDate(base.getDate() + days);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
}

function buildVencimentosFromCondition(data: string, condicao: string): string {
  if (!data || !condicao.trim()) return '';
  const days = parseConditionDays(condicao);
  if (days.length === 0) return '';
  return days.map((day) => addDaysToIsoDate(data, day)).join(' | ');
}

function extractFirstDueDateIso(vencimentos: string): string | null {
  const isoMatch = vencimentos.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${yyyy}-${mm}-${dd}`;
  }

  const match = vencimentos.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

export default function ComprasFaturadasPage() {
  const { contentRef, flashAfterUpdate } = useDataRefreshFlash();
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete, canExport } = useModulePermissions();
  const [items, setItems] = useState<CompraFaturada[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});

  const [draftDateFrom, setDraftDateFrom] = useFormDraft('fat-dateFrom', '');
  const [draftDateTo, setDraftDateTo] = useFormDraft('fat-dateTo', '');
  const [draftFilterForn, setDraftFilterForn] = useFormDraft('fat-filterForn', '');
  const [draftFilterObra, setDraftFilterObra] = useFormDraft('fat-filterObra', '');
  const [draftFilterEmpresa, setDraftFilterEmpresa] = useFormDraft('fat-filterEmpresa', '');
  const [observation, setObservation] = useFormDraft('fat-observation', '');

  const [dateFrom, setDateFrom] = useState(draftDateFrom);
  const [dateTo, setDateTo] = useState(draftDateTo);
  const [filterForn, setFilterForn] = useState(draftFilterForn);
  const [filterObra, setFilterObra] = useState(draftFilterObra);
  const [filterEmpresa, setFilterEmpresa] = useState(draftFilterEmpresa);

  const [form, setForm] = useState(emptyForm);
  const [empresaLogos, setEmpresaLogos] = useState<{ logo_esquerda: string | null; logo_direita: string | null }>({
    logo_esquerda: null,
    logo_direita: null,
  });
  const [parcelas, setParcelas] = useState<ParcelaDraft[]>([]);
  const [parcelasMode, setParcelasMode] = useState<'auto' | 'manual'>('auto');

  const load = useCallback(async () => {
    try {
      const [compras, obrasData, empresas, profiles] = await Promise.all([
        fetchComprasFaturadas(),
        fetchObras(),
        fetchEmpresas(),
        fetchProfiles(),
      ]);

      setItems(compras);
      setObras(obrasData);
      setProfileMap(profiles);

      if (draftFilterEmpresa) {
        const empresa = empresas.find((e) => e.id === draftFilterEmpresa);
        if (empresa) {
          setEmpresaLogos({
            logo_esquerda: empresa.logo_esquerda,
            logo_direita: empresa.logo_direita,
          });
        } else {
          setEmpresaLogos({ logo_esquerda: null, logo_direita: null });
        }
      } else {
        setEmpresaLogos({ logo_esquerda: null, logo_direita: null });
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [draftFilterEmpresa]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (parcelasMode !== 'auto') return;

    const dueText =
      form.vencimentos || buildVencimentosFromCondition(form.data, form.condicao_pagamento);
    const dueDates = normalizeVencimentos(dueText, form.data ? formatDateBR(form.data) : '');
    const totalValue = parseCurrencyInput(form.valor);
    const installments = distributeInstallmentValues(totalValue, dueDates.length || 1);
    const autoDrafts = dueDates.map((due, idx) => ({
      id: createDraftId(),
      due: toIsoDateString(due),
      value: formatDraftValue(installments[idx]),
    }));

    setParcelas(autoDrafts);
  }, [form.vencimentos, form.valor, form.data, form.condicao_pagamento, parcelasMode]);

  const normalizeIsoDate = (value: string | null | undefined) => (value ? value.split('T')[0] : '');

  const filtered = items.filter((i) => {
    const normalizedData = normalizeIsoDate(i.data);
    if (draftDateFrom && normalizedData < draftDateFrom) return false;
    if (draftDateTo && normalizedData > draftDateTo) return false;
    if (draftFilterForn && !i.fornecedor.toLowerCase().includes(draftFilterForn.toLowerCase())) return false;
    if (draftFilterObra && !(i.obra || '').toLowerCase().includes(draftFilterObra.toLowerCase())) return false;

    if (draftFilterEmpresa) {
      const allowedObras = new Set(
        obras.filter((obra) => obra.empresa_id === draftFilterEmpresa).map((obra) => obra.nome.toLowerCase())
      );

      if (!i.obra || !allowedObras.has(i.obra.toLowerCase())) return false;
    }

    return true;
  });

  function handleConsultar() {
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
    setDraftFilterForn(filterForn);
    setDraftFilterObra(filterObra);
    setDraftFilterEmpresa(filterEmpresa);
    flashAfterUpdate();
  }

  function handleLimpar() {
    setDateFrom('');
    setDateTo('');
    setFilterForn('');
    setFilterObra('');
    setFilterEmpresa('');

    setDraftDateFrom('');
    setDraftDateTo('');
    setDraftFilterForn('');
    setDraftFilterObra('');
    setDraftFilterEmpresa('');
    flashAfterUpdate();
  }

  function resetDialogDraft() {
    setEditingId(null);
    setForm(emptyForm);
    setShowDialog(false);
    setParcelas([]);
    setParcelasMode('auto');
  }

function openNew() {
  setEditingId(null);
  setForm(emptyForm);
  setShowDialog(true);
  setParcelas([]);
  setParcelasMode('auto');
}

  function openEdit(item: CompraFaturada) {
    const normalizedDueDates = normalizeVencimentos(
      item.vencimentos,
      item.data_liquidacao ? formatDateBR(item.data_liquidacao) : ''
    );

    setEditingId(item.id);
    setForm({
      data: item.data,
      fornecedor: item.fornecedor,
      pedido: item.pedido || '',
      forma_pagamento: item.forma_pagamento || '',
      condicao_pagamento: item.condicao_pagamento || '',
      vencimentos: normalizedDueDates.join(' | '),
      cnpj_cpf: item.cnpj_cpf || '',
      valor: formatCurrencyInput(String(Math.round(item.valor * 100))),
      obra: item.obra || '',
      observacao: item.observacao || '',
    });
    setShowDialog(true);
    const installments = buildInstallmentsFromItem(item);
    setParcelas(buildDraftsFromInstallments(installments));
    setParcelasMode(item.parcelas ? 'manual' : 'auto');
  }

  async function handleSubmit() {
    if (!user || !form.data || !form.fornecedor || !form.valor) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    try {
    const vencimentosFromParcelas = joinDueText(parcelas);
    const vencimentosNormalized = normalizeVencimentos(form.vencimentos).join(' | ');
    const vencimentosFinal = vencimentosFromParcelas || vencimentosNormalized;

    const payload = {
      data: form.data,
      fornecedor: form.fornecedor,
      pedido: form.pedido || null,
      forma_pagamento: form.forma_pagamento || null,
      condicao_pagamento: form.condicao_pagamento || null,
      vencimentos: vencimentosFinal || null,
      parcelas: serializeParcels(parcelas),
      data_liquidacao: extractFirstDueDateIso(vencimentosFinal),
      cnpj_cpf: form.cnpj_cpf || null,
      valor: parseCurrencyInput(form.valor),
      obra: form.obra || null,
      observacao: form.observacao || null,
    };

    if (editingId) {
      await updateCompraFaturada(editingId, payload, user.id);
      toast.success('Registro atualizado');
    } else {
      await saveCompraFaturada({ ...payload, created_by: user.id } as any);
        toast.success('Registro cadastrado');
      }

      resetDialogDraft();
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este registro?')) return;

    try {
      await deleteCompraFaturada(id, user?.id || '');
      load();
      toast.success('Excluído');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function applyManualParcels(
    updated: ParcelaDraft[],
    options?: { updateValor?: boolean; updateVencimentos?: boolean; markManual?: boolean }
  ) {
    const { updateValor = true, updateVencimentos = true, markManual = true } = options || {};
    setParcelas(updated);
    if (markManual) setParcelasMode('manual');
    if (updateVencimentos) {
      setForm((prev) => ({ ...prev, vencimentos: joinDueText(updated) }));
    }
    if (updateValor) {
      const totalValue = totalFromDrafts(updated);
      setForm((prev) => ({
        ...prev,
        valor: formatCurrencyInput(String(Math.round(totalValue * 100))),
      }));
    }
  }

  function handleParcelaDueChange(id: string, due: string) {
    const updated = parcelas.map((draft) => (draft.id === id ? { ...draft, due } : draft));
    applyManualParcels(updated, { updateValor: false });
  }

  function handleParcelaValueChange(id: string, value: string) {
    const updated = parcelas.map((draft) =>
      draft.id === id ? { ...draft, value: formatCurrencyInput(value) } : draft
    );
    applyManualParcels(updated);
  }

  function handleRemoveParcela(id: string) {
    applyManualParcels(parcelas.filter((draft) => draft.id !== id));
  }

  function handleAddParcela() {
    applyManualParcels([...parcelas, { id: createDraftId(), due: '', value: '' }], {
      updateValor: false,
      updateVencimentos: false,
    });
  }

  function resetParcelasToAuto() {
    setParcelasMode('auto');
  }

  async function handleExportPDF() {
    let config = await fetchConfigRelatorio();

    if (draftFilterEmpresa && config) {
      const empresas = await fetchEmpresas();
      const empresa = empresas.find((e) => e.id === draftFilterEmpresa);

      if (empresa) {
        config = {
          ...config,
          logo_esquerda: empresa.logo_esquerda || config.logo_esquerda || null,
          logo_direita: empresa.logo_direita || config.logo_direita || null,
          cor_cabecalho: empresa.cor_cabecalho || config.cor_cabecalho || '#6b7280',
        };
      }
    } else if (config) {
      config = {
        ...config,
        cor_cabecalho: '#6b7280',
      };
    }

    exportFaturadasPDF(filtered, config, observation);
  }

  function handleFornecedorSelect(f: Fornecedor) {
    setForm((prev: typeof emptyForm) => ({
      ...prev,
      cnpj_cpf: f.cnpj_cpf || prev.cnpj_cpf,
    }));
  }

  function handleConditionChange(value: string) {
    setForm((prev: typeof emptyForm) => {
      const autoVencimentos = buildVencimentosFromCondition(prev.data, value);
      return {
        ...prev,
        condicao_pagamento: value,
        vencimentos: autoVencimentos || prev.vencimentos,
      };
    });
    setParcelasMode('auto');
  }

  function handleDateChange(value: string) {
    setForm((prev: typeof emptyForm) => {
      const autoVencimentos = buildVencimentosFromCondition(value, prev.condicao_pagamento);
      return {
        ...prev,
        data: value,
        vencimentos: autoVencimentos || prev.vencimentos,
      };
    });
    setParcelasMode('auto');
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Compras Faturadas</h2>
          <p className="text-sm text-muted-foreground">
            Controle e acompanhamento dos lançamentos faturados
          </p>
        </div>

        <div className="flex gap-2">
          {canExport('compras_faturadas') && (
            <>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <FileDown className="mr-1 h-4 w-4" />
                PDF
              </Button>

              <Button variant="outline" size="sm" onClick={() => exportFaturadasXLSX(filtered, observation)}>
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                Excel
              </Button>
            </>
          )}

          {canCreate('compras_faturadas') && (
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" />
              Novo
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <Label className="text-xs">Fornecedor</Label>
            <Input
              value={filterForn}
              onChange={(e) => setFilterForn(e.target.value)}
              placeholder="Filtrar..."
            />
          </div>

          <div>
            <Label className="text-xs">Obra</Label>
            <Input
              value={filterObra}
              onChange={(e) => setFilterObra(e.target.value)}
              placeholder="Filtrar..."
            />
          </div>

          <div>
            <EmpresaSelect value={filterEmpresa} onChange={setFilterEmpresa} label="Empresa" allowAll />
          </div>

          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div>
          <Label className="text-xs">Observação do relatório</Label>
          <Textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            rows={2}
            placeholder="Observação..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={handleConsultar}>
            <Search className="mr-1 h-4 w-4" />
            Consultar
          </Button>

          <Button variant="outline" size="sm" onClick={handleLimpar}>
            <RotateCcw className="mr-1 h-4 w-4" />
            Limpar
          </Button>
        </div>
      </div>

      <div ref={contentRef} className="overflow-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Forma Pgto</TableHead>
              <TableHead>Condição</TableHead>
              <TableHead>Vencimentos</TableHead>
              <TableHead>CNPJ/CPF</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Obs</TableHead>
              <TableHead className="w-[92px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground">
                  Nenhum registro
                </TableCell>
              </TableRow>
            )}

            {filtered.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{formatDateBR(i.data)}</TableCell>
                <TableCell className="max-w-[260px]">
                  <div className="truncate" title={i.fornecedor}>
                    {i.fornecedor}
                  </div>
                </TableCell>
                <TableCell>{i.pedido || '—'}</TableCell>
                <TableCell>{i.forma_pagamento || '—'}</TableCell>
                <TableCell>{i.condicao_pagamento || '—'}</TableCell>
                <TableCell className="max-w-[220px]">
                  <div
                    className="truncate"
                    title={i.vencimentos || (i.data_liquidacao ? formatDateBR(i.data_liquidacao) : '—')}
                  >
                    {i.vencimentos || (i.data_liquidacao ? formatDateBR(i.data_liquidacao) : '—')}
                  </div>
                </TableCell>
                <TableCell className="max-w-[160px] break-words">{i.cnpj_cpf || '—'}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrencyBR(i.valor)}</TableCell>
                <TableCell className="max-w-[190px]">
                  <div className="truncate" title={i.obra || '—'}>
                    {i.obra || '—'}
                  </div>
                </TableCell>
                <TableCell className="max-w-[190px]">
                  <div className="truncate" title={i.observacao || '—'}>
                    {i.observacao || '—'}
                  </div>
                  <div className="mt-1">
                    <AuditInfo
                      createdBy={i.created_by}
                      createdAt={i.created_at}
                      updatedBy={i.updated_by}
                      updatedAt={i.updated_at}
                      profileMap={profileMap}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {canEdit('compras_faturadas') && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(i)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}

                    {canDelete('compras_faturadas') && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(i.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          if (!open) {
            resetDialogDraft();
            return;
          }
          setShowDialog(true);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nova'} Compra Faturada</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div>
              <Label>Data *</Label>
              <Input type="date" value={form.data} onChange={(e) => handleDateChange(e.target.value)} />
            </div>

            <FornecedorSelect
              value={form.fornecedor}
              onChange={(v) => setForm((p: typeof emptyForm) => ({ ...p, fornecedor: v }))}
              onFornecedorSelect={handleFornecedorSelect}
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Pedido</Label>
                <Input
                  value={form.pedido}
                  onChange={(e) => setForm((p: typeof emptyForm) => ({ ...p, pedido: e.target.value }))}
                />
              </div>

              <div>
                <Label>Forma de Pagamento</Label>
                <Input
                  value={form.forma_pagamento}
                  onChange={(e) => setForm((p: typeof emptyForm) => ({ ...p, forma_pagamento: e.target.value }))}
                  placeholder="Ex: boleto, TED, pix, transferência"
                />
              </div>
            </div>

            <div>
              <Label>Condição de Pagamento</Label>
              <Input
                value={form.condicao_pagamento}
                onChange={(e) => handleConditionChange(e.target.value)}
                placeholder="Ex: 30/60/90, 28/35, entrada + 2x, 7/14/21"
              />
            </div>

            <div>
              <Label>Vencimentos</Label>
              <Textarea
                value={form.vencimentos}
                onChange={(e) => setForm((p: typeof emptyForm) => ({ ...p, vencimentos: e.target.value }))}
                rows={3}
                placeholder="Ex: 19/04/2026 | 19/05/2026 | 18/06/2026"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Parcelas</Label>
                <Button variant="outline" size="sm" onClick={resetParcelasToAuto}>
                  Recalcular automático
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto rounded border border-muted/50 bg-muted/20 p-2">
                {parcelas.map((parcela) => (
                  <div key={parcela.id} className="grid gap-2 sm:grid-cols-[1.5fr,1fr,auto]">
                    <Input
                      type="date"
                      value={parcela.due}
                      onChange={(e) => handleParcelaDueChange(parcela.id, e.target.value)}
                      className="w-full"
                    />
                    <Input
                      value={parcela.value}
                      onChange={(e) => handleParcelaValueChange(parcela.id, e.target.value)}
                      className="w-full"
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveParcela(parcela.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {parcelas.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma parcela identificada</p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={handleAddParcela}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar parcela
                </Button>
                <span className="text-xs text-muted-foreground">
                  Total parcelas: {formatCurrencyBR(totalFromDrafts(parcelas))}
                </span>
              </div>
            </div>

            <div>
              <Label>CNPJ/CPF</Label>
              <Input
                value={form.cnpj_cpf}
                onChange={(e) =>
                  setForm((p: typeof emptyForm) => ({ ...p, cnpj_cpf: formatCPFCNPJ(e.target.value) }))
                }
                maxLength={18}
              />
            </div>

            <div>
              <Label>Valor *</Label>
              <Input
                value={form.valor}
                onChange={(e) =>
                  setForm((p: typeof emptyForm) => ({ ...p, valor: formatCurrencyInput(e.target.value) }))
                }
                placeholder="R$ 0,00"
              />
            </div>

            <div>
              <Label>Obra</Label>
              <ObraSelect
                value={form.obra}
                onChange={(v) => setForm((p: typeof emptyForm) => ({ ...p, obra: v }))}
              />
            </div>

            <div>
              <Label>Observação</Label>
              <Textarea
                value={form.observacao}
                onChange={(e) => setForm((p: typeof emptyForm) => ({ ...p, observacao: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetDialogDraft}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
