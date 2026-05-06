import { TrendingUp, TrendingDown, Wallet, AlertTriangle, History, ArrowRightLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PeriodSummary, formatCurrency } from '@/lib/cashRegister';

interface Props { summary: PeriodSummary; }

export default function DashboardCards({ summary }: Props) {
  const diffColor = summary.diferencaPeriodo < 0
    ? 'text-destructive'
    : summary.diferencaPeriodo > 0
      ? 'text-success'
      : 'text-foreground';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><History className="h-4 w-4" /> Saldo Anterior</div>
          <p className="text-2xl font-bold mt-1">{formatCurrency(summary.saldoAnterior)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-success text-sm"><TrendingUp className="h-4 w-4" /> Entradas</div>
          <p className="text-2xl font-bold mt-1 text-success">{formatCurrency(summary.totalEntradas)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-destructive text-sm"><TrendingDown className="h-4 w-4" /> Saídas</div>
          <p className="text-2xl font-bold mt-1 text-destructive">{formatCurrency(summary.totalSaidas)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Wallet className="h-4 w-4" /> Saldo Final</div>
          <p className="text-2xl font-bold mt-1">{formatCurrency(summary.saldoFinalPeriodo)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><AlertTriangle className="h-4 w-4" /> Última Conferência</div>
          <p className={`text-2xl font-bold mt-1 ${
            summary.totalDifferences < 0
              ? 'text-destructive'
              : summary.totalDifferences === 0
                ? 'text-foreground'
                : 'text-success'
          }`}>
            {formatCurrency(summary.totalDifferences)}
          </p>
        </CardContent>
      </Card>
      {summary.hasDivergence && (
        <div className="col-span-full bg-warning/10 text-warning p-3 rounded-md text-sm font-medium">
          ⚠ Divergência detectada
        </div>
      )}
    </div>
  );
}
