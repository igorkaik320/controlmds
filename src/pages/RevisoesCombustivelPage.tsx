import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Search, RotateCcw } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  RevisaoCombustivel,
  VeiculoMaquina,
  fetchRevisoesCombustivel,
  saveRevisaoCombustivel,
  updateRevisaoCombustivel,
  deleteRevisaoCombustivel,
  fetchVeiculos,
} from '@/lib/combustivelService';
import { Fornecedor, fetchFornecedores, formatCurrencyBR, formatDateBR } from '@/lib/comprasService';
import { formatCurrencyInput, parseCurrencyInput } from '@/lib/formatters';
import DateRangeFilter from '@/components/DateRangeFilter';
import { useFormDraft } from '@/hooks/useFormDraft';
import { toast } from 'sonner';

const emptyForm = {
  veiculo_id: '',
  fornecedor_id: '',
  data: '',
  valor: '',
  quilometragem_atual: '',
  quilometragem_proxima: '',
  observacao: '',
};

export default function RevisoesCombustivelPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const [items, setItems] = useState<RevisaoCombustivel[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoMaquina[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog, clearShowDialog] = useFormDraft('rev-showDialog', false);
  const [editingId, setEditingId, clearEditingId] = useFormDraft<string | null>('rev-editingId', null);
  const [form, setForm, clearForm] = useFormDraft('rev-form', emptyForm);

  const [draftDateFrom, setDraftDateFrom] = useFormDraft('rev-dateFrom', '');
  const [draftDateTo, setDraftDateTo] = useFormDraft('rev-dateTo', '');
  const [draftVeiculo, setDraftVeiculo] = useFormDraft('rev-filterVeiculo', 'all');
  const [draftFornecedor, setDraftFornecedor] = useFormDraft('rev-filterFornecedor', 'all');

  const [dateFrom, setDateFrom] = useState(draftDateFrom);
  const [dateTo, setDateTo] = useState(draftDateTo);
  const [filterVeiculo, setFilterVeiculo] = useState(draftVeiculo);
  const [filterFornecedor, setFilterFornecedor] = useState(draftFornecedor);

  const load = useCallback(async () => {
    try {
      const [revisoes, veiculosData, fornecedoresData] = await Promise.all([
        fetchRevisoesCombustivel(),
        fetchVeiculos(),
        fetchFornecedores(),
      ]);
      setItems(revisoes);
      setVeiculos(veiculosData);
      setFornecedores(fornecedoresData);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (draftDateFrom && item.data < draftDateFrom) return false;
      if (draftDateTo && item.data > draftDateTo) return false;
      if (draftVeiculo !== 'all' && item.veiculo_id !== draftVeiculo) return false;
      if (draftFornecedor !== 'all' && item.fornecedor_id !== draftFornecedor) return false;
      return true;
    });
  }, [draftDateFrom, draftDateTo, draftFornecedor, draftVeiculo, items]);

  const totalGeral = filtered.reduce((sum, item) => sum + item.valor, 0);

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

  function openEdit(item: RevisaoCombustivel) {
    setEditingId(item.id);
    setForm({
      veiculo_id: item.veiculo_id,
      fornecedor_id: item.fornecedor_id,
      data: item.data,
      valor: formatCurrencyInput(String(Math.round(item.valor * 100))),
      quilometragem_atual: String(item.quilometragem_atual),
      quilometragem_proxima: String(item.quilometragem_proxima),
      observacao: item.observacao || '',
    });
    setShowDialog(true);
  }

  function handleConsultar() {
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
    setDraftVeiculo(filterVeiculo);
    setDraftFornecedor(filterFornecedor);
  }

  function handleLimpar() {
    setDateFrom('');
    setDateTo('');
    setFilterVeiculo('all');
    setFilterFornecedor('all');
    setDraftDateFrom('');
    setDraftDateTo('');
    setDraftVeiculo('all');
    setDraftFornecedor('all');
  }

  async function handleSubmit() {
    if (!user || !form.veiculo_id || !form.fornecedor_id || !form.data || !form.valor || !form.quilometragem_atual || !form.quilometragem_proxima) {
      toast.error('Preencha os campos obrigatorios');
      return;
    }

    const quilometragemAtual = Number(form.quilometragem_atual);
    const quilometragemProxima = Number(form.quilometragem_proxima);

    if (Number.isNaN(quilometragemAtual) || Number.isNaN(quilometragemProxima)) {
      toast.error('Informe quilometragens validas');
      return;
    }

    if (quilometragemProxima < quilometragemAtual) {
      toast.error('A proxima revisao deve ser maior ou igual a quilometragem atual');
      return;
    }

    try {
      const payload = {
        veiculo_id: form.veiculo_id,
        fornecedor_id: form.fornecedor_id,
        data: form.data,
        valor: parseCurrencyInput(form.valor),
        quilometragem_atual: quilometragemAtual,
        quilometragem_proxima: quilometragemProxima,
        observacao: form.observacao || null,
        created_by: user.id,
      };

      if (editingId) {
        await updateRevisaoCombustivel(editingId, payload as any);
        toast.success('Revisao atualizada');
      } else {
        await saveRevisaoCombustivel(payload);
        toast.success('Revisao cadastrada');
      }

      resetDialogDraft();
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta revisao?')) return;

    try {
      await deleteRevisaoCombustivel(id);
      load();
      toast.success('Revisao excluida');
    } catch (e: any) {
      toast.error(e.message);
    }
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
          <h2 className="text-2xl font-bold tracking-tight">Controle de Revisoes</h2>
          <p className="text-sm text-muted-foreground">
            Registre manutencoes e acompanhe a quilometragem da proxima revisao.
          </p>
        </div>

        {canCreate('revisoes_combustivel') && (
          <Button size="sm" className="h-9 px-4" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" />
            Nova revisao
          </Button>
        )}
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Parametros da Consulta
          </h3>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <DateRangeFilter
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
            />

            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                Veiculo
              </Label>
              <Select value={filterVeiculo} onValueChange={setFilterVeiculo}>
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {veiculos.map((veiculo) => (
                    <SelectItem key={veiculo.id} value={veiculo.id}>
                      {veiculo.placa} - {veiculo.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                Fornecedor
              </Label>
              <Select value={filterFornecedor} onValueChange={setFilterFornecedor}>
                <SelectTrigger className="h-9 w-[260px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {fornecedores.map((fornecedor) => (
                    <SelectItem key={fornecedor.id} value={fornecedor.id}>
                      {fornecedor.nome_fornecedor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
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
                <TableHead className="px-4 py-2 text-[12px]">Veiculo</TableHead>
                <TableHead className="px-4 py-2 text-[12px]">Fornecedor</TableHead>
                <TableHead className="px-4 py-2 text-right text-[12px]">KM Atual</TableHead>
                <TableHead className="px-4 py-2 text-right text-[12px]">Prox. Revisao</TableHead>
                <TableHead className="px-4 py-2 text-right text-[12px]">Intervalo</TableHead>
                <TableHead className="px-4 py-2 text-right text-[12px]">Valor</TableHead>
                <TableHead className="px-4 py-2 text-[12px]">Obs</TableHead>
                <TableHead className="w-[88px] px-4 py-2 text-right text-[12px]">Acoes</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-14 text-center text-sm text-muted-foreground">
                    Nenhuma revisao registrada
                  </TableCell>
                </TableRow>
              )}

              {filtered.map((item) => {
                const intervalo = item.quilometragem_proxima - item.quilometragem_atual;

                return (
                  <TableRow key={item.id} className="h-12">
                    <TableCell className="px-4 py-2 text-sm">{formatDateBR(item.data)}</TableCell>
                    <TableCell className="max-w-[220px] px-4 py-2 text-sm">
                      <div className="truncate" title={`${item.veiculo?.placa || ''} ${item.veiculo?.modelo || ''}`.trim()}>
                        {item.veiculo?.placa || '—'} {item.veiculo?.modelo ? `- ${item.veiculo.modelo}` : ''}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px] px-4 py-2 text-sm">
                      <div className="truncate" title={item.fornecedor?.nome_fornecedor || '—'}>
                        {item.fornecedor?.nome_fornecedor || '—'}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right font-mono text-sm">
                      {item.quilometragem_atual.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right font-mono text-sm">
                      {item.quilometragem_proxima.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right text-sm">
                      {intervalo.toLocaleString('pt-BR')} km
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right font-mono text-sm">
                      {formatCurrencyBR(item.valor)}
                    </TableCell>
                    <TableCell className="max-w-[190px] px-4 py-2 text-sm">
                      <div className="truncate" title={item.observacao || '—'}>
                        {item.observacao || '—'}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        {canEdit('revisoes_combustivel') && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}

                        {canDelete('revisoes_combustivel') && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filtered.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={6} className="px-4 py-2 text-right">
                    TOTAL
                  </TableCell>
                  <TableCell className="px-4 py-2 text-right">{formatCurrencyBR(totalGeral)}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              )}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nova'} revisao</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Veiculo *</Label>
                <Select value={form.veiculo_id} onValueChange={(value) => setForm((prev) => ({ ...prev, veiculo_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar veiculo" />
                  </SelectTrigger>
                  <SelectContent>
                    {veiculos.map((veiculo) => (
                      <SelectItem key={veiculo.id} value={veiculo.id}>
                        {veiculo.placa} - {veiculo.modelo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Fornecedor *</Label>
                <Select value={form.fornecedor_id} onValueChange={(value) => setForm((prev) => ({ ...prev, fornecedor_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {fornecedores.map((fornecedor) => (
                      <SelectItem key={fornecedor.id} value={fornecedor.id}>
                        {fornecedor.nome_fornecedor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm((prev) => ({ ...prev, data: e.target.value }))}
                />
              </div>

              <div>
                <Label>Valor *</Label>
                <Input
                  value={form.valor}
                  onChange={(e) => setForm((prev) => ({ ...prev, valor: formatCurrencyInput(e.target.value) }))}
                  placeholder="R$ 0,00"
                />
              </div>

              <div>
                <Label>KM Atual *</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.quilometragem_atual}
                  onChange={(e) => setForm((prev) => ({ ...prev, quilometragem_atual: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>KM para proxima revisao *</Label>
              <Input
                type="number"
                min="0"
                value={form.quilometragem_proxima}
                onChange={(e) => setForm((prev) => ({ ...prev, quilometragem_proxima: e.target.value }))}
              />
            </div>

            <div>
              <Label>Observacao</Label>
              <Textarea
                value={form.observacao}
                onChange={(e) => setForm((prev) => ({ ...prev, observacao: e.target.value }))}
                rows={3}
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
