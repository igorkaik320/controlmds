import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { date: string; value: number; observation: string }) => void;
}

export default function InitBalanceDialog({ open, onClose, onSubmit }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState('');
  const [observation, setObservation] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value || !observation.trim()) return;
    onSubmit({ date, value: parseFloat(value), observation: observation.trim() });
    setValue('');
    setObservation('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Inicialização de Saldo
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="init-date">Data</Label>
            <Input id="init-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="init-value">Valor do Saldo Inicial (R$)</Label>
            <Input
              id="init-value"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              className="font-mono"
            />
          </div>
          <div>
            <Label htmlFor="init-obs">Observação (obrigatória)</Label>
            <Textarea
              id="init-obs"
              placeholder="Ex: Abertura de Caixa, Ajuste de Conferência..."
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={!value || !observation.trim()}>Confirmar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
