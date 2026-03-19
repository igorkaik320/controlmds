import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, FileDown, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { CompraFaturada, fetchComprasFaturadas, saveCompraFaturada, updateCompraFaturada, deleteCompraFaturada, fetchConfigRelatorio, formatCurrencyBR, formatDateBR } from '@/lib/comprasService';
import { exportFaturadasPDF, exportFaturadasXLSX } from '@/lib/comprasExport';
import { formatCPFCNPJ, formatCurrencyInput, parseCurrencyInput } from '@/lib/formatters';
import FornecedorSelect from '@/components/compras/FornecedorSelect';
import ObraSelect from '@/components/compras/ObraSelect';
import DateRangeFilter from '@/components/DateRangeFilter';
import { useFormDraft } from '@/hooks/useFormDraft';
import { toast } from 'sonner';
import type { Fornecedor } from '@/lib/comprasService';

const emptyForm = {
  data: '',
  fornecedor: '',
  pedido: '',
  condicao_pagamento: '',
  forma_pagamento: '',
  data_liquidacao: '',
  cnpj_cpf: '',
  valor: '',
  obra: '',
  observacao: ''
};

function calcularDataLiquidacao(data: string, dias: number) {
  if (!data || !dias) return '';
  const [y, m, d] = data.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  base.setDate(base.getDate() + dias);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ComprasFaturadasPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<CompraFaturada[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useFormDraft('fat-dateFrom', '');
  const [dateTo, setDateTo] = useFormDraft('fat-dateTo', '');
  const [filterForn, setFilterForn] = useFormDraft('fat-filterForn', '');
  const [filterObra, setFilterObra] = useFormDraft('fat-filterObra', '');
  const [observation, setObservation] = useFormDraft('fat-observation', '');

  const [form, setForm] = useFormDraft('fat-form', emptyForm);

  const load = useCallback(async () => {
    try { setItems(await fetchComprasFaturadas()); } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(i => {
    if (dateFrom && i.data < dateFrom) return false;
    if (dateTo && i.data > dateTo) return false;
    if (filterForn && !i.fornecedor.toLowerCase().includes(filterForn.toLowerCase())) return false;
    if (filterObra && !(i.obra || '').toLowerCase().includes(filterObra.toLowerCase())) return false;
    return true;
  });

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setShowDialog(true);
  }

  function openEdit(item: CompraFaturada) {
    setEditingId(item.id);
    setForm({
      data: item.data,
      fornecedor: item.fornecedor,
      pedido: item.pedido || '',
      condicao_pagamento: '',
      forma_pagamento: item.forma_pagamento || '',
      data_liquidacao: item.data_liquidacao || '',
      cnpj_cpf: item.cnpj_cpf || '',
      valor: String(item.valor),
      obra: item.obra || '',
      observacao: item.observacao || ''
    });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user || !form.data || !form.fornecedor || !form.valor) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    try {
      const { condicao_pagamento, ...rest } = form;
      const payload = { ...rest, valor: parseCurrencyInput(form.valor), created_by: user.id };
      if (editingId) {
        await updateCompraFaturada(editingId, payload);
        toast.success('Registro atualizado');
      } else {
        await saveCompraFaturada(payload as any);
        toast.success('Registro cadastrado');
      }
      setShowDialog(false);
      setForm(emptyForm);
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este registro?')) return;
    try { await deleteCompraFaturada(id); load(); toast.success('Excluído'); } catch (e: any) { toast.error(e.message); }
  }

  async function handleExportPDF() {
    const config = await fetchConfigRelatorio();
    exportFaturadasPDF(filtered, config, observation);
  }

  function handleFornecedorSelect(f: Fornecedor) {
    setForm((prev: typeof emptyForm) => ({
      ...prev,
      cnpj_cpf: f.cnpj_cpf || prev.cnpj_cpf
    }));
  }

  function handleCondicaoChange(dias: string) {
    const diasNum = parseInt(dias) || 0;
    setForm((prev: typeof emptyForm) => ({
      ...prev,
      condicao_pagamento: dias,
      data_liquidacao: prev.data ? calcularDataLiquidacao(prev.data, diasNum) : prev.data_liquidacao
    }));
  }

  function handleDataChange(data: string) {
    const diasNum = parseInt(form.condicao_pagamento) || 0;
    setForm((prev: typeof emptyForm) => ({
      ...prev,
      data,
      data_liquidacao: diasNum > 0 ? calcularDataLiquidacao(data, diasNum) : prev.data_liquidacao
    }));
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Compras Faturadas</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
          <Button variant="outline" size="sm" onClick={() => exportFaturadasXLSX(filtered, observation)}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <Label className="text-xs">Fornecedor</Label>
          <Input value={filterForn} onChange={e => setFilterForn(e.target.value)} placeholder="Filtrar..." className="w-40" />
        </div>
        <div>
          <Label className="text-xs">Obra</Label>
          <Input value={filterObra} onChange={e => setFilterObra(e.target.value)} placeholder="Filtrar..." className="w-40" />
        </div>
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} />
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Observação do relatório</Label>
          <Textarea value={observation} onChange={e => setObservation(e.target.value)} rows={1} placeholder="Observação..." />
        </div>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Forma Pgto</TableHead>
              <TableHead>Liquidação</TableHead>
              <TableHead>CNPJ/CPF</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Obra</TableHead>
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
                <TableCell>{i.fornecedor}</TableCell>
                <TableCell>{i.pedido}</TableCell>
                <TableCell>{i.forma_pagamento}</TableCell>
                <TableCell>{i.data_liquidacao ? formatDateBR(i.data_liquidacao) : ''}</TableCell>
                <TableCell>{i.cnpj_cpf}</TableCell>
                <TableCell className="text-right">{formatCurrencyBR(i.valor)}</TableCell>
                <TableCell>{i.obra}</TableCell>
                <TableCell className="max-w-[120px] truncate">{i.observacao}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(i.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-right font-bold">
        Total: {formatCurrencyBR(filtered.reduce((s, i) => s + i.valor, 0))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Nova'} Compra Faturada</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Data *</Label><Input type="date" value={form.data} onChange={e => handleDataChange(e.target.value)} /></div>
            <FornecedorSelect value={form.fornecedor} onChange={v => setForm((p: typeof emptyForm) => ({ ...p, fornecedor: v }))} onFornecedorSelect={handleFornecedorSelect} />
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Pedido</Label><Input value={form.pedido} onChange={e => setForm((p: typeof emptyForm) => ({ ...p, pedido: e.target.value }))} /></div>
              <div><Label>Forma de Pagamento</Label><Input value={form.forma_pagamento} onChange={e => setForm((p: typeof emptyForm) => ({ ...p, forma_pagamento: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Condição de Pagamento (dias)</Label><Input type="number" placeholder="Ex: 30" value={form.condicao_pagamento} onChange={e => handleCondicaoChange(e.target.value)} /></div>
              <div><Label>Data Liquidação</Label><Input type="date" value={form.data_liquidacao} onChange={e => setForm((p: typeof emptyForm) => ({ ...p, data_liquidacao: e.target.value }))} /></div>
            </div>
            <div><Label>CNPJ/CPF</Label><Input value={form.cnpj_cpf} onChange={e => setForm((p: typeof emptyForm) => ({ ...p, cnpj_cpf: formatCPFCNPJ(e.target.value) }))} maxLength={18} /></div>
            <div><Label>Valor *</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm((p: typeof emptyForm) => ({ ...p, valor: e.target.value }))} /></div>
            <div><Label>Obra</Label><ObraSelect value={form.obra} onChange={v => setForm((p: typeof emptyForm) => ({ ...p, obra: v }))} /></div>
            <div><Label>Observação</Label><Textarea value={form.observacao} onChange={e => setForm((p: typeof emptyForm) => ({ ...p, observacao: e.target.value }))} /></div>
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
