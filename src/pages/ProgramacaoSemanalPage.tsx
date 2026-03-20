import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, FileDown, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { ProgramacaoSemanal, fetchProgramacaoSemanal, saveProgramacaoSemanal, updateProgramacaoSemanal, deleteProgramacaoSemanal, fetchConfigRelatorio, formatCurrencyBR, formatDateBR } from '@/lib/comprasService';
import { exportProgramacaoSemanalPDF, exportProgramacaoSemanalXLSX } from '@/lib/comprasExport';
import { formatCPFCNPJ, formatCurrencyInput, parseCurrencyInput } from '@/lib/formatters';
import FornecedorSelect from '@/components/compras/FornecedorSelect';
import ObraSelect from '@/components/compras/ObraSelect';
import ResponsavelSelect from '@/components/compras/ResponsavelSelect';
import DateRangeFilter from '@/components/DateRangeFilter';
import { useFormDraft } from '@/hooks/useFormDraft';
import { toast } from 'sonner';
import type { Fornecedor } from '@/lib/comprasService';

const emptyForm = { data: '', fornecedor: '', pedido: '', banco: '', agencia: '', conta: '', cnpj_cpf: '', valor: '', obra: '', observacao: '', responsavel: '' };

export default function ProgramacaoSemanalPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete, canExport } = useModulePermissions();
  const [items, setItems] = useState<ProgramacaoSemanal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useFormDraft('ps-dateFrom', '');
  const [dateTo, setDateTo] = useFormDraft('ps-dateTo', '');
  const [filterForn, setFilterForn] = useFormDraft('ps-filterForn', '');
  const [filterObra, setFilterObra] = useFormDraft('ps-filterObra', '');
  const [filterResp, setFilterResp] = useFormDraft('ps-filterResp', '');
  const [observation, setObservation] = useFormDraft('ps-observation', '');
  const [form, setForm] = useFormDraft('ps-form', emptyForm);

  const load = useCallback(async () => {
    try { setItems(await fetchProgramacaoSemanal()); } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(i => {
    if (dateFrom && i.data < dateFrom) return false;
    if (dateTo && i.data > dateTo) return false;
    if (filterForn && !i.fornecedor.toLowerCase().includes(filterForn.toLowerCase())) return false;
    if (filterObra && !(i.obra || '').toLowerCase().includes(filterObra.toLowerCase())) return false;
    if (filterResp && !(i.responsavel || '').toLowerCase().includes(filterResp.toLowerCase())) return false;
    return true;
  });

  function openNew() { setEditingId(null); setForm(emptyForm); setShowDialog(true); }

  function openEdit(item: ProgramacaoSemanal) {
    setEditingId(item.id);
    setForm({ data: item.data, fornecedor: item.fornecedor, pedido: item.pedido || '', banco: item.banco || '', agencia: item.agencia || '', conta: item.conta || '', cnpj_cpf: item.cnpj_cpf || '', valor: formatCurrencyInput(String(Math.round(item.valor * 100))), obra: item.obra || '', observacao: item.observacao || '', responsavel: item.responsavel || '' });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user || !form.data || !form.fornecedor || !form.valor) { toast.error('Preencha os campos obrigatórios'); return; }
    try {
      const payload = { ...form, valor: parseCurrencyInput(form.valor), created_by: user.id };
      if (editingId) { await updateProgramacaoSemanal(editingId, payload); toast.success('Registro atualizado'); }
      else { await saveProgramacaoSemanal(payload as any); toast.success('Registro cadastrado'); }
      setShowDialog(false); setForm(emptyForm); load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este registro?')) return;
    try { await deleteProgramacaoSemanal(id); load(); toast.success('Excluído'); } catch (e: any) { toast.error(e.message); }
  }

  async function handleExportPDF() {
    const config = await fetchConfigRelatorio();
    exportProgramacaoSemanalPDF(filtered, config, observation);
  }

  function handleFornecedorSelect(f: Fornecedor) {
    setForm(prev => ({ ...prev, banco: f.banco || prev.banco, agencia: f.agencia || prev.agencia, conta: f.conta || prev.conta, cnpj_cpf: f.cnpj_cpf || prev.cnpj_cpf }));
  }

  if (loading) return <div className="p-6 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Programação Semanal</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
          <Button variant="outline" size="sm" onClick={() => exportProgramacaoSemanalXLSX(filtered, observation)}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} />
        <div><Label className="text-xs">Fornecedor</Label><Input value={filterForn} onChange={e => setFilterForn(e.target.value)} placeholder="Filtrar..." className="w-40" /></div>
        <div><Label className="text-xs">Obra</Label><Input value={filterObra} onChange={e => setFilterObra(e.target.value)} placeholder="Filtrar..." className="w-40" /></div>
        <div><Label className="text-xs">Responsável</Label><Input value={filterResp} onChange={e => setFilterResp(e.target.value)} placeholder="Filtrar..." className="w-40" /></div>
      </div>

      <div><Label className="text-xs">Observação do relatório</Label><Textarea value={observation} onChange={e => setObservation(e.target.value)} rows={2} /></div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead>Fornecedor</TableHead><TableHead>Pedido</TableHead><TableHead>Banco</TableHead><TableHead>Agência</TableHead>
            <TableHead>Conta</TableHead><TableHead>CNPJ/CPF</TableHead><TableHead>Valor</TableHead><TableHead>Obra</TableHead>
            <TableHead>Responsável</TableHead><TableHead>Obs.</TableHead><TableHead>Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground">Nenhum registro</TableCell></TableRow>}
            {filtered.map(i => (
              <TableRow key={i.id}>
                <TableCell>{formatDateBR(i.data)}</TableCell><TableCell>{i.fornecedor}</TableCell><TableCell>{i.pedido}</TableCell>
                <TableCell>{i.banco}</TableCell><TableCell>{i.agencia}</TableCell><TableCell>{i.conta}</TableCell>
                <TableCell>{i.cnpj_cpf}</TableCell><TableCell className="font-mono">{formatCurrencyBR(i.valor)}</TableCell>
                <TableCell>{i.obra}</TableCell><TableCell>{i.responsavel}</TableCell><TableCell className="max-w-[120px] truncate">{i.observacao}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(i.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length > 0 && (
              <TableRow className="font-bold bg-muted/50">
                <TableCell colSpan={7} className="text-right">TOTAL</TableCell>
                <TableCell className="font-mono">{formatCurrencyBR(filtered.reduce((s, i) => s + i.valor, 0))}</TableCell>
                <TableCell colSpan={4} />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Novo'} Lançamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Data *</Label><Input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} /></div>
            <FornecedorSelect value={form.fornecedor} onChange={v => setForm(p => ({ ...p, fornecedor: v }))} onFornecedorSelect={handleFornecedorSelect} />
            <div><Label>Pedido</Label><Input value={form.pedido} onChange={e => setForm(p => ({ ...p, pedido: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Banco</Label><Input value={form.banco} onChange={e => setForm(p => ({ ...p, banco: e.target.value }))} /></div>
              <div><Label>Agência</Label><Input value={form.agencia} onChange={e => setForm(p => ({ ...p, agencia: e.target.value }))} /></div>
              <div><Label>Conta</Label><Input value={form.conta} onChange={e => setForm(p => ({ ...p, conta: e.target.value }))} /></div>
            </div>
            <div><Label>CNPJ/CPF</Label><Input value={form.cnpj_cpf} onChange={e => setForm(p => ({ ...p, cnpj_cpf: formatCPFCNPJ(e.target.value) }))} maxLength={18} /></div>
            <div><Label>Valor *</Label><Input value={form.valor} onChange={e => setForm(p => ({ ...p, valor: formatCurrencyInput(e.target.value) }))} placeholder="R$ 0,00" /></div>
            <div><Label>Obra</Label><ObraSelect value={form.obra} onChange={v => setForm(p => ({ ...p, obra: v }))} /></div>
            <ResponsavelSelect value={form.responsavel} onChange={v => setForm(p => ({ ...p, responsavel: v }))} />
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
