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
  const match = vencimentos.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

export default function ComprasFaturadasPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete, canExport } = useModulePermissions();
  const [items, setItems] = useState<CompraFaturada[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog, clearShowDialog] = useFormDraft('fat-showDialog', false);
  const [editingId, setEditingId, clearEditingId] = useFormDraft<string | null>('fat-editingId', null);

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

  const [form, setForm, clearForm] = useFormDraft('fat-form', emptyForm);
  const [empresaLogos, setEmpresaLogos] = useState<{ logo_esquerda: string | null; logo_direita: string | null }>({
    logo_esquerda: null,
    logo_direita: null,
  });

  const load = useCallback(async () => {
    try {
      const [compras, obrasData, empresas] = await Promise.all([
        fetchComprasFaturadas(),
        fetchObras(),
        fetchEmpresas(),
      ]);

      setItems(compras);
      setObras(obrasData);

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

  const filtered = items.filter((i) => {
    if (draftDateFrom && i.data < draftDateFrom) return false;
    if (draftDateTo && i.data > draftDateTo) return false;
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
  }

  function resetDialogDraft() {
    clearEditingId();
    clearForm();
    clearShowDialog();
  }

  function openNew() {
    clearEditingId();
    clearForm();
    setShowDialog(true);
  }

  function openEdit(item: CompraFaturada) {
    setEditingId(item.id);
    setForm({
      data: item.data,
      fornecedor: item.fornecedor,
      pedido: item.pedido || '',
      forma_pagamento: item.forma_pagamento || '',
      condicao_pagamento: item.condicao_pagamento || '',
      vencimentos: item.vencimentos || (item.data_liquidacao ? formatDateBR(item.data_liquidacao) : ''),
      cnpj_cpf: item.cnpj_cpf || '',
      valor: formatCurrencyInput(String(Math.round(item.valor * 100))),
      obra: item.obra || '',
      observacao: item.observacao || '',
    });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user || !form.data || !form.fornecedor || !form.valor) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    try {
      const payload = {
        data: form.data,
        fornecedor: form.fornecedor,
        pedido: form.pedido || null,
        forma_pagamento: form.forma_pagamento || null,
        condicao_pagamento: form.condicao_pagamento || null,
        vencimentos: form.vencimentos || null,
        data_liquidacao: extractFirstDueDateIso(form.vencimentos),
        cnpj_cpf: form.cnpj_cpf || null,
        valor: parseCurrencyInput(form.valor),
        obra: form.obra || null,
        observacao: form.observacao || null,
        created_by: user.id,
      };

      if (editingId) {
        await updateCompraFaturada(editingId, payload);
        toast.success('Registro atualizado');
      } else {
        await saveCompraFaturada(payload as any);
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
      await deleteCompraFaturada(id);
      load();
      toast.success('Excluído');
    } catch (e: any) {
      toast.error(e.message);
    }
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
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-[30px] font-bold tracking-tight">Compras Faturadas</h2>
          <p className="text-sm text-muted-foreground">
            Controle e acompanhamento dos lançamentos faturados
          </p>
        </div>

        <div className="flex gap-2">
          {canExport('compras_faturadas') && (
            <>
              <Button variant="outline" size="sm" className="h-9 px-3" onClick={handleExportPDF}>
                <FileDown className="mr-1 h-4 w-4" />
                PDF
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3"
                onClick={() => exportFaturadasXLSX(filtered, observation)}
              >
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                Excel
              </Button>
            </>
          )}

          {canCreate('compras_faturadas') && (
            <Button size="sm" className="h-9 px-4" onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" />
              Novo
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Parâmetros da Consulta
          </h3>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                Fornecedor
              </Label>
              <Input
                value={filterForn}
                onChange={(e) => setFilterForn(e.target.value)}
                placeholder="Filtrar..."
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                Obra
              </Label>
              <Input
                value={filterObra}
                onChange={(e) => setFilterObra(e.target.value)}
                placeholder="Filtrar..."
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <EmpresaSelect value={filterEmpresa} onChange={setFilterEmpresa} label="Empresa" allowAll />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                De
              </Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                Até
              </Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Observação do Relatório
            </Label>
            <Textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              rows={2}
              placeholder="Observação..."
              className="min-h-[84px] resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button size="sm" className="h-9 px-4" onClick={handleConsultar}>
              <Search className="mr-1 h-4 w-4" />
              Consultar
            </Button>

            <Button variant="outline" size="sm" className="h-9 px-4" onClick={handleLimpar}>
              <RotateCcw className="mr-1 h-4 w-4" />
              Limpar
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Resultado da Consulta
          </h3>
        </div>

        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="h-11">
                <TableHead className="px-4 py-2 text-[12px]">Data</TableHead>
                <TableHead className="px-4 py-2 text-[12px]">Fornecedor</TableHead>
                <TableHead className="px-4 py-2 text-[12px]">Pedido</TableHead>
                <TableHead className="px-4 py-2 text-[12px]">Forma Pgto</TableHead>
                <TableHead className="px-4 py-2 text-[12px]">Condição</TableHead>
                <TableHead className="px-4 py-2 text-[12px]">Vencimentos</TableHead>
                <TableHead className="px-4 py-2 text-[12px]">CNPJ/CPF</TableHead>
                <TableHead className="px-4 py-2 text-right text-[12px]">Valor</TableHead>
                <TableHead className="px-4 py-2 text-[12px]">Obra</TableHead>
                <TableHead className="px-4 py-2 text-[12px]">Obs</TableHead>
                <TableHead className="w-[88px] px-4 py-2 text-right text-[12px]">Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="h-14 text-center text-sm text-muted-foreground">
                    Nenhum registro
                  </TableCell>
                </TableRow>
              )}

              {filtered.map((i) => (
                <TableRow key={i.id} className="h-12">
                  <TableCell className="px-4 py-2 text-sm">{formatDateBR(i.data)}</TableCell>

                  <TableCell className="max-w-[240px] px-4 py-2 text-sm">
                    <div className="truncate" title={i.fornecedor}>
                      {i.fornecedor}
                    </div>
                  </TableCell>

                  <TableCell className="px-4 py-2 text-sm">{i.pedido || '—'}</TableCell>
                  <TableCell className="px-4 py-2 text-sm">{i.forma_pagamento || '—'}</TableCell>
                  <TableCell className="px-4 py-2 text-sm">{i.condicao_pagamento || '—'}</TableCell>

                  <TableCell className="max-w-[220px] px-4 py-2 text-sm">
                    <div
                      className="truncate"
                      title={i.vencimentos || (i.data_liquidacao ? formatDateBR(i.data_liquidacao) : '—')}
                    >
                      {i.vencimentos || (i.data_liquidacao ? formatDateBR(i.data_liquidacao) : '—')}
                    </div>
                  </TableCell>

                  <TableCell className="max-w-[150px] break-words px-4 py-2 text-sm">
                    {i.cnpj_cpf || '—'}
                  </TableCell>

                  <TableCell className="px-4 py-2 text-right font-mono text-sm">
                    {formatCurrencyBR(i.valor)}
                  </TableCell>

                  <TableCell className="max-w-[180px] px-4 py-2 text-sm">
                    <div className="truncate" title={i.obra || '—'}>
                      {i.obra || '—'}
                    </div>
                  </TableCell>

                  <TableCell className="max-w-[170px] px-4 py-2 text-sm">
                    <div className="truncate" title={i.observacao || '—'}>
                      {i.observacao || '—'}
                    </div>
                  </TableCell>

                  <TableCell className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      {canEdit('compras_faturadas') && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(i)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}

                      {canDelete('compras_faturadas') && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(i.id)}>
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
