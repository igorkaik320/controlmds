import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Setor {
  id: string;
  nome: string;
  created_at: string;
}

export default function SetoresPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const [items, setItems] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ nome: '' });

  const load = useCallback(async () => {
    try {
      console.log('Carregando setores do Supabase...');
      const { data, error } = await supabase
        .from('setores')
        .select('*')
        .order('nome');
      
      if (error) {
        console.error('Erro ao carregar setores:', error);
        toast.error('Erro ao carregar setores: ' + error.message);
      } else {
        console.log('Setores carregados:', data);
        setItems(data || []);
      }
    } catch (e: any) {
      console.error('Erro inesperado:', e);
      toast.error('Erro ao carregar setores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((i) => {
    const s = search.toLowerCase();
    return i.nome.toLowerCase().includes(s);
  });

  function openNew() {
    setEditingId(null);
    setForm({ nome: '' });
    setShowDialog(true);
  }

  function openEdit(item: Setor) {
    setEditingId(item.id);
    setForm({ nome: item.nome });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user || !form.nome.trim()) {
      toast.error('Nome do setor é obrigatório');
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('setores')
          .update({ 
            nome: form.nome.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);
          
        if (error) throw error;
        toast.success('Setor atualizado');
      } else {
        const { error } = await supabase
          .from('setores')
          .insert({ 
            nome: form.nome.trim(),
            created_by: user.id 
          });
          
        if (error) throw error;
        toast.success('Setor cadastrado');
      }

      setShowDialog(false);
      load();
    } catch (e: any) {
      console.error('Erro ao salvar setor:', e);
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este setor?')) return;
    
    try {
      const { error } = await supabase
        .from('setores')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      toast.success('Setor excluído');
      load();
    } catch (e: any) {
      console.error('Erro ao excluir setor:', e);
      toast.error(e.message);
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Cadastro de Setores</h2>
        {canCreate('setores') && (
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Setor
          </Button>
        )}
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nome..."
        className="max-w-sm"
      />

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome do Setor</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Nenhum setor encontrado
                </TableCell>
              </TableRow>
            )}

            {filtered.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.nome}</TableCell>
                <TableCell>{new Date(i.created_at).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {canEdit('setores') && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(i)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete('setores') && (
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
            <DialogTitle>{editingId ? 'Editar' : 'Novo'} Setor</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div>
              <Label>Nome do Setor *</Label>
              <Input 
                value={form.nome} 
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} 
                placeholder="Ex: Produção"
                autoFocus
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
