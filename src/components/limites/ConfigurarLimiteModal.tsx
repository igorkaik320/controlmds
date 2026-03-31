import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { salvarLimiteGlobal, buscarLimiteGlobal } from "@/lib/limitesSimples";
import { toast } from "sonner";

interface ConfigurarLimiteModalProps {
  children: React.ReactNode;
  onLimiteCriado?: () => void;
}

export function ConfigurarLimiteModal({ children, onLimiteCriado }: ConfigurarLimiteModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [valor, setValor] = useState('');
  
  // Carregar limite existente quando abrir o modal
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      const limiteExistente = buscarLimiteGlobal();
      if (limiteExistente) {
        setValor(limiteExistente.valor.toString());
      }
    }
    setOpen(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!valor || parseFloat(valor) <= 0) {
      toast.error('Informe um valor válido para o limite');
      return;
    }

    setLoading(true);
    try {
      salvarLimiteGlobal(parseFloat(valor));
      toast.success('Limite global configurado com sucesso!');
      setOpen(false);
      onLimiteCriado?.();
      
      // Reset form
      setValor('');
    } catch (error) {
      toast.error('Erro ao configurar limite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Configurar Limite Global</DialogTitle>
          <DialogDescription>
            Defina um limite mensal de faturamento que se aplicará a todos os meses. O sistema alertará quando estiver próximo ou ultrapassar este valor.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="valor">Valor do Limite Mensal</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              placeholder="100000.00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Ex: 100000 para R$ 100.000,00 - Este valor se aplicará a todos os meses
            </p>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Como funcionam os alertas:</strong><br/>
              • 🟡 <strong>Alerta:</strong> Ao atingir 80% do limite<br/>
              • 🔴 <strong>Perigo:</strong> Ao atingir ou ultrapassar 100%<br/>
              • 💰 <strong>Disponível:</strong> Valor restante para faturar no mês
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Configurar Limite Global'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
