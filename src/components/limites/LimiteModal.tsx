import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { salvarLimite, LimiteMensal } from "@/lib/limites";
import { Empresa } from "@/lib/empresasService";
import { toast } from "sonner";

interface LimiteModalProps {
  children: React.ReactNode;
  empresas: Empresa[];
  mesSelecionado?: string;
  onLimiteCriado?: () => void;
}

export function LimiteModal({ children, empresas, mesSelecionado, onLimiteCriado }: LimiteModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    mes: mesSelecionado || new Date().toISOString().slice(0, 7),
    valor: '',
    empresaId: '',
    ativo: true,
    notificarAtingido: true,
    notificarProximo: true,
    percentualProximo: 80
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.valor || parseFloat(formData.valor) <= 0) {
      toast.error('Informe um valor válido para o limite');
      return;
    }

    setLoading(true);
    try {
      const limite: Omit<LimiteMensal, 'id'> = {
        mes: formData.mes,
        valor: parseFloat(formData.valor),
        empresaId: formData.empresaId || undefined,
        ativo: formData.ativo,
        notificarAtingido: formData.notificarAtingido,
        notificarProximo: formData.notificarProximo,
        percentualProximo: formData.percentualProximo
      };

      salvarLimite(limite);
      toast.success('Limite configurado com sucesso!');
      setOpen(false);
      onLimiteCriado?.();
      
      // Reset form
      setFormData({
        mes: mesSelecionado || new Date().toISOString().slice(0, 7),
        valor: '',
        empresaId: '',
        ativo: true,
        notificarAtingido: true,
        notificarProximo: true,
        percentualProximo: 80
      });
    } catch (error) {
      toast.error('Erro ao configurar limite');
    } finally {
      setLoading(false);
    }
  };

  const formatarMes = (mes: string) => {
    const [ano, mesNum] = mes.split('-');
    return new Date(parseInt(ano), parseInt(mesNum) - 1).toLocaleDateString('pt-BR', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configurar Limite Mensal</DialogTitle>
          <DialogDescription>
            Defina um limite de faturamento para receber alertas quando estiver próximo ou atingir o valor.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mes">Mês</Label>
            <Input
              id="mes"
              type="month"
              value={formData.mes}
              onChange={(e) => setFormData(prev => ({ ...prev, mes: e.target.value }))}
              required
            />
            <p className="text-xs text-muted-foreground">
              {formatarMes(formData.mes)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor">Valor do Limite</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              placeholder="100000.00"
              value={formData.valor}
              onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="empresa">Empresa (opcional)</Label>
            <Select
              value={formData.empresaId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, empresaId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas as empresas</SelectItem>
                {empresas.map((empresa) => (
                  <SelectItem key={empresa.id} value={empresa.id!}>
                    {empresa.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="percentualProximo">Alertar quando atingir % do limite</Label>
            <Input
              id="percentualProximo"
              type="number"
              min="1"
              max="99"
              value={formData.percentualProximo}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                percentualProximo: parseInt(e.target.value) || 80 
              }))}
            />
            <p className="text-xs text-muted-foreground">
              Ex: 80% para alertar quando faltar 20% para atingir o limite
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="notificarProximo"
              checked={formData.notificarProximo}
              onChange={(e) => setFormData(prev => ({ ...prev, notificarProximo: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="notificarProximo">Notificar quando próximo do limite</Label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="notificarAtingido"
              checked={formData.notificarAtingido}
              onChange={(e) => setFormData(prev => ({ ...prev, notificarAtingido: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="notificarAtingido">Notificar quando atingir o limite</Label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Configurar Limite'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
