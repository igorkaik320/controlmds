import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  VeiculoMaquina,
  CategoriaVeiculo,
  fetchVeiculos,
  saveVeiculo,
  updateVeiculo,
  deleteVeiculo,
  fetchCategoriasVeiculos
} from '@/lib/combustivelService';
import { useFormDraft } from '@/hooks/useFormDraft';
import { toast } from 'sonner';

const emptyForm = {
  tipo: 'veiculo' as 'veiculo' | 'maquina',
  placa: '',
  categoria: '',
  categoria_id: '',
};

export default function VeiculosMaquinasPage() {
  const { user, userRole } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const [items, setItems] = useState<VeiculoMaquina[]>([]);
  const [categorias, setCategorias] = useState<CategoriaVeiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog, clearShowDialog] = useFormDraft('veic-showDialog', false);
  const [editingId, setEditingId, clearEditingId] = useFormDraft<string | null>('veic-editingId', null);
  const [search, setSearch] = useState('');
  const [form, setForm, clearForm] = useFormDraft('veic-form', emptyForm);

  const load = useCallback(async () => {
    try {
      const [veiculos, categoriasData] = await Promise.all([
        fetchVeiculos(),
        fetchCategoriasVeiculos(),
      ]);
      setItems(veiculos);
      setCategorias(categoriasData.filter((c) => c.ativo));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((i) =>
    i.placa.toLowerCase().includes(search.toLowerCase()) ||
    (categorias.find((c) => c.id === i.categoria_id)?.nome || i.categoria || '')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  function resetDialogDraft() {
    clearEditingId();
    clearForm();
    clearShowDialog();
  }

  function openNew() {
    clearEditingId();
    clearForm();
    setShowDialog(true);
  }

  function openEdit(item: VeiculoMaquina) {
    setEditingId(item.id);
    setForm({
      tipo: item.tipo,
      placa: item.placa,
      categoria: item.categoria || '',
      categoria_id: item.categoria_id || '',
    });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user) {
      toast.error('Usuário não encontrado');
      return;
    }

    if (!form.placa.trim()) {
      toast.error('Placa é obrigatória');
      return;
    }

    if (!form.categoria_id) {
      toast.error('Categoria é obrigatória');
      return;
    }

    const categoriaSelecionada = categorias.find((c) => c.id === form.categoria_id);

    try {
      const payload = {
        tipo: form.tipo,
        placa: form.placa,
        modelo: form.placa,
        marca: '',
        categoria_id: form.categoria_id,
        categoria: categoriaSelecionada?.nome || form.categoria || '',
        created_by: user.id,
      };

      if (editingId) {
        await updateVeiculo(editingId, payload);
        toast.success('Atualizado');
      } else {
        await saveVeiculo(payload as any);
        toast.success('Cadastrado');
      }

      resetDialogDraft();
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir?')) return;

    try {
      await deleteVeiculo(id);
      load();
      toast.success('Excluído');
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
        <h2 className="text-2xl font-bold">Veículos e Máquinas</h2>
        {canCreate('veiculos_maquinas') && (
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" />Novo
          </Button>
        )}
      </div>

      <Input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por placa ou categoria..."
        className="max-w-sm"
      />

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhum registro
                </TableCell>
              </TableRow>
            )}

            {filtered.map(i => {
              const categoriaNome =
                categorias.find((c) => c.id === i.categoria_id)?.nome ||
                i.categoria ||
                '—';

              return (
                <TableRow key={i.id}>
                  <TableCell>{i.tipo === 'veiculo' ? 'Veículo' : 'Máquina'}</TableCell>
                  <TableCell>{i.placa}</TableCell>
                  <TableCell>{categoriaNome}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(i)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {userRole === 'admin' && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(i.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          if (!open) {
            resetDialogDraft();
            return;
          }
          setShowDialog(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Novo'} Veículo/Máquina</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div>
              <Label>Tipo *</Label>
              <Select
                value={form.tipo}
                onValueChange={v => setForm(p => ({ ...p, tipo: v as 'veiculo' | 'maquina' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="veiculo">Veículo</SelectItem>
                  <SelectItem value="maquina">Máquina</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Placa *</Label>
              <Input
                value={form.placa}
                onChange={e => setForm(p => ({ ...p, placa: e.target.value.toUpperCase() }))}
                placeholder="RXE-5D11"
              />
            </div>

            <div>
              <Label>Categoria *</Label>
              <Select
                value={form.categoria_id || '_none'}
                onValueChange={v => {
                  const categoria = categorias.find((c) => c.id === v);
                  setForm(p => ({
                    ...p,
                    categoria_id: v === '_none' ? '' : v,
                    categoria: categoria?.nome || '',
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Selecione</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} ({c.tipo_principal})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetDialogDraft}>Cancelar</Button>
            <Button onClick={handleSubmit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
