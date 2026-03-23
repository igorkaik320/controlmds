import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, FileDown, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  Abastecimento,
  VeiculoMaquina,
  TipoCombustivel,
  PostoCombustivel,
  fetchAbastecimentos,
  saveAbastecimento,
  updateAbastecimento,
  deleteAbastecimento,
  fetchVeiculos,
  fetchTiposCombustivel,
  fetchPostosCombustivel,
} from '@/lib/combustivelService';
import { Obra, fetchObras } from '@/lib/obrasService';
import { formatCurrencyBR, formatDateBR } from '@/lib/comprasService';
import { exportAbastecimentosPDF, exportAbastecimentosXLSX } from '@/lib/combustivelExport';
import DateRangeFilter from '@/components/DateRangeFilter';
import { toast } from 'sonner';
import { fetchProfiles } from '@/lib/cashRegister';
import AuditInfo from '@/components/AuditInfo';

const emptyForm = {
  veiculo_id: '',
  obra_id: '',
  posto_id: '',
  nfe: '',
  data: '',
  combustivel_id: '',
  quantidade_litros: '',
  valor_unitario: '',
  observacao: '',
};

export default function AbastecimentosPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete, canExport } = useModulePermissions();
  const [items, setItems] = useState<Abastecimento[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoMaquina[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [combustiveis, setCombustiveis] = useState<TipoCombustivel[]>([]);
  const [postos, setPostos] = useState<PostoCombustivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterVeiculo, setFilterVeiculo] = useState('all');
  const [filterObra, setFilterObra] = useState('all');
  const [filterPosto, setFilterPosto] = useState('all');
  const [form, setForm] = useState(emptyForm);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [abs, veic, obrasData, comb, postosData, profiles] = await Promise.all([
        fetchAbastecimentos(),
        fetchVeiculos(),
        fetchObras(),
        fetchTiposCombustivel(),
        fetchPostosCombustivel(),
        fetchProfiles(),
      ]);
      setItems(abs);
      setVeiculos(veic);
      setObras(obrasData);
      setCombustiveis(comb);
      setPostos(postosData);
      setProfileMap(profiles);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((item) => {
    if (dateFrom && item.data < dateFrom) return false;
    if (dateTo && item.data > dateTo) return false;
    if (filterVeiculo !== 'all' && item.veiculo_id !== filterVeiculo) return false;
    if (filterObra !== 'all' && (item.obra_id || '') !== filterObra) return false;
    if (filterPosto !== 'all' && (item.posto_id || '') !== filterPosto) return false;
    return true;
  });

  const totalGeral = filtered.reduce((sum, item) => sum + item.valor_total, 0);
  const totalLitros = filtered.reduce((sum, item) => sum + item.quantidade_litros, 0);

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

  function openEdit(item: Abastecimento) {
    setEditingId(item.id);
    setForm({
      veiculo_id: item.veiculo_id,
      obra_id: item.obra_id || '',
      posto_id: item.posto_id || '',
      nfe: item.nfe || '',
      data: item.data,
      combustivel_id: item.combustivel_id,
      quantidade_litros: String(item.quantidade_litros),
      valor_unitario: String(item.valor_unitario),
      observacao: item.observacao || '',
    });
    setShowDialog(true);
  }

  function calcTotal(qtd: string, valorUnitario: string) {
    const quantidade = parseFloat(qtd) || 0;
    const valor = parseFloat(valorUnitario) || 0;
    return quantidade * valor;
  }

  async function handleSubmit() {
    if (!user || !form.veiculo_id || !form.data || !form.combustivel_id || !form.quantidade_litros || !form.valor_unitario) {
      toast.error('Preencha os campos obrigatorios');
      return;
    }

    try {
      const quantidade = parseFloat(form.quantidade_litros);
      const valorUnitario = parseFloat(form.valor_unitario);

      const payload = {
        veiculo_id: form.veiculo_id,
        obra_id: form.obra_id || null,
        posto_id: form.posto_id || null,
        nfe: form.nfe || null,
        data: form.data,
        combustivel_id: form.combustivel_id,
        quantidade_litros: quantidade,
        valor_unitario: valorUnitario,
        valor_total: quantidade * valorUnitario,
        observacao: form.observacao || null,
        created_by: user.id,
      };

      if (editingId) {
        await updateAbastecimento(editingId, { ...payload, updated_by: user.id } as any);
        toast.success('Atualizado');
      } else {
        await saveAbastecimento(payload);
        toast.success('Cadastrado');
      }

      resetDialogDraft();
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir?')) return;

    try {
      await deleteAbastecimento(id);
      load();
      toast.success('Excluido');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Abastecimentos</h2>
        <div className="flex gap-2">
          {canExport('abastecimentos') && (
            <>
              <Button variant="outline" size="sm" onClick={() => exportAbastecimentosPDF(filtered)}>
                <FileDown className="h-4 w-4 mr-1" />PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportAbastecimentosXLSX(filtered)}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
              </Button>
            </>
          )}
          {canCreate('abastecimentos') && (
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" />Novo
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />

        <div>
          <Label className="text-xs">Veiculo</Label>
          <Select value={filterVeiculo} onValueChange={setFilterVeiculo}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {veiculos.map((veiculo) => (
                <SelectItem key={veiculo.id} value={veiculo.id}>
                  {veiculo.placa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Obra</Label>
          <Select value={filterObra} onValueChange={setFilterObra}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {obras.map((obra) => (
                <SelectItem key={obra.id} value={obra.id}>
                  {obra.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Posto</Label>
          <Select value={filterPosto} onValueChange={setFilterPosto}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {postos.map((posto) => (
                <SelectItem key={posto.id} value={posto.id}>
                  {posto.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Veiculo</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Posto</TableHead>
              <TableHead>NF-e</TableHead>
              <TableHead>Combustivel</TableHead>
              <TableHead className="text-right">Qtd (L)</TableHead>
              <TableHead className="text-right">Valor Unit.</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead>Obs</TableHead>
              <TableHead></TableHead>
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

            {filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{formatDateBR(item.data)}</TableCell>
                <TableCell>{item.veiculo?.placa || ''}</TableCell>
                <TableCell>{item.obra?.nome || '—'}</TableCell>
                <TableCell>{item.posto?.nome || '—'}</TableCell>
                <TableCell>{item.nfe || '—'}</TableCell>
                <TableCell>{item.combustivel?.nome || ''}</TableCell>
                <TableCell className="text-right">{item.quantidade_litros.toFixed(2)}</TableCell>
                <TableCell className="text-right">{formatCurrencyBR(item.valor_unitario)}</TableCell>
                <TableCell className="text-right">{formatCurrencyBR(item.valor_total)}</TableCell>
                <TableCell className="max-w-[140px]">
                  <div className="text-sm truncate">{item.observacao || '—'}</div>
                  <div className="mt-1">
                    <AuditInfo
                      createdBy={item.created_by}
                      createdAt={item.created_at}
                      updatedBy={item.updated_by}
                      updatedAt={item.updated_at}
                      profileMap={profileMap}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {canEdit('abastecimentos') && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete('abastecimentos') && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {filtered.length > 0 && (
              <TableRow className="font-bold bg-muted/50">
                <TableCell colSpan={6} className="text-right">TOTAL</TableCell>
                <TableCell className="text-right">{totalLitros.toFixed(2)}</TableCell>
                <TableCell />
                <TableCell className="text-right">{formatCurrencyBR(totalGeral)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            )}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Novo'} Abastecimento</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div>
              <Label>Veiculo *</Label>
              <Select value={form.veiculo_id} onValueChange={(value) => setForm((prev) => ({ ...prev, veiculo_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar veiculo" />
                </SelectTrigger>
                <SelectContent>
                  {veiculos.map((veiculo) => (
                    <SelectItem key={veiculo.id} value={veiculo.id}>
                      {veiculo.placa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Obra</Label>
              <Select
                value={form.obra_id || '_none'}
                onValueChange={(value) => setForm((prev) => ({ ...prev, obra_id: value === '_none' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar obra" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nao informada</SelectItem>
                  {obras.map((obra) => (
                    <SelectItem key={obra.id} value={obra.id}>
                      {obra.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Posto</Label>
              <Select
                value={form.posto_id || '_none'}
                onValueChange={(value) => setForm((prev) => ({ ...prev, posto_id: value === '_none' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar posto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nao informado</SelectItem>
                  {postos.map((posto) => (
                    <SelectItem key={posto.id} value={posto.id}>
                      {posto.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Data *</Label>
                <Input type="date" value={form.data} onChange={(e) => setForm((prev) => ({ ...prev, data: e.target.value }))} />
              </div>
              <div>
                <Label>NF-e</Label>
                <Input value={form.nfe} onChange={(e) => setForm((prev) => ({ ...prev, nfe: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label>Combustivel *</Label>
              <Select value={form.combustivel_id} onValueChange={(value) => setForm((prev) => ({ ...prev, combustivel_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar combustivel" />
                </SelectTrigger>
                <SelectContent>
                  {combustiveis.map((combustivel) => (
                    <SelectItem key={combustivel.id} value={combustivel.id}>
                      {combustivel.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Qtd (L) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.quantidade_litros}
                  onChange={(e) => setForm((prev) => ({ ...prev, quantidade_litros: e.target.value }))}
                />
              </div>

              <div>
                <Label>Valor Unit. *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor_unitario}
                  onChange={(e) => setForm((prev) => ({ ...prev, valor_unitario: e.target.value }))}
                />
              </div>

              <div>
                <Label>Total</Label>
                <Input
                  readOnly
                  value={formatCurrencyBR(calcTotal(form.quantidade_litros, form.valor_unitario))}
                  className="bg-muted"
                />
              </div>
            </div>

            <div>
              <Label>Observacao</Label>
              <Textarea
                value={form.observacao}
                onChange={(e) => setForm((prev) => ({ ...prev, observacao: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetDialogDraft}>Cancelar</Button>
            <Button onClick={handleSubmit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
