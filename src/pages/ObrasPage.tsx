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
import { toast } from 'sonner';

export default function ObrasPage() {
  const { user, userRole } = useAuth();
  const [items, setItems] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ nome: '', descricao: '' });

  const load = useCallback(async () => {
    try { setItems(await fetchObras()); } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(i => i.nome.toLowerCase().includes(search.toLowerCase()));

  function openNew() {
    setEditingId(null);
    setForm({ nome: '', descricao: '' });
    setShowDialog(true);
  }

  function openEdit(item: Obra) {
    setEditingId(item.id);
    setForm({ nome: item.nome, descricao: item.descricao || '' });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user || !form.nome.trim()) { toast.error('Nome é obrigatório'); return; }
    try {
      if (editingId) {
        await updateObra(editingId, form.nome, form.descricao || null);
        toast.success('Obra atualizada');
      } else {
        await saveObra(form.nome, form.descricao || null, user.id);
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

      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome..." className="max-w-sm" />

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhuma obra</TableCell></TableRow>
            )}
            {filtered.map(i => (
              <TableRow key={i.id}>
                <TableCell>{i.nome}</TableCell>
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
