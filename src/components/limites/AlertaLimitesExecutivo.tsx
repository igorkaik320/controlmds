import { verificarLimiteGlobal, buscarLimiteGlobal } from "@/lib/limitesSimples";
import { fetchComprasFaturadas, formatCurrencyBR } from "@/lib/comprasService";
import { buildInstallmentsFromItem } from "@/lib/parcelas";
import { useEffect, useState } from "react";
import { AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AlertaLimitesExecutivoProps {
  dateFrom?: string;
  dateTo?: string;
}

export function AlertaLimitesExecutivo({ dateFrom, dateTo }: AlertaLimitesExecutivoProps) {
  const [limitesAlertas, setLimitesAlertas] = useState<any[]>([]);

  useEffect(() => {
    async function carregarLimites() {
      try {
        const comprasFaturadas = await fetchComprasFaturadas();

        const limiteGlobal = buscarLimiteGlobal();
        if (!limiteGlobal) return;

        // Filtrar por período se especificado
        const inRange = (itemDate: string) => {
          // Converter datas para formato ISO YYYY-MM-DD para comparação correta
          const normalizeDate = (date: string) => {
            // Se já está em formato ISO (YYYY-MM-DD), retorna como está
            if (date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
            
            // Se está em formato DD/MM/YYYY, converter para ISO
            if (date.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
              const [day, month, year] = date.split('/');
              return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
            
            return date;
          };
          
          const normalizedItemDate = normalizeDate(itemDate);
          const normalizedDateFrom = dateFrom ? normalizeDate(dateFrom) : null;
          const normalizedDateTo = dateTo ? normalizeDate(dateTo) : null;
          
          if (normalizedDateFrom && normalizedItemDate < normalizedDateFrom) return false;
          if (normalizedDateTo && normalizedItemDate > normalizedDateTo) return false;
          return true;
        };

        // Construir parcelas com datas de vencimento
        const parcelasPorMes = new Map<string, number>();
        
        comprasFaturadas.forEach((compra) => {
          const parcelas = buildInstallmentsFromItem(compra);
          parcelas.forEach((parcela) => {
            if (inRange(parcela.due)) {
              const mesKey = parcela.due.slice(0, 7);
              const total = parcelasPorMes.get(mesKey) || 0;
              parcelasPorMes.set(mesKey, total + parcela.value);
            }
          });
        });

        // Gerar alertas para cada mês
        const alertas = Array.from(parcelasPorMes.entries()).map(([mes, valor]) => {
          const alerta = verificarLimiteGlobal(mes, valor);
          if (!alerta) return null;

          const [ano, mesNum] = mes.split('-');
          const mesNome = new Date(parseInt(ano), parseInt(mesNum) - 1).toLocaleDateString('pt-BR', { 
            month: 'long', 
            year: 'numeric' 
          });

          return {
            mes,
            mesNome,
            valor,
            alerta
          };
        }).filter(Boolean);

        setLimitesAlertas(alertas);
      } catch (error) {
        console.error('Erro ao carregar alertas de limites:', error);
      }
    }

    carregarLimites();
  }, [dateFrom, dateTo]);

  if (limitesAlertas.length === 0) return null;

  const getAlertIcon = (tipo: string) => {
    switch (tipo) {
      case 'perigo':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'alerta':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getAlertBadge = (tipo: string) => {
    switch (tipo) {
      case 'perigo':
        return <Badge variant="destructive">Crítico</Badge>;
      case 'alerta':
        return <Badge variant="secondary">Atenção</Badge>;
      default:
        return <Badge variant="outline">Normal</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          Alertas de Limites - Compras Faturadas
        </CardTitle>
        <CardDescription>
          Limite global configurado: {formatCurrencyBR(buscarLimiteGlobal()?.valor || 0)}<br/>
          <span className="text-xs">Considerando datas de vencimento das parcelas (não data da compra)</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {limitesAlertas.map((item, index) => (
          <div key={index} className={`rounded-lg border p-3 ${
            item.alerta.tipo === 'perigo' ? 'border-red-200 bg-red-50' :
            item.alerta.tipo === 'alerta' ? 'border-yellow-200 bg-yellow-50' :
            'border-green-200 bg-green-50'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  {getAlertIcon(item.alerta.tipo)}
                  <span className="font-medium">{item.mesNome}</span>
                  {getAlertBadge(item.alerta.tipo)}
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Faturado:</span>
                    <div className="font-semibold">{formatCurrencyBR(item.valor)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Disponível:</span>
                    <div className={`font-semibold ${
                      item.alerta.valorDisponivel < 0 ? 'text-red-600' :
                      item.alerta.valorDisponivel < (item.alerta.valorLimite * 0.2) ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {formatCurrencyBR(item.alerta.valorDisponivel)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">% Utilizado:</span>
                    <div className="font-semibold">{item.alerta.percentual.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
