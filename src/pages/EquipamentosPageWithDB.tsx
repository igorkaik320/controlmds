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
  created_at: string;
  updated_at: string;
}

interface Setor {
  id: string;
  nome: string;
}

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
  const [setores, setSetores] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);

  // Carregar setores do banco de dados
  const loadSetores = useCallback(async () => {
    try {
      console.log('Carregando setores do Supabase...');
      const { data, error } = await supabase
        .from('setores')
        .select('*')
        .order('nome');
      
      if (error) {
        console.error('Erro ao carregar setores:', error);
        // Fallback para localStorage
        const stored = localStorage.getItem('setores');
        const fallbackSetores = stored ? JSON.parse(stored) : [
          { id: '1', nome: 'Administração' },
          { id: '2', nome: 'Produção' },
          { id: '3', nome: 'Manutenção' },
          { id: '4', nome: 'Almoxarifado' },
        ];
        setSetores(fallbackSetores);
        toast.warning('Usando dados locais de setores - erro no banco');
      } else {
        console.log('Setores carregados:', data);
        setSetores(data || []);
        // Salvar no localStorage como cache
        localStorage.setItem('setores', JSON.stringify(data || []));
      }
    } catch (e: any) {
      console.error('Erro ao carregar setores:', e);
      toast.error('Erro ao carregar setores');
    }
  }, []);

  // Carregar equipamentos do banco de dados
  const loadEquipamentos = useCallback(async () => {
    try {
      console.log('Carregando equipamentos do Supabase...');
      const { data, error } = await supabase
        .from('equipamentos')
        .select('*')
        .order('nome');
      
      if (error) {
        console.error('Erro ao carregar equipamentos:', error);
        // Fallback para localStorage
        const stored = localStorage.getItem('equipamentos');
        const fallbackEquipamentos = stored ? JSON.parse(stored) : [];
        setItems(fallbackEquipamentos);
        toast.warning('Usando dados locais de equipamentos - erro no banco');
      } else {
        console.log('Equipamentos carregados:', data);
        setItems(data || []);
        // Salvar no localStorage como cache
        localStorage.setItem('equipamentos', JSON.stringify(data || []));
      }
    } catch (e: any) {
      console.error('Erro ao carregar equipamentos:', e);
      toast.error('Erro ao carregar equipamentos');
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadSetores(), loadEquipamentos()]);
    setLoading(false);
  }, [loadSetores, loadEquipamentos]);

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
    console.log('Abrindo novo equipamento...');
    setEditingId(null);
    setForm(emptyForm);
    setShowDialog(true);
  }

  function openEdit(item: Equipamento) {
    console.log('Abrindo edição do equipamento:', item);
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
      const setor = setores.find(s => s.id === form.setor_id);
      const payload = {
        nome: form.nome.trim(),
        marca: form.marca.trim() || null,
        modelo: form.modelo.trim() || null,
        setor_id: form.setor_id || null,
        setor_nome: setor?.nome || null,
        updated_at: new Date().toISOString(),
      };

      console.log('Payload:', payload);

      if (editingId) {
        console.log('Atualizando equipamento no Supabase...');
        const { error } = await supabase
          .from('equipamentos')
          .update(payload)
          .eq('id', editingId);
          
        if (error) {
          console.error('Erro ao atualizar:', error);
          throw error;
        }
        
        toast.success('Equipamento atualizado no banco');
      } else {
        console.log('Salvando novo equipamento no Supabase...');
        const { data, error } = await supabase
          .from('equipamentos')
          .insert({ ...payload, created_by: user.id })
          .select()
          .single();
          
        if (error) {
          console.error('Erro ao salvar:', error);
          throw error;
        }
        
        console.log('Equipamento salvo:', data);
        toast.success('Equipamento cadastrado no banco');
      }

      setShowDialog(false);
      setForm(emptyForm);
      setEditingId(null);
      await load(); // Recarregar dados
    } catch (e: any) {
      console.error('Erro no handleSubmit:', e);
      
      // Fallback para localStorage se o Supabase falhar
      try {
        let updatedItems: Equipamento[];
        
        if (editingId) {
          updatedItems = items.map(item => 
            item.id === editingId 
              ? { ...item, ...payload, updated_at: new Date().toISOString() }
              : item
          );
          toast.success('Equipamento atualizado localmente');
        } else {
          const newItem: Equipamento = {
            id: Date.now().toString(),
            ...payload,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          updatedItems = [...items, newItem];
          toast.success('Equipamento cadastrado localmente');
        }

        localStorage.setItem('equipamentos', JSON.stringify(updatedItems));
        setItems(updatedItems);
        setShowDialog(false);
        setForm(emptyForm);
        setEditingId(null);
      } catch (fallbackError) {
        toast.error('Erro ao salvar equipamento');
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este equipamento?')) return;

    try {
      console.log('Excluindo equipamento do Supabase:', id);
      const { error } = await supabase
        .from('equipamentos')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Erro ao excluir:', error);
        throw error;
      }
      
      toast.success('Equipamento excluído do banco');
      await load(); // Recarregar dados
    } catch (e: any) {
      console.error('Erro ao excluir equipamento:', e);
      
      // Fallback para localStorage
      try {
        const updatedItems = items.filter(item => item.id !== id);
        localStorage.setItem('equipamentos', JSON.stringify(updatedItems));
        setItems(updatedItems);
        toast.success('Equipamento excluído localmente');
      } catch (fallbackError) {
        toast.error('Erro ao excluir equipamento');
      }
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
