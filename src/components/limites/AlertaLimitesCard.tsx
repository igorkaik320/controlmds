import { AlertTriangle, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertaLimite } from "@/lib/limites";
import { formatCurrencyBR } from "@/lib/comprasService";

interface AlertaLimitesCardProps {
  alertas: AlertaLimite[];
}

export function AlertaLimitesCard({ alertas }: AlertaLimitesCardProps) {
  if (alertas.length === 0) return null;

  const getAlertIcon = (tipo: AlertaLimite['tipo']) => {
    switch (tipo) {
      case 'ultrapassado':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'atingido':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'proximo':
        return <TrendingUp className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getAlertColor = (tipo: AlertaLimite['tipo']) => {
    switch (tipo) {
      case 'ultrapassado':
        return 'border-red-200 bg-red-50';
      case 'atingido':
        return 'border-orange-200 bg-orange-50';
      case 'proximo':
        return 'border-yellow-200 bg-yellow-50';
    }
  };

  const getAlertTitle = (tipo: AlertaLimite['tipo']) => {
    switch (tipo) {
      case 'ultrapassado':
        return 'Limite Ultrapassado';
      case 'atingido':
        return 'Limite Atingido';
      case 'proximo':
        return 'Próximo do Limite';
    }
  };

  const getAlertDescription = (tipo: AlertaLimite['tipo']) => {
    switch (tipo) {
      case 'ultrapassado':
        return 'O valor faturado ultrapassou o limite definido para este mês.';
      case 'atingido':
        return 'O valor faturado atingiu exatamente o limite definido.';
      case 'proximo':
        return 'O valor faturado está próximo do limite definido.';
    }
  };

  return (
    <Card className={`${getAlertColor(alertas[0].tipo)} border-2`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {getAlertIcon(alertas[0].tipo)}
          <CardTitle className="text-lg">{getAlertTitle(alertas[0].tipo)}</CardTitle>
        </div>
        <CardDescription>{getAlertDescription(alertas[0].tipo)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {alertas.map((alerta, index) => (
          <div key={index} className="flex justify-between items-center p-3 bg-white rounded-lg border">
            <div>
              <p className="font-medium">
                {alerta.empresaNome ? `${alerta.empresaNome} - ` : ''}
                {new Date(alerta.mes + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </p>
              <p className="text-sm text-muted-foreground">
                {alerta.percentual.toFixed(1)}% do limite utilizado
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{formatCurrencyBR(alerta.valorAtual)}</p>
              <p className="text-sm text-muted-foreground">
                de {formatCurrencyBR(alerta.valorLimite)}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
