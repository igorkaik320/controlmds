import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Equipamento {
  id: string;
  nome: string;
  marca?: string;
  modelo?: string;
  setor_nome?: string;
  created_at: string;
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
  const [items, setItems] = useState<Equipamento[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    // Carregar dados do localStorage ou usar dados mockados
    const loadInitialData = () => {
      try {
        const storedEquipamentos = localStorage.getItem('equipamentos');
        const storedSetores = localStorage.getItem('setores');
        
        const mockSetores: Setor[] = storedSetores ? JSON.parse(storedSetores) : [
          { id: '1', nome: 'Administração' },
          { id: '2', nome: 'Produção' },
          { id: '3', nome: 'Manutenção' },
          { id: '4', nome: 'Almoxarifado' },
        ];
        
        const mockEquipamentos: Equipamento[] = storedEquipamentos ? JSON.parse(storedEquipamentos) : [
          {
            id: '1',
            nome: 'Escavadeira CAT 320',
            marca: 'Caterpillar',
            modelo: '320D',
            setor_nome: 'Produção',
            created_at: new Date().toISOString(),
          },
          {
            id: '2',
            nome: 'Pá Carregadeira',
            marca: 'Volvo',
            modelo: 'L120H',
            setor_nome: 'Manutenção',
            created_at: new Date().toISOString(),
          },
        ];
        
        setSetores(mockSetores);
        setItems(mockEquipamentos);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

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
    const setor = setores.find(s => s.nome === item.setor_nome);
    setEditingId(item.id);
    setForm({
      nome: item.nome,
      marca: item.marca || '',
      modelo: item.modelo || '',
      setor_id: setor?.id || '',
    });
    setShowDialog(true);
  }

  function handleSubmit() {
    if (!form.nome.trim()) {
      toast.error('Nome do equipamento é obrigatório');
      return;
    }

    try {
      const setor = setores.find(s => s.id === form.setor_id);
      const payload = {
        nome: form.nome.trim(),
        marca: form.marca.trim() || null,
        modelo: form.modelo.trim() || null,
        setor_nome: setor?.nome || null,
        created_at: new Date().toISOString(),
      };

      let updatedItems: Equipamento[];
      
      if (editingId) {
        updatedItems = items.map(item => 
          item.id === editingId 
            ? { ...item, ...payload }
            : item
        );
        toast.success('Equipamento atualizado');
      } else {
        const newItem: Equipamento = {
          id: Date.now().toString(),
          ...payload,
        };
        updatedItems = [...items, newItem];
        toast.success('Equipamento cadastrado');
      }

      localStorage.setItem('equipamentos', JSON.stringify(updatedItems));
      setItems(updatedItems);
      setShowDialog(false);
      setForm(emptyForm);
      setEditingId(null);
    } catch (e: any) {
      console.error('Erro:', e);
      toast.error('Erro ao salvar equipamento');
    }
  }

  function handleDelete(id: string) {
    if (!confirm('Excluir este equipamento?')) return;

    try {
      const updatedItems = items.filter(item => item.id !== id);
      localStorage.setItem('equipamentos', JSON.stringify(updatedItems));
      setItems(updatedItems);
      toast.success('Equipamento excluído');
    } catch (e: any) {
      console.error('Erro:', e);
      toast.error('Erro ao excluir equipamento');
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Cadastro de Equipamentos</h2>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" />
          Novo Equipamento
        </Button>
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
                    <Button variant="ghost" size="icon" onClick={() => openEdit(i)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(i.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
              <select 
                value={form.setor_id} 
                onChange={(e) => setForm((p) => ({ ...p, setor_id: e.target.value }))} 
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Selecione um setor</option>
                {setores.map((setor) => (
                  <option key={setor.id} value={setor.id}>
                    {setor.nome}
                  </option>
                ))}
              </select>
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
