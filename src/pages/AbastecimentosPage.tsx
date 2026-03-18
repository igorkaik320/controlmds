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
import {
  Abastecimento, VeiculoMaquina, TipoCombustivel,
  fetchAbastecimentos, saveAbastecimento, updateAbastecimento, deleteAbastecimento,
  fetchVeiculos, fetchTiposCombustivel,
} from '@/lib/combustivelService';
import { formatCurrencyBR, formatDateBR } from '@/lib/comprasService';
import { formatCurrencyInput, parseCurrencyInput } from '@/lib/formatters';
import { exportAbastecimentosPDF, exportAbastecimentosXLSX } from '@/lib/combustivelExport';
import DateRangeFilter from '@/components/DateRangeFilter';
import { toast } from 'sonner';

const emptyForm = { veiculo_id: '', nfe: '', data: '', combustivel_id: '', quantidade_litros: '', valor_unitario: '', observacao: '' };

export default function AbastecimentosPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Abastecimento[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoMaquina[]>([]);
  const [combustiveis, setCombustiveis] = useState<TipoCombustivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterVeiculo, setFilterVeiculo] = useState('');
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try {
      const [abs, veic, comb] = await Promise.all([fetchAbastecimentos(), fetchVeiculos(), fetchTiposCombustivel()]);
      setItems(abs); setVeiculos(veic); setCombustiveis(comb);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(i => {
    if (dateFrom && i.data < dateFrom) return false;
    if (dateTo && i.data > dateTo) return false;
    if (filterVeiculo && i.veiculo_id !== filterVeiculo) return false;
    return true;
  });

  const totalGeral = filtered.reduce((s, i) => s + i.valor_total, 0);
  const totalLitros = filtered.reduce((s, i) => s + i.quantidade_litros, 0);

  function openNew() { setEditingId(null); setForm(emptyForm); setShowDialog(true); }

  function openEdit(item: Abastecimento) {
    setEditingId(item.id);
    setForm({
      veiculo_id: item.veiculo_id,
      nfe: item.nfe || '',
      data: item.data,
      combustivel_id: item.combustivel_id,
      quantidade_litros: String(item.quantidade_litros),
      valor_unitario: String(item.valor_unitario),
      observacao: item.observacao || '',
    });
    setShowDialog(true);
  }

  const calcTotal = (qtd: string, vunit: string) => {
    const q = parseFloat(qtd) || 0;
    const v = parseFloat(vunit) || 0;
    return q * v;
  };

  async function handleSubmit() {
    if (!user || !form.veiculo_id || !form.data || !form.combustivel_id || !form.quantidade_litros || !form.valor_unitario) {
      toast.error('Preencha os campos obrigatórios'); return;
    }
    try {
      const qtd = parseFloat(form.quantidade_litros);
      const vunit = parseFloat(form.valor_unitario);
      const payload = {
        veiculo_id: form.veiculo_id,
        nfe: form.nfe || null,
        data: form.data,
        combustivel_id: form.combustivel_id,
        quantidade_litros: qtd,
        valor_unitario: vunit,
        valor_total: qtd * vunit,
        observacao: form.observacao || null,
        created_by: user.id,
      };
      if (editingId) {
        await updateAbastecimento(editingId, payload as any);
        toast.success('Atualizado');
      } else {
        await saveAbastecimento(payload);
        toast.success('Cadastrado');
      }
      setShowDialog(false); setForm(emptyForm); load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir?')) return;
    try { await deleteAbastecimento(id); load(); toast.success('Excluído'); } catch (e: any) { toast.error(e.message); }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Abastecimentos</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportAbastecimentosPDF(filtered)}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
          <Button variant="outline" size="sm" onClick={() => exportAbastecimentosXLSX(filtered)}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} />
        <div>
          <Label className="text-xs">Veículo</Label>
          <Select value={filterVeiculo} onValueChange={setFilterVeiculo}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {veiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.modelo} - {v.placa}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Veículo</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>NF-e</TableHead>
              <TableHead>Combustível</TableHead>
              <TableHead className="text-right">Qtd (L)</TableHead>
              <TableHead className="text-right">Valor Unit.</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead>Obs</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Nenhum registro</TableCell></TableRow>
            )}
            {filtered.map(i => (
              <TableRow key={i.id}>
                <TableCell>{formatDateBR(i.data)}</TableCell>
                <TableCell>{i.veiculo?.modelo || ''}</TableCell>
                <TableCell>{i.veiculo?.placa || ''}</TableCell>
                <TableCell>{i.nfe}</TableCell>
                <TableCell>{i.combustivel?.nome || ''}</TableCell>
                <TableCell className="text-right">{i.quantidade_litros.toFixed(2)}</TableCell>
                <TableCell className="text-right">{formatCurrencyBR(i.valor_unitario)}</TableCell>
                <TableCell className="text-right">{formatCurrencyBR(i.valor_total)}</TableCell>
                <TableCell className="max-w-[120px] truncate">{i.observacao}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(i.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length > 0 && (
              <TableRow className="font-bold bg-muted/50">
                <TableCell colSpan={5} className="text-right">TOTAL</TableCell>
                <TableCell className="text-right">{totalLitros.toFixed(2)}</TableCell>
                <TableCell />
                <TableCell className="text-right">{formatCurrencyBR(totalGeral)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Novo'} Abastecimento</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Veículo *</Label>
              <Select value={form.veiculo_id} onValueChange={v => setForm(p => ({ ...p, veiculo_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar veículo" /></SelectTrigger>
                <SelectContent>
                  {veiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.modelo} - {v.placa} ({v.tipo === 'veiculo' ? 'Veículo' : 'Máquina'})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Data *</Label><Input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} /></div>
              <div><Label>NF-e</Label><Input value={form.nfe} onChange={e => setForm(p => ({ ...p, nfe: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Combustível *</Label>
              <Select value={form.combustivel_id} onValueChange={v => setForm(p => ({ ...p, combustivel_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar combustível" /></SelectTrigger>
                <SelectContent>
                  {combustiveis.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Qtd (L) *</Label><Input type="number" step="0.01" value={form.quantidade_litros} onChange={e => setForm(p => ({ ...p, quantidade_litros: e.target.value }))} /></div>
              <div><Label>Valor Unit. *</Label><Input type="number" step="0.01" value={form.valor_unitario} onChange={e => setForm(p => ({ ...p, valor_unitario: e.target.value }))} /></div>
              <div>
                <Label>Total</Label>
                <Input readOnly value={formatCurrencyBR(calcTotal(form.quantidade_litros, form.valor_unitario))} className="bg-muted" />
              </div>
            </div>
            <div><Label>Observação</Label><Textarea value={form.observacao} onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
