import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, FileDown, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { CompraAvista, fetchComprasAvista, saveCompraAvista, updateCompraAvista, deleteCompraAvista, fetchConfigRelatorio, formatCurrencyBR, formatDateBR } from '@/lib/comprasService';
import { exportAvistaPDF, exportAvistaXLSX } from '@/lib/comprasExport';
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
  banco: '',
  agencia: '',
  conta: '',
  cnpj_cpf: '',
  valor: '',
  obra: '',
  observacao: ''
};

export default function ComprasAvistaPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<CompraAvista[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useFormDraft('av-dateFrom', '');
  const [dateTo, setDateTo] = useFormDraft('av-dateTo', '');
  const [filterForn, setFilterForn] = useFormDraft('av-filterForn', '');
  const [filterObra, setFilterObra] = useFormDraft('av-filterObra', '');
  const [observation, setObservation] = useFormDraft('av-observation', '');

  const [form, setForm] = useFormDraft('av-form', emptyForm);

  const load = useCallback(async () => {
    try { setItems(await fetchComprasAvista()); } catch (e: any) { toast.error(e.message); }
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

  function openEdit(item: CompraAvista) {
    setEditingId(item.id);
    setForm({
      data: item.data,
      fornecedor: item.fornecedor,
      pedido: item.pedido || '',
      banco: item.banco || '',
      agencia: item.agencia || '',
      conta: item.conta || '',
      cnpj_cpf: item.cnpj_cpf || '',
      valor: String(item.valor),
      obra: item.obra || '',
      observacao: item.observacao || ''
    });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user || !form.data || !form.fornecedor || !form.valor) { toast.error('Preencha os campos obrigatórios'); return; }
    try {
      const payload = { ...form, valor: parseCurrencyInput(form.valor), created_by: user.id };
      if (editingId) {
        await updateCompraAvista(editingId, payload);
        toast.success('Registro atualizado');
      } else {
        await saveCompraAvista(payload as any);
        toast.success('Registro cadastrado');
      }
      setShowDialog(false);
      setForm(emptyForm);
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este registro?')) return;
    try { await deleteCompraAvista(id); load(); toast.success('Excluído'); } catch (e: any) { toast.error(e.message); }
  }

  async function handleExportPDF() {
    const config = await fetchConfigRelatorio();
    exportAvistaPDF(filtered, config, observation);
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

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Compras à Vista por Obra</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
          <Button variant="outline" size="sm" onClick={() => exportAvistaXLSX(filtered, observation)}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
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
              <TableHead>Banco</TableHead>
              <TableHead>Agência</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead>CNPJ/CPF</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Obs</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">Nenhum registro</TableCell></TableRow>
            )}
            {filtered.map(i => (
              <TableRow key={i.id}>
                <TableCell>{formatDateBR(i.data)}</TableCell>
                <TableCell>{i.fornecedor}</TableCell>
                <TableCell>{i.pedido}</TableCell>
                <TableCell>{i.banco}</TableCell>
                <TableCell>{i.agencia}</TableCell>
                <TableCell>{i.conta}</TableCell>
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Nova'} Compra à Vista</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Data *</Label><Input type="date" value={form.data} onChange={e => setForm((p: typeof emptyForm) => ({ ...p, data: e.target.value }))} /></div>
            <FornecedorSelect value={form.fornecedor} onChange={v => setForm((p: typeof emptyForm) => ({ ...p, fornecedor: v }))} onFornecedorSelect={handleFornecedorSelect} />
            <div><Label>Pedido</Label><Input value={form.pedido} onChange={e => setForm((p: typeof emptyForm) => ({ ...p, pedido: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Banco</Label><Input value={form.banco} onChange={e => setForm((p: typeof emptyForm) => ({ ...p, banco: e.target.value }))} /></div>
              <div><Label>Agência</Label><Input value={form.agencia} onChange={e => setForm((p: typeof emptyForm) => ({ ...p, agencia: e.target.value }))} /></div>
              <div><Label>Conta</Label><Input value={form.conta} onChange={e => setForm((p: typeof emptyForm) => ({ ...p, conta: e.target.value }))} /></div>
            </div>
            <div><Label>CNPJ/CPF</Label><Input value={form.cnpj_cpf} onChange={e => setForm((p: typeof emptyForm) => ({ ...p, cnpj_cpf: formatCPFCNPJ(e.target.value) }))} maxLength={18} /></div>
            <div><Label>Valor *</Label><Input value={form.valor} onChange={e => setForm((p: typeof emptyForm) => ({ ...p, valor: formatCurrencyInput(e.target.value) }))} placeholder="R$ 0,00" /></div>
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
