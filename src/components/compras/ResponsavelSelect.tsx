import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { fetchResponsaveis, saveResponsavel, Responsavel } from '@/lib/comprasService';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}

export default function ResponsavelSelect({ value, onChange }: Props) {
  const { user } = useAuth();
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [novoResponsavel, setNovoResponsavel] = useState('');

  useEffect(() => {
    loadResponsaveis();
  }, []);

  async function loadResponsaveis() {
    try {
      setResponsaveis(await fetchResponsaveis());
    } catch {}
  }

  const filteredResponsaveis = useMemo(() => {
    const query = normalize(value);
    if (!query) return responsaveis;
    return responsaveis.filter((r) => normalize(r.nome).includes(query));
  }, [responsaveis, value]);

  async function handleSaveNew() {
    if (!user || !novoResponsavel.trim()) {
      toast.error('Nome do responsável é obrigatório');
      return;
    }

    try {
      await saveResponsavel(novoResponsavel.trim(), user.id);
      await loadResponsaveis();
      onChange(novoResponsavel.trim());
      setNovoResponsavel('');
      setShowNew(false);
      setOpen(false);
      toast.success('Responsável cadastrado');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function selectResponsavel(nome: string) {
    onChange(nome);
    setOpen(false);
  }

  return (
    <>
      <div className="space-y-2">
        <Label>Responsável</Label>

        <div className="relative">
          <Input
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder="Digite o responsável"
          />

          {open && filteredResponsaveis.length > 0 && (
            <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover shadow-lg">
              {filteredResponsaveis.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  onMouseDown={() => selectResponsavel(r.nome)}
                >
                  {r.nome}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowNew(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Novo responsável
          </Button>
        </div>
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Responsável</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input
                value={novoResponsavel}
                onChange={(e) => setNovoResponsavel(e.target.value)}
              />
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
