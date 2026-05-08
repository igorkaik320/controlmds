import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import VeiculoSearchSelect from '@/components/compras/VeiculoSearchSelect';
import FornecedorSearchSelect from '@/components/compras/FornecedorSelect';
import { toast } from 'sonner';
import { useDataRefreshFlash } from '@/hooks/useDataRefreshFlash';

const emptyForm = {
  veiculo_id: '',
  fornecedor_id: '',
  data: '',
  valor: '',
  tipo_medicao: 'km' as 'km' | 'horas' | 'meses',
  quilometragem_atual: '',
  quilometragem_proxima: '',
  observacao: '',
};

export default function RevisoesCombustivelPage() {
  const { contentRef, flashAfterUpdate } = useDataRefreshFlash();
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const [items, setItems] = useState<RevisaoCombustivel[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoMaquina[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  /** Remonta o select de fornecedor para limpar o campo de busca ao abrir o dialog. */
  const [fornecedorFieldKey, setFornecedorFieldKey] = useState(0);

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
    setEditingId(null);
    setForm(emptyForm);
    setFornecedorFieldKey((k) => k + 1);
    setShowDialog(false);
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setFornecedorFieldKey((k) => k + 1);
    setShowDialog(true);
  }

  function openEdit(item: RevisaoCombustivel) {
    setFornecedorFieldKey((k) => k + 1);
    setEditingId(item.id);
    setForm({
      veiculo_id: item.veiculo_id,
      fornecedor_id: item.fornecedor_id,
      data: item.data,
      valor: formatCurrencyInput(String(Math.round(item.valor * 100))),
      tipo_medicao: item.tipo_medicao || 'km',
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
    flashAfterUpdate();
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
    flashAfterUpdate();
  }

  async function handleSubmit() {
    if (!user || !form.veiculo_id || !form.fornecedor_id || !form.data || !form.valor || !form.quilometragem_atual || !form.quilometragem_proxima) {
      toast.error('Preencha os campos obrigatorios e escolha o fornecedor na lista');
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
        tipo_medicao: form.tipo_medicao,
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
                      {veiculo.placa || 'Sem placa'}
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

      <div ref={contentRef} className="rounded-xl border bg-card">
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
                <TableHead className="px-4 py-2 text-[12px]">Tipo</TableHead>
                <TableHead className="px-4 py-2 text-right text-[12px]">Atual</TableHead>
                <TableHead className="px-4 py-2 text-right text-[12px]">Próx. Revisão</TableHead>
                <TableHead className="px-4 py-2 text-right text-[12px]">Intervalo</TableHead>
                <TableHead className="px-4 py-2 text-right text-[12px]">Valor</TableHead>
                <TableHead className="px-4 py-2 text-[12px]">Obs</TableHead>
                <TableHead className="w-[88px] px-4 py-2 text-right text-[12px]">Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="h-14 text-center text-sm text-muted-foreground">
                    Nenhuma revisao registrada
                  </TableCell>
                </TableRow>
              )}

              {filtered.map((item) => {
                const intervalo = item.quilometragem_proxima - item.quilometragem_atual;
                const unidade = item.tipo_medicao === 'horas' ? 'h' : item.tipo_medicao === 'meses' ? 'meses' : 'km';

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
                    <TableCell className="px-4 py-2 text-sm uppercase">{unidade}</TableCell>
                    <TableCell className="px-4 py-2 text-right font-mono text-sm">
                      {item.quilometragem_atual.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right font-mono text-sm">
                      {item.quilometragem_proxima.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right text-sm">
                      {intervalo.toLocaleString('pt-BR')} {unidade}
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
                  <TableCell colSpan={7} className="px-4 py-2 text-right">
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
            <DialogDescription>
              Informe o veiculo, o fornecedor, o valor e a kilometragem da revisao.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <VeiculoSearchSelect
                value={form.veiculo_id}
                onChange={(veiculoId) => setForm((prev) => ({ ...prev, veiculo_id: veiculoId }))}
                veiculos={veiculos}
              />

              <FornecedorSearchSelect
                key={fornecedorFieldKey}
                value={form.fornecedor_id}
                valueMode="id"
                onChange={(fornecedorId) => setForm((prev) => ({ ...prev, fornecedor_id: fornecedorId }))}
                fornecedores={fornecedores}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-4">
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
                <Label>Tipo medição *</Label>
                <Select value={form.tipo_medicao} onValueChange={(v: 'km' | 'horas') => setForm((prev) => ({ ...prev, tipo_medicao: v }))}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="km">Quilometragem (KM)</SelectItem>
                    <SelectItem value="horas">Horímetro (Horas)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{form.tipo_medicao === 'horas' ? 'Horas atuais' : 'KM Atual'} *</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.quilometragem_atual}
                  onChange={(e) => setForm((prev) => ({ ...prev, quilometragem_atual: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>{form.tipo_medicao === 'horas' ? 'Horas próxima revisão' : 'KM próxima revisão'} *</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.quilometragem_proxima}
                  onChange={(e) => setForm((prev) => ({ ...prev, quilometragem_proxima: e.target.value }))}
                />
              </div>
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
