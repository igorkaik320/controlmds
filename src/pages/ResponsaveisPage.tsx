import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Responsavel, fetchResponsaveis, saveResponsavel, updateResponsavel, deleteResponsavel } from '@/lib/comprasService';
import { toast } from 'sonner';

export default function ResponsaveisPage() {
  const { user, userRole } = useAuth();
  const [items, setItems] = useState<Responsavel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [nome, setNome] = useState('');

  const load = useCallback(async () => {
    try { setItems(await fetchResponsaveis()); } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(i => i.nome.toLowerCase().includes(search.toLowerCase()));

  function openNew() { setEditingId(null); setNome(''); setShowDialog(true); }
  function openEdit(item: Responsavel) { setEditingId(item.id); setNome(item.nome); setShowDialog(true); }

  async function handleSubmit() {
    if (!user || !nome.trim()) { toast.error('Nome é obrigatório'); return; }
    try {
      if (editingId) { await updateResponsavel(editingId, nome); toast.success('Atualizado'); }
      else { await saveResponsavel(nome, user.id); toast.success('Cadastrado'); }
      setShowDialog(false); load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este responsável?')) return;
    try { await deleteResponsavel(id); load(); toast.success('Excluído'); } catch (e: any) { toast.error(e.message); }
  }

  if (loading) return <div className="p-6 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Cadastro de Responsáveis</h2>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo Responsável</Button>
      </div>
      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome..." className="max-w-sm" />
      <div className="rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Cadastro</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum responsável</TableCell></TableRow>}
            {filtered.map(i => (
              <TableRow key={i.id}>
                <TableCell>{i.nome}</TableCell>
                <TableCell>{new Date(i.created_at).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                    {userRole === 'admin' && <Button size="icon" variant="ghost" onClick={() => handleDelete(i.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Novo'} Responsável</DialogTitle></DialogHeader>
          <div><Label>Nome *</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
