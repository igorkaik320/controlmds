import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Upload, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Empresa, fetchEmpresas, saveEmpresa, updateEmpresa, deleteEmpresa } from '@/lib/empresasService';
import { formatCNPJ } from '@/lib/formatters';
import { toast } from 'sonner';

const emptyForm = { nome: '', cnpj: '', logo_esquerda: '' as string | null, logo_direita: '' as string | null };

export default function EmpresasPage() {
  const { user, userRole } = useAuth();
  const [items, setItems] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try { setItems(await fetchEmpresas()); } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(i => {
    const s = search.toLowerCase();
    return i.nome.toLowerCase().includes(s) || (i.cnpj || '').replace(/\D/g, '').includes(search.replace(/\D/g, ''));
  });

  function openNew() { setEditingId(null); setForm(emptyForm); setShowDialog(true); }

  function openEdit(item: Empresa) {
    setEditingId(item.id);
    setForm({
      nome: item.nome,
      cnpj: item.cnpj || '',
      logo_esquerda: item.logo_esquerda,
      logo_direita: item.logo_direita,
    });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user || !form.nome.trim()) { toast.error('Nome é obrigatório'); return; }

    // Check CNPJ duplicate
    if (form.cnpj) {
      const cnpjDigits = form.cnpj.replace(/\D/g, '');
      if (cnpjDigits.length >= 14) {
        const dup = items.find(i => i.id !== editingId && (i.cnpj || '').replace(/\D/g, '') === cnpjDigits);
        if (dup) { toast.error(`CNPJ já cadastrado na empresa "${dup.nome}"`); return; }
      }
    }

    try {
      const payload = {
        nome: form.nome,
        cnpj: form.cnpj || null,
        logo_esquerda: form.logo_esquerda || null,
        logo_direita: form.logo_direita || null,
      };
      if (editingId) {
        await updateEmpresa(editingId, payload);
        toast.success('Empresa atualizada');
      } else {
        await saveEmpresa(payload, user.id);
        toast.success('Empresa cadastrada');
      }
      setShowDialog(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta empresa?')) return;
    try { await deleteEmpresa(id); load(); toast.success('Excluída'); } catch (e: any) { toast.error(e.message); }
  }

  function handleLogoUpload(side: 'logo_esquerda' | 'logo_direita') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setForm(prev => ({ ...prev, [side]: reader.result as string }));
      reader.readAsDataURL(file);
    };
    input.click();
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Cadastro de Empresas</h2>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nova Empresa</Button>
      </div>

      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou CNPJ..." className="max-w-sm" />

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Logos</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma empresa</TableCell></TableRow>
            )}
            {filtered.map(i => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.nome}</TableCell>
                <TableCell>{i.cnpj ? formatCNPJ(i.cnpj) : '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {i.logo_esquerda && <img src={i.logo_esquerda} alt="L" className="h-8 object-contain" />}
                    {i.logo_direita && <img src={i.logo_direita} alt="R" className="h-8 object-contain" />}
                    {!i.logo_esquerda && !i.logo_direita && <span className="text-muted-foreground text-xs">Sem logos</span>}
                  </div>
                </TableCell>
                <TableCell>{new Date(i.created_at).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                    {(userRole === 'admin') && (
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Nova'} Empresa</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} /></div>
            <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => setForm(p => ({ ...p, cnpj: formatCNPJ(e.target.value) }))} maxLength={18} placeholder="00.000.000/0000-00" /></div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Logo Esquerda</Label>
                {form.logo_esquerda && <img src={form.logo_esquerda} alt="Logo esq" className="h-14 object-contain mx-auto" />}
                <div className="flex gap-1 justify-center">
                  <Button type="button" variant="outline" size="sm" onClick={() => handleLogoUpload('logo_esquerda')}>
                    <Upload className="h-3 w-3 mr-1" />Upload
                  </Button>
                  {form.logo_esquerda && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setForm(p => ({ ...p, logo_esquerda: null }))}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Logo Direita</Label>
                {form.logo_direita && <img src={form.logo_direita} alt="Logo dir" className="h-14 object-contain mx-auto" />}
                <div className="flex gap-1 justify-center">
                  <Button type="button" variant="outline" size="sm" onClick={() => handleLogoUpload('logo_direita')}>
                    <Upload className="h-3 w-3 mr-1" />Upload
                  </Button>
                  {form.logo_direita && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setForm(p => ({ ...p, logo_direita: null }))}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
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
