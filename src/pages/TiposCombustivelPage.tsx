import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { TipoCombustivel, fetchTiposCombustivel, saveTipoCombustivel, updateTipoCombustivel, deleteTipoCombustivel } from '@/lib/combustivelService';
import { toast } from 'sonner';

export default function TiposCombustivelPage() {
  const { user, userRole } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const [items, setItems] = useState<TipoCombustivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('');

  const load = useCallback(async () => {
    try { setItems(await fetchTiposCombustivel()); } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() { setEditingId(null); setNome(''); setShowDialog(true); }
  function openEdit(item: TipoCombustivel) { setEditingId(item.id); setNome(item.nome); setShowDialog(true); }

  async function handleSubmit() {
    if (!user || !nome.trim()) { toast.error('Nome é obrigatório'); return; }
    try {
      if (editingId) { await updateTipoCombustivel(editingId, nome); toast.success('Atualizado'); }
      else { await saveTipoCombustivel(nome, user.id); toast.success('Cadastrado'); }
      setShowDialog(false); load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir?')) return;
    try { await deleteTipoCombustivel(id); load(); toast.success('Excluído'); } catch (e: any) { toast.error(e.message); }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Tipos de Combustível</h2>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo</Button>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Nenhum tipo cadastrado</TableCell></TableRow>
            )}
            {items.map(i => (
              <TableRow key={i.id}>
                <TableCell>{i.nome}</TableCell>
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
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Novo'} Tipo de Combustível</DialogTitle></DialogHeader>
          <div><Label>Nome *</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Diesel S10" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
