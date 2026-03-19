import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Obra, fetchObras, saveObra, updateObra, deleteObra } from '@/lib/obrasService';
import { fetchEmpresas, Empresa } from '@/lib/empresasService';
import EmpresaSelect from '@/components/compras/EmpresaSelect';
import { toast } from 'sonner';

export default function ObrasPage() {
  const { user, userRole } = useAuth();
  const [items, setItems] = useState<Obra[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [form, setForm] = useState({ nome: '', descricao: '', empresa_id: '' });

  const load = useCallback(async () => {
    try {
      const [obrasData, empresasData] = await Promise.all([fetchObras(), fetchEmpresas()]);
      setItems(obrasData);
      setEmpresas(empresasData);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const empresaMap = new Map(empresas.map(e => [e.id, e.nome]));

  const filtered = items.filter(i => {
    if (search && !i.nome.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterEmpresa && i.empresa_id !== filterEmpresa) return false;
    return true;
  });

  function openNew() {
    setEditingId(null);
    setForm({ nome: '', descricao: '', empresa_id: '' });
    setShowDialog(true);
  }

  function openEdit(item: Obra) {
    setEditingId(item.id);
    setForm({ nome: item.nome, descricao: item.descricao || '', empresa_id: item.empresa_id || '' });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user || !form.nome.trim()) { toast.error('Nome é obrigatório'); return; }
    try {
      if (editingId) {
        await updateObra(editingId, form.nome, form.descricao || null, form.empresa_id || null);
        toast.success('Obra atualizada');
      } else {
        await saveObra(form.nome, form.descricao || null, user.id, form.empresa_id || null);
        toast.success('Obra cadastrada');
      }
      setShowDialog(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta obra?')) return;
    try { await deleteObra(id); load(); toast.success('Excluída'); } catch (e: any) { toast.error(e.message); }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Cadastro de Obras</h2>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nova Obra</Button>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome..." className="max-w-xs" />
        <div className="w-48">
          <EmpresaSelect value={filterEmpresa} onChange={setFilterEmpresa} label="Filtrar por empresa" allowAll />
        </div>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma obra</TableCell></TableRow>
            )}
            {filtered.map(i => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.nome}</TableCell>
                <TableCell>{i.empresa_id ? empresaMap.get(i.empresa_id) || '-' : '-'}</TableCell>
                <TableCell>{i.descricao}</TableCell>
                <TableCell>{new Date(i.created_at).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                    {(userRole === 'admin' || i.created_by === user?.id) && (
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
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Nova'} Obra</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} /></div>
            <EmpresaSelect value={form.empresa_id} onChange={v => setForm(p => ({ ...p, empresa_id: v }))} label="Empresa" allowAll />
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} /></div>
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
