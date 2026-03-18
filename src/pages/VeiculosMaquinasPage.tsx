import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { VeiculoMaquina, fetchVeiculos, saveVeiculo, updateVeiculo, deleteVeiculo } from '@/lib/combustivelService';
import { toast } from 'sonner';

const categorias = ['caterpillar', 'new_holland', 'caminhao', 'carro', 'moto', 'outro'];
const categoriasLabel: Record<string, string> = {
  caterpillar: 'Caterpillar', new_holland: 'New Holland', caminhao: 'Caminhão',
  carro: 'Carro', moto: 'Moto', outro: 'Outro',
};

const emptyForm = { tipo: 'veiculo' as 'veiculo' | 'maquina', placa: '', modelo: '', marca: '', categoria: 'outro' };

export default function VeiculosMaquinasPage() {
  const { user, userRole } = useAuth();
  const [items, setItems] = useState<VeiculoMaquina[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try { setItems(await fetchVeiculos()); } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(i =>
    i.modelo.toLowerCase().includes(search.toLowerCase()) ||
    i.placa.toLowerCase().includes(search.toLowerCase()) ||
    i.marca.toLowerCase().includes(search.toLowerCase())
  );

  function openNew() { setEditingId(null); setForm(emptyForm); setShowDialog(true); }

  function openEdit(item: VeiculoMaquina) {
    setEditingId(item.id);
    setForm({ tipo: item.tipo, placa: item.placa, modelo: item.modelo, marca: item.marca, categoria: item.categoria });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user || !form.modelo.trim()) { toast.error('Modelo é obrigatório'); return; }
    try {
      if (editingId) {
        await updateVeiculo(editingId, form);
        toast.success('Atualizado');
      } else {
        await saveVeiculo({ ...form, created_by: user.id });
        toast.success('Cadastrado');
      }
      setShowDialog(false); load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir?')) return;
    try { await deleteVeiculo(id); load(); toast.success('Excluído'); } catch (e: any) { toast.error(e.message); }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Veículos e Máquinas</h2>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo</Button>
      </div>

      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por modelo, placa ou marca..." className="max-w-sm" />

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum registro</TableCell></TableRow>
            )}
            {filtered.map(i => (
              <TableRow key={i.id}>
                <TableCell>{i.tipo === 'veiculo' ? 'Veículo' : 'Máquina'}</TableCell>
                <TableCell>{i.placa}</TableCell>
                <TableCell>{i.modelo}</TableCell>
                <TableCell>{i.marca}</TableCell>
                <TableCell>{categoriasLabel[i.categoria] || i.categoria}</TableCell>
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
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Novo'} Veículo/Máquina</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="veiculo">Veículo</SelectItem>
                  <SelectItem value="maquina">Máquina</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Placa</Label><Input value={form.placa} onChange={e => setForm(p => ({ ...p, placa: e.target.value.toUpperCase() }))} placeholder="ABC-1234" /></div>
            <div><Label>Modelo *</Label><Input value={form.modelo} onChange={e => setForm(p => ({ ...p, modelo: e.target.value }))} /></div>
            <div><Label>Marca</Label><Input value={form.marca} onChange={e => setForm(p => ({ ...p, marca: e.target.value }))} /></div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={v => setForm(p => ({ ...p, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => <SelectItem key={c} value={c}>{categoriasLabel[c]}</SelectItem>)}
                </SelectContent>
              </Select>
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
