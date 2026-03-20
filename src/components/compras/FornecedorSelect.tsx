import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { Fornecedor, fetchFornecedores, saveFornecedor } from '@/lib/comprasService';
import { formatCPFCNPJ } from '@/lib/formatters';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface Props {
  value: string;
  onChange: (nome: string) => void;
  onFornecedorSelect?: (f: Fornecedor) => void;
}

const emptyFornecedor = {
  nome_fornecedor: '',
  razao_social: '',
  banco: '',
  agencia: '',
  conta: '',
  cnpj_cpf: '',
};

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

export default function FornecedorSelect({ value, onChange, onFornecedorSelect }: Props) {
  const { user } = useAuth();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newForn, setNewForn] = useState(emptyFornecedor);

  useEffect(() => {
    loadFornecedores();
  }, []);

  async function loadFornecedores() {
    try {
      setFornecedores(await fetchFornecedores());
    } catch {}
  }

  const filteredFornecedores = useMemo(() => {
    const query = normalize(value);
    const queryDigits = digitsOnly(value);

    if (!query && !queryDigits) return fornecedores;

    return fornecedores.filter((f) => {
      const nome = normalize(f.nome_fornecedor || '');
      const razao = normalize(f.razao_social || '');
      const cnpj = digitsOnly(f.cnpj_cpf || '');

      return (
        nome.includes(query) ||
        razao.includes(query) ||
        (!!queryDigits && cnpj.includes(queryDigits))
      );
    });
  }, [fornecedores, value]);

  async function handleSaveNew() {
    if (!user || !newForn.nome_fornecedor.trim()) {
      toast.error('Nome do fornecedor é obrigatório');
      return;
    }

    const rawDoc = digitsOnly(newForn.cnpj_cpf);
    if (rawDoc.length >= 11) {
      const dup = fornecedores.find((f) => digitsOnly(f.cnpj_cpf || '') === rawDoc);
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
      setOpen(false);
      setNewForn(emptyFornecedor);
      toast.success('Fornecedor cadastrado');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function selectFornecedor(f: Fornecedor) {
    onChange(f.nome_fornecedor);
    if (onFornecedorSelect) onFornecedorSelect(f);
    setOpen(false);
  }

  return (
    <>
      <div className="space-y-2">
        <Label>Fornecedor *</Label>

        <div className="relative">
          <Input
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder="Digite nome, razão social ou CNPJ/CPF"
          />

          {open && filteredFornecedores.length > 0 && (
            <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover shadow-lg">
              {filteredFornecedores.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  onMouseDown={() => selectFornecedor(f)}
                >
                  <div className="font-medium">{f.nome_fornecedor}</div>
                  <div className="text-xs text-muted-foreground">
                    {f.razao_social || 'Sem razão social'}
                    {f.cnpj_cpf ? ` • ${f.cnpj_cpf}` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowNew(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Novo fornecedor
          </Button>
        </div>
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Fornecedor</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input
                value={newForn.nome_fornecedor}
                onChange={(e) => setNewForn((p) => ({ ...p, nome_fornecedor: e.target.value }))}
              />
            </div>

            <div>
              <Label>Razão Social</Label>
              <Input
                value={newForn.razao_social}
                onChange={(e) => setNewForn((p) => ({ ...p, razao_social: e.target.value }))}
              />
            </div>

            <div>
              <Label>CNPJ/CPF</Label>
              <Input
                value={newForn.cnpj_cpf}
                onChange={(e) => setNewForn((p) => ({ ...p, cnpj_cpf: formatCPFCNPJ(e.target.value) }))}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                maxLength={18}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Banco</Label>
                <Input
                  value={newForn.banco}
                  onChange={(e) => setNewForn((p) => ({ ...p, banco: e.target.value }))}
                />
              </div>
              <div>
                <Label>Agência</Label>
                <Input
                  value={newForn.agencia}
                  onChange={(e) => setNewForn((p) => ({ ...p, agencia: e.target.value }))}
                />
              </div>
              <div>
                <Label>Conta</Label>
                <Input
                  value={newForn.conta}
                  onChange={(e) => setNewForn((p) => ({ ...p, conta: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveNew}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
