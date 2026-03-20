import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TransactionType } from '@/lib/cashRegister';
import FornecedorSelect from '@/components/compras/FornecedorSelect';
import ObraSelect from '@/components/compras/ObraSelect';
import type { Fornecedor } from '@/lib/comprasService';

interface TxData {
  date: string;
  type: TransactionType;
  value: number;
  gaveta?: number | null;
  observation: string;
  obra?: string | null;
  fornecedor?: string | null;
  nota_numero?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: TxData) => void;
  editData?: TxData | null;
}

export default function NewTransactionDialog({ open, onClose, onSubmit, editData }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<TransactionType>('entrada');
  const [value, setValue] = useState('');
  const [gaveta, setGaveta] = useState('');
  const [observation, setObservation] = useState('');
  const [obra, setObra] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [notaNumero, setNotaNumero] = useState('');

  useEffect(() => {
    if (editData) {
      setDate(editData.date);
      setType(editData.type);
      setValue(editData.value?.toString() || '');
      setGaveta(editData.gaveta?.toString() || '');
      setObservation(editData.observation || '');
      setObra(editData.obra || '');
      setFornecedor(editData.fornecedor || '');
      setNotaNumero(editData.nota_numero || '');
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setType('entrada');
      setValue('');
      setGaveta('');
      setObservation('');
      setObra('');
      setFornecedor('');
      setNotaNumero('');
    }
  }, [editData, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!value) return;

    onSubmit({
      date,
      type,
      value: parseFloat(value),
      gaveta: gaveta ? parseFloat(gaveta) : undefined,
      observation: observation.trim(),
      obra: obra?.trim() || null,
      fornecedor: fornecedor?.trim() || null,
      nota_numero: notaNumero?.trim() || null,
    });

    onClose();
  };

  function handleFornecedorSelect(f: Fornecedor) {
    setFornecedor(f.nome_fornecedor);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editData ? 'Editar Lançamento' : 'Novo Lançamento'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="tx-date">Data</Label>
            <Input
              id="tx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div>
            <Label>Tipo</Label>
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                variant={type === 'entrada' ? 'default' : 'outline'}
                className={type === 'entrada' ? 'bg-entrada hover:bg-entrada/90 text-entrada-foreground' : ''}
                onClick={() => setType('entrada')}
              >
                ↑ Entrada
              </Button>

              <Button
                type="button"
                variant={type === 'saida' ? 'default' : 'outline'}
                className={type === 'saida' ? 'bg-saida hover:bg-saida/90 text-saida-foreground' : ''}
                onClick={() => setType('saida')}
              >
                ↓ Saída
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="tx-value">Valor (R$)</Label>
            <Input
              id="tx-value"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              className="font-mono"
            />
          </div>

          <div>
            <Label htmlFor="tx-gaveta">Gaveta / Físico (opcional)</Label>
            <Input
              id="tx-gaveta"
              type="number"
              step="0.01"
              placeholder="Deixe vazio se não conferiu"
              value={gaveta}
              onChange={(e) => setGaveta(e.target.value)}
              className="font-mono"
            />
          </div>

          <div>
            <Label>Obra / Centro de Custo</Label>
            <ObraSelect value={obra || ''} onChange={setObra} />
          </div>

          <div>
            <FornecedorSelect
              value={fornecedor || ''}
              onChange={(v: string) => setFornecedor(v)}
              onFornecedorSelect={handleFornecedorSelect}
            />
          </div>

          <div>
            <Label htmlFor="tx-nota">Nº da Nota</Label>
            <Input
              id="tx-nota"
              placeholder="Opcional"
              value={notaNumero}
              onChange={(e) => setNotaNumero(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="tx-obs">Observações</Label>
            <Textarea
              id="tx-obs"
              placeholder="Detalhes do lançamento..."
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>

            <Button type="submit" disabled={!value}>
              {editData ? 'Salvar' : 'Lançar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
