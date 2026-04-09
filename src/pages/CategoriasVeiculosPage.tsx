import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  CategoriaVeiculo,
  fetchCategoriasVeiculos,
  saveCategoriaVeiculo,
  updateCategoriaVeiculo,
  deleteCategoriaVeiculo,
} from '@/lib/combustivelService';
import { toast } from 'sonner';
import AuditInfo from '@/components/AuditInfo';
import { useProfileMap } from '@/hooks/useProfileMap';

const emptyForm = {
  nome: '',
  tipo_principal: 'maquinario_obra' as 'posto' | 'pessoal' | 'maquinario_obra',
  categoria_pai_id: '',
  ativo: true,
};

const tipoLabel: Record<string, string> = {
  posto: 'Posto',
  pessoal: 'Pessoal',
  maquinario_obra: 'Maquinário/Obra',
};

export default function CategoriasVeiculosPage() {
  const { user, userRole } = useAuth();
  const [items, setItems] = useState<CategoriaVeiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const profileMap = useProfileMap();

  const load = useCallback(async () => {
    try {
      setItems(await fetchCategoriasVeiculos());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((i) => {
    const s = search.toLowerCase();
    return (
      i.nome.toLowerCase().includes(s) ||
      tipoLabel[i.tipo_principal].toLowerCase().includes(s)
    );
  });

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

  function openEdit(item: CategoriaVeiculo) {
    setEditingId(item.id);
    setForm({
      nome: item.nome,
      tipo_principal: item.tipo_principal,
      categoria_pai_id: item.categoria_pai_id || '',
      ativo: item.ativo,
    });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user || !form.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      const payload = {
        nome: form.nome.trim(),
        tipo_principal: form.tipo_principal,
        categoria_pai_id: form.categoria_pai_id || null,
        ativo: form.ativo,
      };

      if (editingId) {
        await updateCategoriaVeiculo(editingId, payload);
        toast.success('Categoria atualizada');
      } else {
        await saveCategoriaVeiculo(payload, user.id);
        toast.success('Categoria cadastrada');
      }

      resetDialogDraft();
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta categoria?')) return;

    try {
      await deleteCategoriaVeiculo(id);
      load();
      toast.success('Categoria excluída');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const categoriasPai = items.filter((i) => i.id !== editingId);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Categorias de Veículos/Máquinas</h2>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" />Nova
        </Button>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nome ou tipo..."
        className="max-w-sm"
      />

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoria Pai</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead>Auditoria</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhuma categoria cadastrada
                </TableCell>
              </TableRow>
            )}

            {filtered.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{i.nome}</TableCell>
                <TableCell>{tipoLabel[i.tipo_principal]}</TableCell>
                <TableCell>{items.find((p) => p.id === i.categoria_pai_id)?.nome || '—'}</TableCell>
                <TableCell>{i.ativo ? 'Sim' : 'Não'}</TableCell>
                <TableCell>
                  <AuditInfo
                    createdBy={i.created_by}
                    createdAt={i.created_at}
                    updatedBy={(i as any).updated_by}
                    updatedAt={i.updated_at}
                    profileMap={profileMap}
                  />
                </TableCell>
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
            ))}
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
            <DialogTitle>{editingId ? 'Editar' : 'Nova'} Categoria</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Posto GK"
              />
            </div>

            <div>
              <Label>Tipo Principal *</Label>
              <Select
                value={form.tipo_principal}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    tipo_principal: v as 'posto' | 'pessoal' | 'maquinario_obra',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="posto">Posto</SelectItem>
                  <SelectItem value="pessoal">Pessoal</SelectItem>
                  <SelectItem value="maquinario_obra">Maquinário/Obra</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Categoria Pai</Label>
              <Select
                value={form.categoria_pai_id || '_none'}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    categoria_pai_id: v === '_none' ? '' : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhuma</SelectItem>
                  {categoriasPai.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Ativo</Label>
              <Select
                value={form.ativo ? 'true' : 'false'}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    ativo: v === 'true',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Sim</SelectItem>
                  <SelectItem value="false">Não</SelectItem>
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
