import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Wrench } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  fetchEquipamentos,
  saveEquipamento,
  updateEquipamento,
  deleteEquipamento,
  fetchSetores,
  type Equipamento,
} from '@/lib/equipamentosService';
import { toast } from 'sonner';
import AuditInfo from '@/components/AuditInfo';
import { useProfileMap } from '@/hooks/useProfileMap';


const emptyForm = {
  nome: '',
  marca: '',
  modelo: '',
  setor_id: '',
};

export default function EquipamentosPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const [items, setItems] = useState<Equipamento[]>([]);
  const [setores, setSetores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);

  const profileMap = useProfileMap();

  const load = useCallback(async () => {
    try {
      const [equipamentosData, setoresData] = await Promise.all([
        fetchEquipamentos(),
        fetchSetores()
      ]);
      setItems(equipamentosData);
      setSetores(setoresData);
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
    return i.nome.toLowerCase().includes(s) || 
           i.marca?.toLowerCase().includes(s) || 
           i.modelo?.toLowerCase().includes(s) ||
           i.setor_nome?.toLowerCase().includes(s);
  });

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setShowDialog(true);
  }

  function openEdit(item: Equipamento) {
    setEditingId(item.id);
    setForm({
      nome: item.nome,
      marca: item.marca || '',
      modelo: item.modelo || '',
      setor_id: item.setor_id || '',
    });
    setShowDialog(true);
  }

  async function handleSubmit() {
    console.log('handleSubmit chamado');
    console.log('user:', user);
    console.log('form:', form);
    
    if (!user || !form.nome.trim()) {
      toast.error('Nome do equipamento é obrigatório');
      return;
    }

    try {
      const payload = {
        nome: form.nome.trim(),
        marca: form.marca.trim() || null,
        modelo: form.modelo.trim() || null,
        setor_id: form.setor_id || null,
        created_by: user.id,
      };

      console.log('Payload:', payload);
      console.log('editingId:', editingId);

      if (editingId) {
        console.log('Atualizando equipamento...');
        await updateEquipamento(editingId, payload);
        toast.success('Equipamento atualizado');
      } else {
        console.log('Salvando novo equipamento...');
        await saveEquipamento(payload, user.id);
        toast.success('Equipamento cadastrado');
      }

      setShowDialog(false);
      load();
    } catch (e: any) {
      console.error('Erro no handleSubmit:', e);
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este equipamento?')) return;

    try {
      await deleteEquipamento(id);
      load();
      toast.success('Equipamento excluído');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;
  }

  const sectorSelectValue = form.setor_id || 'none';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Cadastro de Equipamentos</h2>
        {canCreate('equipamentos') && (
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Equipamento
          </Button>
        )}
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nome, marca ou modelo..."
        className="max-w-sm"
      />

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome do Equipamento</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead>Auditoria</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhum equipamento encontrado
                </TableCell>
              </TableRow>
            )}

            {filtered.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.nome}</TableCell>
                <TableCell>{i.marca || '-'}</TableCell>
                <TableCell>{i.modelo || '-'}</TableCell>
                <TableCell>{i.setor_nome || '-'}</TableCell>
                <TableCell>{new Date(i.created_at).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell>
                  <AuditInfo
                    createdBy={i.created_by}
                    createdAt={i.created_at}
                    updatedBy={i.updated_by}
                    updatedAt={i.updated_at}
                    profileMap={profileMap}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {canEdit('equipamentos') && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(i)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete('equipamentos') && (
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

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Novo'} Equipamento</DialogTitle>
            <DialogDescription>Informe os dados básicos e relacione o setor quando disponível.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div>
              <Label>Nome do Equipamento *</Label>
              <Input 
                value={form.nome} 
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} 
                placeholder="Ex: Escavadeira CAT 320"
              />
            </div>

            <div>
              <Label>Setor</Label>
              <Select value={sectorSelectValue} onValueChange={(value) => setForm((p) => ({ ...p, setor_id: value === 'none' ? '' : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {setores.map((setor) => (
                    <SelectItem key={setor.id} value={setor.id}>
                      {setor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Marca (opcional)</Label>
              <Input 
                value={form.marca} 
                onChange={(e) => setForm((p) => ({ ...p, marca: e.target.value }))} 
                placeholder="Ex: Caterpillar"
              />
            </div>

            <div>
              <Label>Modelo (opcional)</Label>
              <Input 
                value={form.modelo} 
                onChange={(e) => setForm((p) => ({ ...p, modelo: e.target.value }))} 
                placeholder="Ex: 320D"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
