import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { Fornecedor, fetchFornecedores, saveFornecedor } from '@/lib/comprasService';
import { formatCPFCNPJ, formatCelular } from '@/lib/formatters';
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
    try {
      setFornecedores(await fetchFornecedores());
    } catch {}
  }

  // Busca inteligente: filtra por nome ou razão social
  const filteredFornecedores = value
    ? fornecedores.filter(f =>
        f.nome_fornecedor.toLowerCase().includes(value.toLowerCase()) ||
        (f.razao_social || '').toLowerCase().includes(value.toLowerCase())
      )
    : fornecedores;

  async function handleSaveNew() {
    if (!user || !newForn.nome_fornecedor.trim()) return;

    // Verificar duplicidade por CNPJ
    const rawCnpj = newForn.cnpj_cpf.replace(/\D/g, '');
    if (rawCnpj.length >= 11) {
      const dup = fornecedores.find(f => (f.cnpj_cpf || '').replace(/\D/g, '') === rawCnpj);
      if (dup) {
        toast.error(`CNPJ/CPF já cadastrado para: ${dup.nome_fornecedor}`);
        return;
      }
    }

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
    if (val === '__new__') {
      setShowNew(true);
      return;
    }
    onChange(val);
    const forn = fornecedores.find(f => f.nome_fornecedor === val);
    if (forn && onFornecedorSelect) onFornecedorSelect(forn);
  }

  return (
    <>
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-2">
          <Input
            value={value}
            placeholder="Digite ou selecione fornecedor"
            onChange={(e) => onChange(e.target.value)}
          />
          <Select value={value} onValueChange={handleSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar fornecedor da lista" />
            </SelectTrigger>
            <SelectContent>
              {filteredFornecedores.map(f => (
                <SelectItem key={f.id} value={f.nome_fornecedor}>
                  {f.nome_fornecedor}{f.razao_social ? ` (${f.razao_social})` : ''}
                </SelectItem>
              ))}
              <SelectItem value="__new__">
                <span className="flex items-center gap-1">
                  <Plus className="h-3 w-3" />
                  Novo fornecedor
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Fornecedor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={newForn.nome_fornecedor} onChange={e => setNewForn(p => ({ ...p, nome_fornecedor: e.target.value }))} /></div>
            <div><Label>Razão Social</Label><Input value={newForn.razao_social} onChange={e => setNewForn(p => ({ ...p, razao_social: e.target.value }))} /></div>
            <div>
              <Label>CNPJ/CPF</Label>
              <Input
                value={newForn.cnpj_cpf}
                onChange={e => setNewForn(p => ({ ...p, cnpj_cpf: formatCPFCNPJ(e.target.value) }))}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                maxLength={18}
              />
            </div>
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
    </>
  );
}
