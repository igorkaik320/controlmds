import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { Fornecedor, fetchFornecedores, saveFornecedor } from '@/lib/comprasService';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface Props {
  value: string;
  onChange: (nome: string) => void;
  onFornecedorSelect?: (f: Fornecedor) => void;
}

export default function FornecedorSelect({ value, onChange, onFornecedorSelect }: Props) {
  const { user } = useAuth();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newForn, setNewForn] = useState({ nome_fornecedor: '', razao_social: '', banco: '', agencia: '', conta: '', cnpj_cpf: '' });

  useEffect(() => { loadFornecedores(); }, []);

  async function loadFornecedores() {
    try { setFornecedores(await fetchFornecedores()); } catch {}
  }

  async function handleSaveNew() {
    if (!user || !newForn.nome_fornecedor.trim()) return;
    try {
      await saveFornecedor({ ...newForn, created_by: user.id } as any, user.id);
      await loadFornecedores();
      onChange(newForn.nome_fornecedor);
      setShowNew(false);
      setNewForn({ nome_fornecedor: '', razao_social: '', banco: '', agencia: '', conta: '', cnpj_cpf: '' });
      toast.success('Fornecedor cadastrado');
    } catch (e: any) { toast.error(e.message); }
  }

  function handleSelect(val: string) {
    if (val === '__new__') { setShowNew(true); return; }
    onChange(val);
    const found = fornecedores.find(f => f.nome_fornecedor === val);
    if (found && onFornecedorSelect) onFornecedorSelect(found);
  }

  return (
    <div>
      <Label className="text-xs">Fornecedor *</Label>
      <Select value={value} onValueChange={handleSelect}>
        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
        <SelectContent>
          {fornecedores.map(f => (
            <SelectItem key={f.id} value={f.nome_fornecedor}>{f.nome_fornecedor}</SelectItem>
          ))}
          <SelectItem value="__new__">
            <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> Novo Fornecedor</span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Fornecedor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={newForn.nome_fornecedor} onChange={e => setNewForn(p => ({ ...p, nome_fornecedor: e.target.value }))} /></div>
            <div><Label>Razão Social</Label><Input value={newForn.razao_social} onChange={e => setNewForn(p => ({ ...p, razao_social: e.target.value }))} /></div>
            <div><Label>CNPJ/CPF</Label><Input value={newForn.cnpj_cpf} onChange={e => setNewForn(p => ({ ...p, cnpj_cpf: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Banco</Label><Input value={newForn.banco} onChange={e => setNewForn(p => ({ ...p, banco: e.target.value }))} /></div>
              <div><Label>Agência</Label><Input value={newForn.agencia} onChange={e => setNewForn(p => ({ ...p, agencia: e.target.value }))} /></div>
              <div><Label>Conta</Label><Input value={newForn.conta} onChange={e => setNewForn(p => ({ ...p, conta: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleSaveNew}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
