import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  PostoCombustivel,
  fetchPostosCombustivel,
  savePostoCombustivel,
  updatePostoCombustivel,
  deletePostoCombustivel,
} from '@/lib/combustivelService';
import { toast } from 'sonner';

const emptyForm = {
  nome: '',
  observacao: '',
};

export default function PostosCombustivelPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const [items, setItems] = useState<PostoCombustivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try {
      setItems(await fetchPostosCombustivel());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  function openEdit(item: PostoCombustivel) {
    setEditingId(item.id);
    setForm({
      nome: item.nome,
      observacao: item.observacao || '',
    });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user || !form.nome.trim()) {
      toast.error('Nome e obrigatorio');
      return;
    }

    try {
      if (editingId) {
        await updatePostoCombustivel(editingId, {
          nome: form.nome.trim(),
          observacao: form.observacao || null,
        });
        toast.success('Atualizado');
      } else {
        await savePostoCombustivel({
          nome: form.nome.trim(),
          observacao: form.observacao || null,
          created_by: user.id,
        });
        toast.success('Cadastrado');
      }

      resetDialogDraft();
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este posto?')) return;

    try {
      await deletePostoCombustivel(id);
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
        <h2 className="text-2xl font-bold">Postos de Combustivel</h2>
        {canCreate('postos_combustivel') && (
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" />Novo
          </Button>
        )}
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Observacao</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Nenhum posto cadastrado
                </TableCell>
              </TableRow>
            )}

            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.nome}</TableCell>
                <TableCell>{item.observacao || '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {canEdit('postos_combustivel') && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete('postos_combustivel') && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Novo'} Posto</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Posto GK"
              />
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
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
