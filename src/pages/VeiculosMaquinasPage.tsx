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
  fetchVeiculos,
  saveVeiculo,
  updateVeiculo,
  deleteVeiculo,
} from '@/lib/combustivelService';
import { fetchResponsaveis, Responsavel } from '@/lib/comprasService';
import { toast } from 'sonner';

const emptyForm = {
  tipo: 'veiculo' as 'veiculo' | 'maquina',
  placa: '',
  responsavel_id: '',
};

export default function VeiculosMaquinasPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const [items, setItems] = useState<VeiculoMaquina[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);

  const load = useCallback(async () => {
    try {
      const [veiculos, responsaveisData] = await Promise.all([fetchVeiculos(), fetchResponsaveis()]);
      const mapped = veiculos.map((veiculo) => ({
        ...veiculo,
        responsavel: responsaveisData.find((r) => r.id === veiculo.responsavel_id) || null,
      }));
      setItems(mapped);
      setResponsaveis(responsaveisData);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((item) => {
    const term = search.toLowerCase();
    return item.placa.toLowerCase().includes(term);
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

  function openEdit(item: VeiculoMaquina) {
    setEditingId(item.id);
    setForm({
      tipo: item.tipo,
      placa: item.placa,
      responsavel_id: item.responsavel_id || '',
    });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user) {
      toast.error('Usuario nao encontrado');
      return;
    }

    if (!form.placa.trim()) {
      toast.error('Placa e obrigatoria');
      return;
    }

    try {
      const payload = {
        tipo: form.tipo,
        placa: form.placa.trim().toUpperCase(),
        modelo: form.placa.trim().toUpperCase(),
        marca: '',
        categoria_id: null,
        categoria: '',
        responsavel_id: form.responsavel_id || null,
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
        <h2 className="text-2xl font-bold">Veiculos e Maquinas</h2>
        {canCreate('veiculos_maquinas') && (
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" />Novo
          </Button>
        )}
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por placa..."
        className="max-w-sm"
      />

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Responsável</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Nenhum registro
                </TableCell>
              </TableRow>
            )}

            {filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.tipo === 'veiculo' ? 'Veiculo' : 'Maquina'}</TableCell>
                <TableCell>{item.placa}</TableCell>
                <TableCell>{item.responsavel?.nome || '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {canEdit('veiculos_maquinas') && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete('veiculos_maquinas') && (
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
            <DialogTitle>{editingId ? 'Editar' : 'Novo'} Veiculo/Maquina</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div>
              <Label>Tipo *</Label>
              <Select
                value={form.tipo}
                onValueChange={(value) => setForm((prev) => ({ ...prev, tipo: value as 'veiculo' | 'maquina' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="veiculo">Veiculo</SelectItem>
                  <SelectItem value="maquina">Maquina</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Placa *</Label>
              <Input
                value={form.placa}
                onChange={(e) => setForm((prev) => ({ ...prev, placa: e.target.value.toUpperCase() }))}
                placeholder="RXE-5D11"
              />
            </div>
            <div>
              <Label>Responsável</Label>
              <Select
                value={form.responsavel_id}
                onValueChange={(value) => setForm((prev) => ({ ...prev, responsavel_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o responsavel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {responsaveis.map((responsavel) => (
                    <SelectItem key={responsavel.id} value={responsavel.id}>
                      {responsavel.nome}
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
