import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildInstallmentsFromItem, toIsoDateString } from '@/lib/parcelas';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import DateRangeFilter from '@/components/DateRangeFilter';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CarFront,
  Droplets,
  FileBarChart,
  FileWarning,
  Fuel,
  RotateCcw,
  Search,
  ShoppingCart,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  fetchComprasAvista,
  fetchComprasFaturadas,
  fetchProgramacaoSemanal,
  formatCurrencyBR,
} from '@/lib/comprasService';
import { fetchAbastecimentos } from '@/lib/combustivelService';
import { toast } from 'sonner';

const COLORS = ['#0f172a', '#2563eb', '#f97316'];

type ExecutiveAlert = {
  id: string;
  title: string;
  description: string;
  tone: 'critical' | 'warning' | 'info';
  cta?: string;
  to?: string;
};

type CompraSemPedido = {
  id: string;
  origem: 'A Vista' | 'Faturada';
  data: string;
  fornecedor: string;
  obra: string;
  valor: number;
};

function formatDateBR(date: string) {
  if (!date) return '';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

function monthLabel(isoDate: string) {
  const [year, month] = isoDate.split('-');
  return `${month}/${year.slice(2)}`;
}

export default function PainelExecutivoPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [draftDateFrom, setDraftDateFrom] = useState('');
  const [draftDateTo, setDraftDateTo] = useState('');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [comprasAvistaTotal, setComprasAvistaTotal] = useState(0);
  const [comprasFaturadasTotal, setComprasFaturadasTotal] = useState(0);
  const [comprasSemPedidoTotal, setComprasSemPedidoTotal] = useState(0);
  const [comprasSemPedidoCount, setComprasSemPedidoCount] = useState(0);
  const [programacaoTotal, setProgramacaoTotal] = useState(0);
  const [programacaoSemResponsavel, setProgramacaoSemResponsavel] = useState(0);
  const [combustivelTotal, setCombustivelTotal] = useState(0);
  const [combustivelLitros, setCombustivelLitros] = useState(0);
  const [abastecimentosCount, setAbastecimentosCount] = useState(0);

  const [topObras, setTopObras] = useState<Array<{ name: string; value: number }>>([]);
  const [topFornecedores, setTopFornecedores] = useState<Array<{ name: string; value: number }>>([]);
  const [topVeiculos, setTopVeiculos] = useState<Array<{ name: string; value: number }>>([]);
  const [comprasMix, setComprasMix] = useState<Array<{ name: string; value: number }>>([]);
  const [combustivelMensal, setCombustivelMensal] = useState<Array<{ month: string; valor: number; litros: number }>>(
    []
  );
  const [semPedidoItems, setSemPedidoItems] = useState<CompraSemPedido[]>([]);

  const consultFlashPendingRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const [comprasAvista, comprasFaturadas, programacao, abastecimentos] = await Promise.all([
        fetchComprasAvista(),
        fetchComprasFaturadas(),
        fetchProgramacaoSemanal(),
        fetchAbastecimentos(),
      ]);

      const inRange = (itemDate: string) => {
        if (dateFrom && itemDate < dateFrom) return false;
        if (dateTo && itemDate > dateTo) return false;
        return true;
      };

      const avistaFiltered = comprasAvista.filter((item) => inRange(item.data));

      // For faturadas, consider only installments with due dates in the selected range
      const faturadasWithInstallments: Array<{ item: typeof comprasFaturadas[0]; valor: number }> = [];
      comprasFaturadas.forEach((item) => {
        const installments = buildInstallmentsFromItem(item);
        const matchingValue = installments.reduce((sum, inst) => {
          const isoDate = toIsoDateString(inst.due);
          return inRange(isoDate) ? sum + inst.value : sum;
        }, 0);
        if (matchingValue > 0) {
          faturadasWithInstallments.push({ item, valor: matchingValue });
        }
      });

      const programacaoFiltered = programacao.filter((item) => inRange(item.data));
      const abastecimentosFiltered = abastecimentos.filter((item) => inRange(item.data));

      const totalAvista = avistaFiltered.reduce((sum, item) => sum + item.valor, 0);
      const totalFaturadas = faturadasWithInstallments.reduce((sum, entry) => sum + entry.valor, 0);

      const semPedidoAvista = avistaFiltered.filter((item) => !item.pedido?.trim());
      const semPedidoFaturadas = faturadasWithInstallments.filter((entry) => !entry.item.pedido?.trim());

      const totalSemPedido =
        semPedidoAvista.reduce((sum, item) => sum + item.valor, 0) +
        semPedidoFaturadas.reduce((sum, entry) => sum + entry.valor, 0);

      const totalProgramacao = programacaoFiltered.reduce((sum, item) => sum + item.valor, 0);
      const totalCombustivel = abastecimentosFiltered.reduce((sum, item) => sum + item.valor_total, 0);
      const totalLitros = abastecimentosFiltered.reduce((sum, item) => sum + item.quantidade_litros, 0);

      const obrasMap = new Map<string, number>();
      [...avistaFiltered, ...programacaoFiltered].forEach((item) => {
        const obra = item.obra?.trim() || 'Sem obra';
        obrasMap.set(obra, (obrasMap.get(obra) || 0) + item.valor);
      });
      faturadasWithInstallments.forEach((entry) => {
        const obra = entry.item.obra?.trim() || 'Sem obra';
        obrasMap.set(obra, (obrasMap.get(obra) || 0) + entry.valor);
      });

      const fornecedoresMap = new Map<string, number>();
      [...avistaFiltered, ...programacaoFiltered].forEach((item) => {
        const fornecedor = item.fornecedor?.trim() || 'Sem fornecedor';
        fornecedoresMap.set(fornecedor, (fornecedoresMap.get(fornecedor) || 0) + item.valor);
      });
      faturadasWithInstallments.forEach((entry) => {
        const fornecedor = entry.item.fornecedor?.trim() || 'Sem fornecedor';
        fornecedoresMap.set(fornecedor, (fornecedoresMap.get(fornecedor) || 0) + entry.valor);
      });

      const veiculosMap = new Map<string, number>();
      abastecimentosFiltered.forEach((item) => {
        const veiculoNome =
          item.veiculo?.placa?.trim() ||
          item.veiculo?.modelo?.trim() ||
          'Sem identificacao';
        veiculosMap.set(veiculoNome, (veiculosMap.get(veiculoNome) || 0) + item.valor_total);
      });

      const mensalMap = new Map<string, { valor: number; litros: number }>();
      abastecimentosFiltered.forEach((item) => {
        const key = item.data.slice(0, 7);
        const current = mensalMap.get(key) || { valor: 0, litros: 0 };
        current.valor += item.valor_total;
        current.litros += item.quantidade_litros;
        mensalMap.set(key, current);
      });

      const semPedidoList: CompraSemPedido[] = [
        ...semPedidoAvista.map((item) => ({
          id: item.id,
          origem: 'A Vista' as const,
          data: item.data,
          fornecedor: item.fornecedor,
          obra: item.obra || 'Sem obra',
          valor: item.valor,
        })),
        ...semPedidoFaturadas.map((entry) => ({
          id: entry.item.id,
          origem: 'Faturada' as const,
          data: entry.item.data,
          fornecedor: entry.item.fornecedor,
          obra: entry.item.obra || 'Sem obra',
          valor: entry.valor,
        })),
      ]
        .sort((a, b) => b.data.localeCompare(a.data))
        .slice(0, 5);

      setComprasAvistaTotal(totalAvista);
      setComprasFaturadasTotal(totalFaturadas);
      setComprasSemPedidoTotal(totalSemPedido);
      setComprasSemPedidoCount(semPedidoAvista.length + semPedidoFaturadas.length);
      setProgramacaoTotal(totalProgramacao);
      setProgramacaoSemResponsavel(programacaoFiltered.filter((item) => !item.responsavel?.trim()).length);
      setCombustivelTotal(totalCombustivel);
      setCombustivelLitros(totalLitros);
      setAbastecimentosCount(abastecimentosFiltered.length);

      setTopObras(
        Array.from(obrasMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)
      );

      setTopFornecedores(
        Array.from(fornecedoresMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 4)
      );

      setTopVeiculos(
        Array.from(veiculosMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 4)
      );

      setComprasMix(
        [
          { name: 'A Vista', value: totalAvista },
          { name: 'Faturadas', value: totalFaturadas },
          { name: 'Programacao', value: totalProgramacao },
        ].filter((item) => item.value > 0)
      );

      setCombustivelMensal(
        Array.from(mensalMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, values]) => ({
            month: monthLabel(month),
            valor: values.valor,
            litros: values.litros,
          }))
      );

      setSemPedidoItems(semPedidoList);
    } catch (e: any) {
      toast.error(e.message || 'Nao foi possivel carregar o painel executivo.');
    } finally {
      setLoading(false);
      if (consultFlashPendingRef.current) {
        consultFlashPendingRef.current = false;
        toast.success('Dados atualizados', { duration: 2200 });
      }
    }
  }, [dateFrom, dateTo]);

  const handleVerEspelho = useCallback(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    params.set('semPedido', '1');

    const search = params.toString();
    navigate({
      pathname: '/compras/espelho',
      search: search ? `?${search}` : '',
    });
  }, [dateFrom, dateTo, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const totalCompras = comprasAvistaTotal + comprasFaturadasTotal;
  const percentualSemPedido = totalCompras > 0 ? (comprasSemPedidoTotal / totalCompras) * 100 : 0;
  const combustivelMedio = abastecimentosCount > 0 ? combustivelTotal / abastecimentosCount : 0;

  const alerts = useMemo<ExecutiveAlert[]>(() => {
    const nextAlerts: ExecutiveAlert[] = [];

    if (comprasSemPedidoTotal > 0) {
      nextAlerts.push({
        id: 'compras-sem-pedido',
        title: 'Compras sem pedido exigem atencao',
        description: `${comprasSemPedidoCount} lancamentos somam ${formatCurrencyBR(comprasSemPedidoTotal)} ainda sem pedido vinculado.`,
        tone: comprasSemPedidoTotal > 100000 ? 'critical' : 'warning',
        cta: 'Espelho geral',
        to: '/compras/espelho',
      });
    }

    if (programacaoSemResponsavel > 0) {
      nextAlerts.push({
        id: 'programacao-sem-responsavel',
        title: 'Programacao com pendencia de responsavel',
        description: `${programacaoSemResponsavel} itens da programacao semanal ainda nao tem responsavel atribuido.`,
        tone: 'warning',
        cta: 'Programacao',
        to: '/compras/programacao-semanal',
      });
    }

    if (topVeiculos.length > 0) {
      nextAlerts.push({
        id: 'combustivel-top-veiculo',
        title: 'Consumo concentrado em um veiculo',
        description: `${topVeiculos[0].name} acumula ${formatCurrencyBR(topVeiculos[0].value)} em combustivel.`,
        tone: 'info',
        cta: 'Dashboard',
        to: '/combustivel/dashboard',
      });
    }

    return nextAlerts.slice(0, 3);
  }, [comprasSemPedidoCount, comprasSemPedidoTotal, programacaoSemResponsavel, topVeiculos]);

  function handleConsultar() {
    setDateFrom(draftDateFrom);
    setDateTo(draftDateTo);
  }

  function handleLimpar() {
    setDraftDateFrom('');
    setDraftDateTo('');
    setDateFrom('');
    setDateTo('');
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Carregando painel executivo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Painel Executivo</h2>
          <p className="text-sm text-muted-foreground">
            Foco em previsao de compras e combustivel.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            consultFlashPendingRef.current = true;
            void load();
          }}
        >
          Atualizar agora
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <DateRangeFilter
              dateFrom={draftDateFrom}
              dateTo={draftDateTo}
              onDateFromChange={setDraftDateFrom}
              onDateToChange={setDraftDateTo}
            />

            <div className="flex gap-2">
              <Button size="sm" onClick={handleConsultar}>
                <Search className="mr-1 h-4 w-4" />
                Consultar
              </Button>
              <Button variant="outline" size="sm" onClick={handleLimpar}>
                <RotateCcw className="mr-1 h-4 w-4" />
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Previsao de Compras</p>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">{formatCurrencyBR(totalCompras)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCurrencyBR(comprasAvistaTotal)} a vista e {formatCurrencyBR(comprasFaturadasTotal)} faturadas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Sem Pedido</p>
              <FileWarning className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">{formatCurrencyBR(comprasSemPedidoTotal)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {comprasSemPedidoCount} lancamentos no periodo.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Programacao</p>
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">{formatCurrencyBR(programacaoTotal)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {programacaoSemResponsavel} itens sem responsavel.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Combustivel</p>
              <Fuel className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">{formatCurrencyBR(combustivelTotal)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {combustivelLitros.toFixed(1)} L em {abastecimentosCount} abastecimentos.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Alertas Prioritarios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{alert.title}</p>
                      <Badge
                        variant={
                          alert.tone === 'critical'
                            ? 'destructive'
                            : alert.tone === 'warning'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {alert.tone === 'critical'
                          ? 'Critico'
                          : alert.tone === 'warning'
                          ? 'Atencao'
                          : 'Acompanhar'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.description}</p>
                  </div>

                  {alert.to && (
                    <Button variant="ghost" size="sm" onClick={() => navigate(alert.to!)}>
                      {alert.cta}
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Indicadores Chave</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>Volume sem pedido</span>
                <span className="font-medium">{percentualSemPedido.toFixed(1)}%</span>
              </div>
              <Progress value={Math.min(percentualSemPedido, 100)} className="h-2" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">Sem pedido</p>
                <p className="text-xl font-bold">{comprasSemPedidoCount}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">Sem responsavel</p>
                <p className="text-xl font-bold">{programacaoSemResponsavel}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">Abastecimentos</p>
                <p className="text-xl font-bold">{abastecimentosCount}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">Ticket medio</p>
                <p className="text-xl font-bold">{formatCurrencyBR(combustivelMedio)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Composicao da Previsao</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={comprasMix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {comprasMix.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrencyBR(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {comprasMix.map((item, index) => {
                const percent =
                  totalCompras + programacaoTotal > 0
                    ? (item.value / (totalCompras + programacaoTotal)) * 100
                    : 0;

                return (
                  <div key={item.name} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <span className="text-sm font-semibold">{percent.toFixed(1)}%</span>
                    </div>
                    <p className="mt-2 text-xl font-bold">{formatCurrencyBR(item.value)}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sem Pedido no Periodo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {semPedidoItems.map((item) => (
              <div key={`${item.origem}-${item.id}`} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={item.origem === 'A Vista' ? 'outline' : 'secondary'}>
                        {item.origem}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDateBR(item.data)}</span>
                    </div>
                    <p className="mt-2 truncate font-medium">{item.fornecedor}</p>
                    <p className="text-sm text-muted-foreground truncate">{item.obra}</p>
                  </div>
                  <p className="whitespace-nowrap font-semibold">{formatCurrencyBR(item.valor)}</p>
                </div>
              </div>
            ))}

            <div className="pt-1">
              <Button variant="ghost" size="sm" onClick={handleVerEspelho}>
                Ver espelho geral
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Obras por Volume</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topObras} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => formatCurrencyBR(value)} />
                <Bar dataKey="value" fill="#0f172a" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Fornecedores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topFornecedores.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">#{index + 1}</p>
                  <p className="truncate font-medium">{item.name}</p>
                </div>
                <p className="whitespace-nowrap font-semibold">{formatCurrencyBR(item.value)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CarFront className="h-4 w-4 text-slate-500" />
              <CardTitle className="text-base">Combustivel por Veiculo</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {topVeiculos.map((item) => (
              <div key={item.name} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="whitespace-nowrap font-semibold">{formatCurrencyBR(item.value)}</p>
                </div>
                <div className="mt-2">
                  <Progress
                    value={topVeiculos[0]?.value ? (item.value / topVeiculos[0].value) * 100 : 0}
                    className="h-2"
                  />
                </div>
              </div>
            ))}

            <div className="pt-1">
              <Button variant="ghost" size="sm" onClick={() => navigate('/combustivel/dashboard')}>
                Ver dashboard de combustivel
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-sky-500" />
              <CardTitle className="text-base">Evolucao Mensal</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combustivelMensal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" tickFormatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value}L`} />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === 'valor' ? formatCurrencyBR(value) : `${value.toFixed(1)} L`
                  }
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="valor" name="Valor" stroke="#0f172a" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="litros" name="Litros" stroke="#0ea5e9" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
