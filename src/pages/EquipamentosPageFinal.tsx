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
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Equipamento {
  id: string;
  nome: string;
  marca?: string;
  modelo?: string;
  setor_id?: string;
  setor_nome?: string;
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
}

interface Setor {
  id: string;
  nome: string;
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
}

export default function EquipamentosPage() {
  const { user, userRole } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const [items, setItems] = useState<Equipamento[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ nome: '', marca: '', modelo: '', setor_id: '' });

  const load = useCallback(async () => {
    try {
      // Carregar setores
      const { data: setoresData, error: setoresError } = await supabase
        .from('setores')
        .select('*')
        .order('nome');
      
      if (setoresError) throw setoresError;
      setSetores(setoresData || []);

      // Carregar equipamentos
      const { data: equipamentosData, error: equipamentosError } = await supabase
        .from('equipamentos')
        .select('*')
        .order('nome');
      
      if (equipamentosError) throw equipamentosError;
      setItems(equipamentosData || []);
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
    setForm({ nome: '', marca: '', modelo: '', setor_id: '' });
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
    if (!user || !form.nome.trim()) {
      toast.error('Nome do equipamento é obrigatório');
      return;
    }

    try {
      const setor = setores.find(s => s.id === form.setor_id);
      const payload = {
        nome: form.nome.trim(),
        marca: form.marca.trim() || null,
        modelo: form.modelo.trim() || null,
        setor_id: form.setor_id || null,
        setor_nome: setor?.nome || null,
      };

      if (editingId) {
        await supabase
          .from('equipamentos')
          .update({ ...payload, updated_by: user.id, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        toast.success('Equipamento atualizado');
      } else {
        await supabase
          .from('equipamentos')
          .insert({ ...payload, created_by: user.id });
        toast.success('Equipamento cadastrado');
      }

      setShowDialog(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este equipamento?')) return;
    
    try {
      await supabase.from('equipamentos').delete().eq('id', id);
      load();
      toast.success('Equipamento excluído');
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
        placeholder="Buscar por nome, marca, modelo ou setor..."
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
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
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
              <Select value={form.setor_id} onValueChange={(value) => setForm((p) => ({ ...p, setor_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
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
