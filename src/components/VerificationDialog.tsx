import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, getBalanceAtDate, type Transaction } from '@/lib/cashRegister';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { date: string; gaveta_value: number; observation: string; system_balance: number }) => void;
  currentBalance: number;
  allTransactions: Transaction[];
}

export default function VerificationDialog({ open, onClose, onSubmit, currentBalance, allTransactions }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [gavetaValue, setGavetaValue] = useState('');
  const [observation, setObservation] = useState('');

  const systemBalance = useMemo(
    () => getBalanceAtDate(allTransactions, date, currentBalance),
    [allTransactions, date, currentBalance]
  );

  const parsedGaveta = gavetaValue ? parseFloat(gavetaValue) : null;
  const diff = parsedGaveta != null ? parsedGaveta - systemBalance : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gavetaValue) return;
    onSubmit({ date, gaveta_value: parseFloat(gavetaValue), observation: observation.trim(), system_balance: systemBalance });
    setGavetaValue('');
    setObservation('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-warning" />
            Conferir Caixa
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="v-date">Data</Label>
            <Input id="v-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <div className="p-3 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">Saldo do Sistema</p>
            <p className="text-lg font-bold font-mono">{formatCurrency(currentBalance)}</p>
          </div>

          <div>
            <Label htmlFor="v-gaveta">Valor contado na gaveta (R$)</Label>
            <Input
              id="v-gaveta"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={gavetaValue}
              onChange={(e) => setGavetaValue(e.target.value)}
              required
              className="font-mono"
            />
          </div>

          {diff != null && (
            <div className={`p-3 rounded-lg ${
              diff < 0 
                ? 'bg-red-50' 
                : diff === 0 
                  ? 'bg-gray-50' 
                  : 'bg-green-50'
            }`}>
              <p className="text-sm text-muted-foreground">Diferença</p>
              <p className={`text-lg font-bold font-mono ${
                diff < 0 
                  ? 'text-red-600' 
                  : diff === 0 
                    ? 'text-black' 
                    : 'text-green-600'
              }`}>
                {formatCurrency(diff)}
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="v-obs">Observação (opcional)</Label>
            <Textarea id="v-obs" placeholder="Detalhes da conferência..." value={observation} onChange={(e) => setObservation(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={!gavetaValue}>Confirmar Conferência</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
