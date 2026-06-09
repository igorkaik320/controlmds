import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, FileDown, FileSpreadsheet, Search, RotateCcw } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  ProgramacaoSemanal,
  fetchProgramacaoSemanal,
  saveProgramacaoSemanal,
  updateProgramacaoSemanal,
  updateProgramacaoSemanalStatus,
  baixarProgramacaoSemanal,
  deleteProgramacaoSemanal,
  fetchConfigRelatorio,
  formatCurrencyBR,
  formatDateBR,
} from '@/lib/comprasService';
import { exportProgramacaoSemanalPDF, exportProgramacaoSemanalXLSX } from '@/lib/comprasExport';
import { formatCPFCNPJ, formatCurrencyInput, parseCurrencyInput } from '@/lib/formatters';
import FornecedorSelect from '@/components/compras/FornecedorSelect';
import ObraSelect from '@/components/compras/ObraSelect';
import ResponsavelSelect from '@/components/compras/ResponsavelSelect';
import EmpresaSelect from '@/components/compras/EmpresaSelect';
import { useFormDraft } from '@/hooks/useFormDraft';
import { toast } from 'sonner';
import type { Fornecedor } from '@/lib/comprasService';
import { fetchObras, Obra } from '@/lib/obrasService';
import { Empresa, fetchEmpresas } from '@/lib/empresasService';
import { fetchProfiles } from '@/lib/cashRegister';
import { ContaCorrente, fetchContasCorrentes } from '@/lib/contasCorrentesService';
import ObservationInfoTooltip from '@/components/compras/ObservationInfoTooltip';
import { useDataRefreshFlash } from '@/hooks/useDataRefreshFlash';
import TablePagination from '@/components/TablePagination';
import { usePagination } from '@/hooks/usePagination';

const emptyForm = {
  data: '',
  fornecedor: '',
  pedido: '',
  banco: '',
  agencia: '',
  conta: '',
  cnpj_cpf: '',
  valor: '',
  obra: '',
  observacao: '',
  responsavel: '',
};

const STATUS_OPTIONS = [
  { value: 'aberta', label: 'Aberta' },
  { value: 'paga', label: 'Paga' },
  { value: 'vencida', label: 'Vencida' },
  { value: 'cancelada', label: 'Cancelada' },
];

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function getProgramacaoStatus(item: ProgramacaoSemanal) {
  const status = item.status || 'aberta';
  if (status === 'aberta' && item.data && item.data < todayISO()) return 'vencida';
  return status;
}

function getStatusClass(status: string) {
  const classes: Record<string, string> = {
    aberta: 'bg-primary/15 text-primary hover:bg-primary/20',
    paga: 'bg-success/15 text-success hover:bg-success/20',
    vencida: 'bg-destructive/15 text-destructive hover:bg-destructive/20',
    cancelada: 'bg-muted text-muted-foreground hover:bg-muted/80',
  };
  return classes[status] || classes.aberta;
}

export default function ProgramacaoSemanalPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete, canExport } = useModulePermissions();
  const [items, setItems] = useState<ProgramacaoSemanal[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [obras, setObras] = useState<Obra[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [contasCorrentes, setContasCorrentes] = useState<ContaCorrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [paymentItems, setPaymentItems] = useState<ProgramacaoSemanal[]>([]);
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentEmpresaId, setPaymentEmpresaId] = useState('');
  const [paymentContaId, setPaymentContaId] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const { contentRef, flashAfterUpdate } = useDataRefreshFlash();

  const [draftDateFrom, setDraftDateFrom] = useFormDraft('ps-dateFrom', '');
  const [draftDateTo, setDraftDateTo] = useFormDraft('ps-dateTo', '');
  const [draftFilterForn, setDraftFilterForn] = useFormDraft('ps-filterForn', '');
  const [draftFilterObra, setDraftFilterObra] = useFormDraft('ps-filterObra', '');
  const [draftFilterResp, setDraftFilterResp] = useFormDraft('ps-filterResp', '');
  const [draftFilterEmpresa, setDraftFilterEmpresa] = useFormDraft('ps-filterEmpresa', '');
  const [observation, setObservation] = useFormDraft('ps-observation', '');

  const [dateFrom, setDateFrom] = useState(draftDateFrom);
  const [dateTo, setDateTo] = useState(draftDateTo);
  const [filterForn, setFilterForn] = useState(draftFilterForn);
  const [filterObra, setFilterObra] = useState(draftFilterObra);
  const [filterResp, setFilterResp] = useState(draftFilterResp);
  const [filterEmpresa, setFilterEmpresa] = useState(draftFilterEmpresa);

  const [form, setForm] = useState(emptyForm);
  const [empresaLogos, setEmpresaLogos] = useState<{ logo_esquerda: string | null; logo_direita: string | null }>({
    logo_esquerda: null,
    logo_direita: null,
  });

  const load = useCallback(async () => {
    try {
      const [programacao, obrasData, empresasData, profiles, contasData] = await Promise.all([
        fetchProgramacaoSemanal(),
        fetchObras(),
        fetchEmpresas(),
        fetchProfiles(),
        fetchContasCorrentes(),
      ]);

      setItems(programacao);
      setObras(obrasData);
      setEmpresas(empresasData);
      setContasCorrentes(contasData);
      setProfileMap(profiles);

      if (draftFilterEmpresa) {
        const empresa = empresasData.find((e) => e.id === draftFilterEmpresa);
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
    if (draftFilterResp && !(i.responsavel || '').toLowerCase().includes(draftFilterResp.toLowerCase())) return false;

    if (draftFilterEmpresa) {
      const allowedObras = new Set(
        obras.filter((obra) => obra.empresa_id === draftFilterEmpresa).map((obra) => obra.nome.toLowerCase())
      );

      if (!i.obra || !allowedObras.has(i.obra.toLowerCase())) return false;
    }

    return true;
  });

  const selectedVisibleCount = filtered.filter((item) => selectedItems.has(item.id)).length;
  const allVisibleSelected = filtered.length > 0 && selectedVisibleCount === filtered.length;
  const pagination = usePagination(filtered);
  const contasCorrentesPagamento = contasCorrentes.filter((conta) => {
    if (!conta.ativa) return false;
    if (!paymentEmpresaId) return true;
    return conta.empresa_id === paymentEmpresaId;
  });

  function getReportItems() {
    return selectedItems.size > 0 ? filtered.filter((item) => selectedItems.has(item.id)) : filtered;
  }

  function handleConsultar() {
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
    setDraftFilterForn(filterForn);
    setDraftFilterObra(filterObra);
    setDraftFilterResp(filterResp);
    setDraftFilterEmpresa(filterEmpresa);
    flashAfterUpdate();
  }

  function handleSelectAll(checked: boolean) {
    setSelectedItems((current) => {
      const next = new Set(current);
      filtered.forEach((item) => {
        if (checked) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
      });
      return next;
    });
  }

  function handleSelectItem(id: string, checked: boolean) {
    setSelectedItems((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function openPaymentDialog(itemsToPay: ProgramacaoSemanal[]) {
    if (itemsToPay.length === 0) {
      toast.error('Nenhum lançamento selecionado para baixa.');
      return;
    }

    const firstConta = contasCorrentes.find((conta) => conta.ativa) || contasCorrentes[0];
    setPaymentItems(itemsToPay);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentEmpresaId(firstConta?.empresa_id || '');
    setPaymentContaId(firstConta?.id || '');
  }

  async function handleStatusChange(item: ProgramacaoSemanal, newStatus: string) {
    if (!user) return;
    if (newStatus === 'paga') {
      openPaymentDialog([item]);
      return;
    }

    try {
      await updateProgramacaoSemanalStatus([item.id], newStatus, user.id);
      toast.success('Status atualizado');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar status.');
    }
  }

  async function handleBulkStatusChange(newStatus: string) {
    if (!user || selectedItems.size === 0) return;
    const selected = filtered.filter((item) => selectedItems.has(item.id));

    if (newStatus === 'paga') {
      openPaymentDialog(selected);
      return;
    }

    try {
      await updateProgramacaoSemanalStatus(selected.map((item) => item.id), newStatus, user.id);
      toast.success(`${selected.length} lançamento(s) atualizado(s)`);
      setSelectedItems(new Set());
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar status.');
    }
  }

  async function handleConfirmPayment() {
    if (!user || paymentItems.length === 0) return;
    if (!paymentDate) {
      toast.error('Informe a data de pagamento.');
      return;
    }
    if (!paymentEmpresaId) {
      toast.error('Selecione a empresa.');
      return;
    }
    if (!paymentContaId) {
      toast.error('Selecione a conta corrente.');
      return;
    }

    setSavingPayment(true);
    try {
      await baixarProgramacaoSemanal(paymentItems.map((item) => item.id), paymentDate, paymentContaId, user.id);
      toast.success(`${paymentItems.length} lançamento(s) baixado(s) como pago`);
      setPaymentItems([]);
      setSelectedItems(new Set());
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao baixar lançamentos.');
    } finally {
      setSavingPayment(false);
    }
  }

  function handleLimpar() {
    setDateFrom('');
    setDateTo('');
    setFilterForn('');
    setFilterObra('');
    setFilterResp('');
    setFilterEmpresa('');

    setDraftDateFrom('');
    setDraftDateTo('');
    setDraftFilterForn('');
    setDraftFilterObra('');
    setDraftFilterResp('');
    setDraftFilterEmpresa('');
    setSelectedItems(new Set());
    flashAfterUpdate();
  }

  function resetDialogDraft() {
    setEditingId(null);
    setForm(emptyForm);
    setShowDialog(false);
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setShowDialog(true);
  }

  function openEdit(item: ProgramacaoSemanal) {
    setEditingId(item.id);
    setForm({
      data: item.data,
      fornecedor: item.fornecedor,
      pedido: item.pedido || '',
      banco: item.banco || '',
      agencia: item.agencia || '',
      conta: item.conta || '',
      cnpj_cpf: item.cnpj_cpf || '',
      valor: formatCurrencyInput(String(Math.round(item.valor * 100))),
      obra: item.obra || '',
      observacao: item.observacao || '',
      responsavel: item.responsavel || '',
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
        banco: form.banco || null,
        agencia: form.agencia || null,
        conta: form.conta || null,
        cnpj_cpf: form.cnpj_cpf || null,
        valor: parseCurrencyInput(form.valor),
        obra: form.obra || null,
        observacao: form.observacao || null,
        responsavel: form.responsavel || null,
      };

      if (editingId) {
        await updateProgramacaoSemanal(editingId, { ...payload, updated_by: user.id });
        toast.success('Registro atualizado');
      } else {
        await saveProgramacaoSemanal({ ...payload, created_by: user.id } as any);
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
      if (!user) throw new Error('Usuário não encontrado');
      await deleteProgramacaoSemanal(id, user.id);
      setSelectedItems((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      load();
      toast.success('Excluído');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleExportPDF() {
    const reportItems = getReportItems();

    if (reportItems.length === 0) {
      toast.error('Nenhum lançamento selecionado para exportar.');
      return;
    }

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

    exportProgramacaoSemanalPDF(reportItems, config, observation);
  }

  function handleExportXLSX() {
    const reportItems = getReportItems();

    if (reportItems.length === 0) {
      toast.error('Nenhum lançamento selecionado para exportar.');
      return;
    }

    exportProgramacaoSemanalXLSX(reportItems, observation);
  }

  function handleFornecedorSelect(f: Fornecedor) {
    setForm((prev: typeof emptyForm) => ({
      ...prev,
      banco: f.banco || prev.banco,
      agencia: f.agencia || prev.agencia,
      conta: f.conta || prev.conta,
      cnpj_cpf: f.cnpj_cpf || prev.cnpj_cpf,
    }));
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
          <h2 className="text-2xl font-bold">Programação Semanal</h2>
          <p className="text-sm text-muted-foreground">
            Controle e acompanhamento da programação semanal
            {selectedItems.size > 0 ? ` • ${selectedVisibleCount} selecionado(s)` : ''}
          </p>
        </div>

        <div className="flex gap-2">
          {selectedItems.size > 0 && (
            <Select onValueChange={handleBulkStatusChange}>
              <SelectTrigger className="h-9 w-[172px]">
                <SelectValue placeholder="Alterar status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {canExport('programacao_semanal') && (
            <>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <FileDown className="mr-1 h-4 w-4" />
                PDF
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportXLSX}
              >
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                Excel
              </Button>
            </>
          )}

          {canCreate('programacao_semanal') && (
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" />
              Novo
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
            <Label className="text-xs">Responsável</Label>
            <Input
              value={filterResp}
              onChange={(e) => setFilterResp(e.target.value)}
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
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                />
              </TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Banco</TableHead>
              <TableHead>Agência</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead>CNPJ/CPF</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Info</TableHead>
              <TableHead className="w-[92px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={14} className="text-center text-muted-foreground">
                  Nenhum registro
                </TableCell>
              </TableRow>
            )}

            {pagination.paginatedItems.map((i) => (
              <TableRow key={i.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedItems.has(i.id)}
                    onCheckedChange={(checked) => handleSelectItem(i.id, Boolean(checked))}
                  />
                </TableCell>
                <TableCell>{formatDateBR(i.data)}</TableCell>
                <TableCell className="max-w-[240px]">
                  <div className="truncate" title={i.fornecedor}>
                    {i.fornecedor}
                  </div>
                </TableCell>
                <TableCell>{i.pedido || '—'}</TableCell>
                <TableCell>{i.banco || '—'}</TableCell>
                <TableCell>{i.agencia || '—'}</TableCell>
                <TableCell>{i.conta || '—'}</TableCell>
                <TableCell className="max-w-[160px] break-words">{i.cnpj_cpf || '—'}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrencyBR(i.valor)}</TableCell>
                <TableCell className="max-w-[200px]">
                  <div className="truncate" title={i.obra || '—'}>
                    {i.obra || '—'}
                  </div>
                </TableCell>
                <TableCell className="max-w-[140px]">
                  <div className="truncate" title={i.responsavel || '—'}>
                    {i.responsavel || '—'}
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    value={getProgramacaoStatus(i)}
                    onValueChange={(value) => handleStatusChange(i, value)}
                    disabled={!canEdit('programacao_semanal')}
                  >
                    <SelectTrigger className={`h-7 w-[104px] rounded-md border-transparent px-2.5 text-[11px] font-semibold capitalize shadow-none [&>svg]:text-current ${getStatusClass(getProgramacaoStatus(i))}`}>
                      <span>{getProgramacaoStatus(i)}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-center">
                  <ObservationInfoTooltip
                    observation={i.observacao}
                    createdBy={i.created_by}
                    createdAt={i.created_at}
                    updatedBy={i.updated_by}
                    updatedAt={i.updated_at}
                    profileMap={profileMap}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {canEdit('programacao_semanal') && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(i)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}

                    {canDelete('programacao_semanal') && (
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
        <TablePagination
          totalItems={filtered.length}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          onPageChange={pagination.setCurrentPage}
          onPageSizeChange={(pageSize) => {
            pagination.setPageSize(pageSize);
            pagination.setCurrentPage(1);
          }}
        />
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
            <DialogTitle>{editingId ? 'Editar' : 'Nova'} Programação Semanal</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div>
              <Label>Data *</Label>
              <Input
                type="date"
                value={form.data}
                onChange={(e) => setForm((p: typeof emptyForm) => ({ ...p, data: e.target.value }))}
              />
            </div>

            <FornecedorSelect
              value={form.fornecedor}
              onChange={(v) => setForm((p: typeof emptyForm) => ({ ...p, fornecedor: v }))}
              onFornecedorSelect={handleFornecedorSelect}
            />

            <div>
              <Label>Pedido</Label>
              <Input
                value={form.pedido}
                onChange={(e) => setForm((p: typeof emptyForm) => ({ ...p, pedido: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Banco</Label>
                <Input
                  value={form.banco}
                  onChange={(e) => setForm((p: typeof emptyForm) => ({ ...p, banco: e.target.value }))}
                />
              </div>

              <div>
                <Label>Agência</Label>
                <Input
                  value={form.agencia}
                  onChange={(e) => setForm((p: typeof emptyForm) => ({ ...p, agencia: e.target.value }))}
                />
              </div>

              <div>
                <Label>Conta</Label>
                <Input
                  value={form.conta}
                  onChange={(e) => setForm((p: typeof emptyForm) => ({ ...p, conta: e.target.value }))}
                />
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
              <ResponsavelSelect
                value={form.responsavel}
                onChange={(v) => setForm((p: typeof emptyForm) => ({ ...p, responsavel: v }))}
                allowAll={false}
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

      <Dialog
        open={paymentItems.length > 0}
        onOpenChange={(open) => {
          if (!open && !savingPayment) {
            setPaymentItems([]);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Baixar Programação Semanal</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {paymentItems.length} lançamento(s) selecionado(s) para baixa.
            </p>

            <div>
              <Label>Data de pagamento *</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </div>

            <div>
              <Label>Empresa *</Label>
              <Select
                value={paymentEmpresaId || ''}
                onValueChange={(value) => {
                  setPaymentEmpresaId(value);
                  const conta = contasCorrentes.find((item) => item.ativa && item.empresa_id === value);
                  setPaymentContaId(conta?.id || '');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id}>{empresa.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Conta corrente *</Label>
              <Select value={paymentContaId || ''} onValueChange={setPaymentContaId} disabled={!paymentEmpresaId}>
                <SelectTrigger>
                  <SelectValue placeholder={paymentEmpresaId ? 'Selecione a conta' : 'Selecione a empresa primeiro'} />
                </SelectTrigger>
                <SelectContent>
                  {contasCorrentesPagamento.map((conta) => (
                    <SelectItem key={conta.id} value={conta.id}>
                      {conta.banco} - Ag. {conta.agencia} - Conta {conta.numero_conta}
                      {conta.digito_verificador ? `-${conta.digito_verificador}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {paymentEmpresaId && contasCorrentesPagamento.length === 0 && (
                <p className="mt-1 text-xs text-destructive">
                  Nenhuma conta ativa vinculada a esta empresa.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentItems([])} disabled={savingPayment}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmPayment} disabled={savingPayment}>
              {savingPayment ? 'Baixando...' : 'Confirmar baixa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
