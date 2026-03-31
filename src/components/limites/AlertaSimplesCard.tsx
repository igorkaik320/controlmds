import { AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertaSimples } from "@/lib/limitesSimples";
import { formatCurrencyBR } from "@/lib/comprasService";

interface AlertaSimplesCardProps {
  alerta: AlertaSimples;
}

export function AlertaSimplesCard({ alerta }: AlertaSimplesCardProps) {
  const getAlertIcon = () => {
    switch (alerta.tipo) {
      case 'perigo':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'alerta':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
  };

  const getAlertColor = () => {
    switch (alerta.tipo) {
      case 'perigo':
        return 'border-red-200 bg-red-50';
      case 'alerta':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-green-200 bg-green-50';
    }
  };

  const getAlertTitle = () => {
    switch (alerta.tipo) {
      case 'perigo':
        return '⚠️ Limite Ultrapassado';
      case 'alerta':
        return '⚡ Próximo do Limite';
      default:
        return '✅ Dentro do Limite';
    }
  };

  const getAlertDescription = () => {
    switch (alerta.tipo) {
      case 'perigo':
        return `O valor faturado ultrapassou o limite. Você ainda tem ${formatCurrencyBR(alerta.valorDisponivel)} disponível (negativo).`;
      case 'alerta':
        return `O valor faturado está próximo do limite. Você ainda tem ${formatCurrencyBR(alerta.valorDisponivel)} disponível.`;
      default:
        return `O valor faturado está dentro do limite. Você ainda tem ${formatCurrencyBR(alerta.valorDisponivel)} disponível.`;
    }
  };

  return (
    <Card className={`${getAlertColor()} border-2`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {getAlertIcon()}
          <CardTitle className="text-lg">{getAlertTitle()}</CardTitle>
        </div>
        <CardDescription>{getAlertDescription()}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-white rounded-lg border">
            <p className="text-xs text-muted-foreground mb-1">Mês Referência</p>
            <p className="font-medium">
              {new Date(alerta.mes + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {alerta.percentual.toFixed(1)}% do limite
            </p>
          </div>
          
          <div className="p-3 bg-white rounded-lg border">
            <p className="text-xs text-muted-foreground mb-1">Valor Faturado</p>
            <p className="font-semibold text-lg">{formatCurrencyBR(alerta.valorAtual)}</p>
          </div>
          
          <div className={`p-3 rounded-lg border ${
            alerta.valorDisponivel < 0 ? 'bg-red-100 border-red-300' :
            alerta.valorDisponivel < (alerta.valorLimite * 0.2) ? 'bg-yellow-100 border-yellow-300' :
            'bg-green-100 border-green-300'
          }`}>
            <p className="text-xs text-muted-foreground mb-1">Disponível para Faturar</p>
            <p className={`font-semibold text-lg ${
              alerta.valorDisponivel < 0 ? 'text-red-600' :
              alerta.valorDisponivel < (alerta.valorLimite * 0.2) ? 'text-yellow-600' :
              'text-green-600'
            }`}>
              {formatCurrencyBR(alerta.valorDisponivel)}
            </p>
          </div>
        </div>
        
        <div className="mt-3 p-2 bg-gray-50 rounded">
          <div className="flex justify-between text-sm">
            <span>Limite Total:</span>
            <span className="font-medium">{formatCurrencyBR(alerta.valorLimite)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
