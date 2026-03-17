import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Fornecedor, fetchFornecedores, saveFornecedor, updateFornecedor, deleteFornecedor } from '@/lib/comprasService';
import { toast } from 'sonner';

export default function FornecedoresPage() {
  const { user, userRole } = useAuth();
  const [items, setItems] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ nome_fornecedor: '', razao_social: '', banco: '', agencia: '', conta: '', cnpj_cpf: '' });

  const load = useCallback(async () => {
    try { setItems(await fetchFornecedores()); } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(i => i.nome_fornecedor.toLowerCase().includes(search.toLowerCase()) || (i.cnpj_cpf || '').includes(search));

  function openNew() {
    setEditingId(null);
    setForm({ nome_fornecedor: '', razao_social: '', banco: '', agencia: '', conta: '', cnpj_cpf: '' });
    setShowDialog(true);
  }

  function openEdit(item: Fornecedor) {
    setEditingId(item.id);
    setForm({ nome_fornecedor: item.nome_fornecedor, razao_social: item.razao_social || '', banco: item.banco || '', agencia: item.agencia || '', conta: item.conta || '', cnpj_cpf: item.cnpj_cpf || '' });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user || !form.nome_fornecedor.trim()) { toast.error('Nome é obrigatório'); return; }
    try {
      if (editingId) {
        await updateFornecedor(editingId, form);
        toast.success('Fornecedor atualizado');
      } else {
        await saveFornecedor({ ...form, created_by: user.id } as any, user.id);
        toast.success('Fornecedor cadastrado');
      }
      setShowDialog(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este fornecedor?')) return;
    try { await deleteFornecedor(id); load(); toast.success('Excluído'); } catch (e: any) { toast.error(e.message); }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Cadastro de Fornecedores</h2>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo Fornecedor</Button>
      </div>

      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou CNPJ/CPF..." className="max-w-sm" />

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Razão Social</TableHead>
              <TableHead>CNPJ/CPF</TableHead>
              <TableHead>Banco</TableHead>
              <TableHead>Agência</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum fornecedor</TableCell></TableRow>
            )}
            {filtered.map(i => (
              <TableRow key={i.id}>
                <TableCell>{i.nome_fornecedor}</TableCell>
                <TableCell>{i.razao_social}</TableCell>
                <TableCell>{i.cnpj_cpf}</TableCell>
                <TableCell>{i.banco}</TableCell>
                <TableCell>{i.agencia}</TableCell>
                <TableCell>{i.conta}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                    {userRole === 'admin' && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(i.id)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Novo'} Fornecedor</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome *</Label><Input value={form.nome_fornecedor} onChange={e => setForm(p => ({ ...p, nome_fornecedor: e.target.value }))} /></div>
            <div><Label>Razão Social</Label><Input value={form.razao_social} onChange={e => setForm(p => ({ ...p, razao_social: e.target.value }))} /></div>
            <div><Label>CNPJ/CPF</Label><Input value={form.cnpj_cpf} onChange={e => setForm(p => ({ ...p, cnpj_cpf: e.target.value }))} /></div>
            <div><Label>Banco</Label><Input value={form.banco} onChange={e => setForm(p => ({ ...p, banco: e.target.value }))} /></div>
            <div><Label>Agência</Label><Input value={form.agencia} onChange={e => setForm(p => ({ ...p, agencia: e.target.value }))} /></div>
            <div><Label>Conta</Label><Input value={form.conta} onChange={e => setForm(p => ({ ...p, conta: e.target.value }))} /></div>
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
