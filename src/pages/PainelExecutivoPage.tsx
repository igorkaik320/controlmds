import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CarFront,
  DollarSign,
  Droplets,
  Fuel,
  Landmark,
  PackageSearch,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  fetchComprasAvista,
  fetchComprasFaturadas,
  fetchProgramacaoSemanal,
  formatCurrencyBR,
} from '@/lib/comprasService';
import { fetchTransactions, fetchVerifications, getSummary, fetchAllUsersWithRoles } from '@/lib/cashRegister';
import { fetchAbastecimentos } from '@/lib/combustivelService';
import { toast } from 'sonner';

type ExecutiveAlert = {
  id: string;
  title: string;
  description: string;
  tone: 'critical' | 'warning' | 'info';
  cta?: string;
};

type KpiCard = {
  title: string;
  value: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
};

export default function PainelExecutivoPage() {
  const [loading, setLoading] = useState(true);
  const [comprasAvistaTotal, setComprasAvistaTotal] = useState(0);
  const [comprasFaturadasTotal, setComprasFaturadasTotal] = useState(0);
  const [comprasSemPedidoTotal, setComprasSemPedidoTotal] = useState(0);
  const [comprasSemPedidoCount, setComprasSemPedidoCount] = useState(0);
  const [programacaoTotal, setProgramacaoTotal] = useState(0);
  const [programacaoSemResponsavel, setProgramacaoSemResponsavel] = useState(0);
  const [caixaSaldoAtual, setCaixaSaldoAtual] = useState(0);
  const [caixaDiferenca, setCaixaDiferenca] = useState(0);
  const [combustivelTotal, setCombustivelTotal] = useState(0);
  const [combustivelLitros, setCombustivelLitros] = useState(0);
  const [abastecimentosCount, setAbastecimentosCount] = useState(0);
  const [usuariosTotal, setUsuariosTotal] = useState(0);
  const [adminsTotal, setAdminsTotal] = useState(0);
  const [topObras, setTopObras] = useState<Array<{ name: string; value: number }>>([]);
  const [topFornecedores, setTopFornecedores] = useState<Array<{ name: string; value: number }>>([]);
  const [topVeiculos, setTopVeiculos] = useState<Array<{ name: string; value: number }>>([]);

  const load = useCallback(async () => {
    try {
      const [
        comprasAvista,
        comprasFaturadas,
        programacao,
        transactions,
        verifications,
        abastecimentos,
        usuarios,
      ] = await Promise.all([
        fetchComprasAvista(),
        fetchComprasFaturadas(),
        fetchProgramacaoSemanal(),
        fetchTransactions(),
        fetchVerifications(),
        fetchAbastecimentos(),
        fetchAllUsersWithRoles(),
      ]);

      const totalAvista = comprasAvista.reduce((sum, item) => sum + item.valor, 0);
      const totalFaturadas = comprasFaturadas.reduce((sum, item) => sum + item.valor, 0);
      const semPedidoAvista = comprasAvista.filter((item) => !item.pedido?.trim());
      const semPedidoFaturadas = comprasFaturadas.filter((item) => !item.pedido?.trim());
      const totalSemPedido =
        semPedidoAvista.reduce((sum, item) => sum + item.valor, 0) +
        semPedidoFaturadas.reduce((sum, item) => sum + item.valor, 0);

      const totalProgramacao = programacao.reduce((sum, item) => sum + item.valor, 0);
      const resumoCaixa = getSummary(transactions, verifications);
      const totalCombustivel = abastecimentos.reduce((sum, item) => sum + item.valor_total, 0);
      const totalLitros = abastecimentos.reduce((sum, item) => sum + item.quantidade_litros, 0);

      const obrasMap = new Map<string, number>();
      [...comprasAvista, ...comprasFaturadas, ...programacao].forEach((item) => {
        const obra = item.obra?.trim() || 'Sem obra informada';
        obrasMap.set(obra, (obrasMap.get(obra) || 0) + item.valor);
      });

      const fornecedoresMap = new Map<string, number>();
      [...comprasAvista, ...comprasFaturadas, ...programacao].forEach((item) => {
        const fornecedor = item.fornecedor?.trim() || 'Sem fornecedor';
        fornecedoresMap.set(fornecedor, (fornecedoresMap.get(fornecedor) || 0) + item.valor);
      });

      const veiculosMap = new Map<string, number>();
      abastecimentos.forEach((item) => {
        const veiculoNome =
          item.veiculo?.placa?.trim() ||
          item.veiculo?.modelo?.trim() ||
          'Sem identificação';
        veiculosMap.set(veiculoNome, (veiculosMap.get(veiculoNome) || 0) + item.valor_total);
      });

      setComprasAvistaTotal(totalAvista);
      setComprasFaturadasTotal(totalFaturadas);
      setComprasSemPedidoTotal(totalSemPedido);
      setComprasSemPedidoCount(semPedidoAvista.length + semPedidoFaturadas.length);
      setProgramacaoTotal(totalProgramacao);
      setProgramacaoSemResponsavel(programacao.filter((item) => !item.responsavel?.trim()).length);
      setCaixaSaldoAtual(resumoCaixa.currentBalance);
      setCaixaDiferenca(resumoCaixa.totalDifferences);
      setCombustivelTotal(totalCombustivel);
      setCombustivelLitros(totalLitros);
      setAbastecimentosCount(abastecimentos.length);
      setUsuariosTotal(usuarios.length);
      setAdminsTotal(usuarios.filter((user) => user.role === 'admin').length);

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
          .slice(0, 5)
      );

      setTopVeiculos(
        Array.from(veiculosMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)
      );
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível carregar o painel executivo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalCompras = comprasAvistaTotal + comprasFaturadasTotal;
  const exposicaoOperacional = totalCompras + programacaoTotal + combustivelTotal;
  const percentualSemPedido = totalCompras > 0 ? (comprasSemPedidoTotal / totalCompras) * 100 : 0;

  const heroCards: KpiCard[] = [
    {
      title: 'Exposição Operacional',
      value: formatCurrencyBR(exposicaoOperacional),
      helper: 'Compras, programação e combustível somados.',
      icon: Wallet,
    },
    {
      title: 'Compras Totais',
      value: formatCurrencyBR(totalCompras),
      helper: `${formatCurrencyBR(comprasAvistaTotal)} à vista e ${formatCurrencyBR(comprasFaturadasTotal)} faturadas.`,
      icon: ShoppingCart,
    },
    {
      title: 'Saldo Atual de Caixa',
      value: formatCurrencyBR(caixaSaldoAtual),
      helper:
        Math.abs(caixaDiferenca) > 0.01
          ? `Última divergência: ${formatCurrencyBR(caixaDiferenca)}`
          : 'Sem divergência relevante na última conferência.',
      icon: Landmark,
    },
    {
      title: 'Combustível',
      value: formatCurrencyBR(combustivelTotal),
      helper: `${combustivelLitros.toFixed(1)} L em ${abastecimentosCount} abastecimentos.`,
      icon: Fuel,
    },
  ];

  const alerts = useMemo<ExecutiveAlert[]>(() => {
    const nextAlerts: ExecutiveAlert[] = [];

    if (comprasSemPedidoTotal > 0) {
      nextAlerts.push({
        id: 'compras-sem-pedido',
        title: 'Compras sem pedido exigem atenção',
        description: `${comprasSemPedidoCount} lançamentos somam ${formatCurrencyBR(comprasSemPedidoTotal)} ainda sem pedido vinculado.`,
        tone: comprasSemPedidoTotal > 100000 ? 'critical' : 'warning',
        cta: 'Revisar espelho geral',
      });
    }

    if (Math.abs(caixaDiferenca) > 0.01) {
      nextAlerts.push({
        id: 'caixa-divergente',
        title: 'Caixa com divergência',
        description: `A última conferência registrou ${formatCurrencyBR(caixaDiferenca)} de diferença entre físico e sistema.`,
        tone: Math.abs(caixaDiferenca) > 100 ? 'critical' : 'warning',
        cta: 'Conferir caixa',
      });
    }

    if (programacaoSemResponsavel > 0) {
      nextAlerts.push({
        id: 'programacao-sem-responsavel',
        title: 'Programação sem responsável definido',
        description: `${programacaoSemResponsavel} lançamentos da programação semanal ainda não têm responsável atribuído.`,
        tone: 'info',
        cta: 'Ajustar programação',
      });
    }

    if (topVeiculos.length > 0) {
      nextAlerts.push({
        id: 'combustivel-top-veiculo',
        title: 'Maior consumo concentrado em um veículo',
        description: `${topVeiculos[0].name} já acumula ${formatCurrencyBR(topVeiculos[0].value)} em combustível.`,
        tone: 'info',
        cta: 'Abrir dashboard de combustível',
      });
    }

    return nextAlerts.slice(0, 4);
  }, [caixaDiferenca, comprasSemPedidoCount, comprasSemPedidoTotal, programacaoSemResponsavel, topVeiculos]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Carregando painel executivo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Painel Executivo</h2>
          <p className="text-sm text-muted-foreground">
            Visão consolidada dos módulos principais para acompanhamento da diretoria.
          </p>
        </div>

        <Button variant="outline" onClick={load}>
          Atualizar agora
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {heroCards.map((card) => (
          <Card key={card.title} className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{card.helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card className="border-slate-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-base">Alertas Prioritários</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Nenhum alerta crítico no momento. Essa área pode virar a central de exceções do sistema.
              </div>
            )}

            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{alert.title}</p>
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
                        ? 'Crítico'
                        : alert.tone === 'warning'
                        ? 'Atenção'
                        : 'Acompanhar'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{alert.description}</p>
                </div>

                {alert.cta && (
                  <Button variant="ghost" size="sm" className="gap-1">
                    {alert.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Indicadores de Processo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Compras sem pedido</span>
                <span className="font-medium">{percentualSemPedido.toFixed(1)}%</span>
              </div>
              <Progress value={Math.min(percentualSemPedido, 100)} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Percentual do volume de compras ainda sem pedido vinculado.
              </p>
            </div>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">Usuários ativos</p>
                <p className="text-xl font-bold">{usuariosTotal}</p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">Administradores</p>
                <p className="text-xl font-bold">{adminsTotal}</p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">Sem responsável</p>
                <p className="text-xl font-bold">{programacaoSemResponsavel}</p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">Divergência de caixa</p>
                <p className="text-xl font-bold">{formatCurrencyBR(caixaDiferenca)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="compras" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 md:w-fit">
          <TabsTrigger value="compras">Compras</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="combustivel">Combustível</TabsTrigger>
          <TabsTrigger value="operacao">Operação</TabsTrigger>
        </TabsList>

        <TabsContent value="compras" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Obras por Volume</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topObras} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => formatCurrencyBR(value)} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Fornecedores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
        </TabsContent>

        <TabsContent value="financeiro" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Compras à Vista</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span className="text-2xl font-bold">{formatCurrencyBR(comprasAvistaTotal)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Compras Faturadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-sky-500" />
                  <span className="text-2xl font-bold">{formatCurrencyBR(comprasFaturadasTotal)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Programação Semanal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-amber-500" />
                  <span className="text-2xl font-bold">{formatCurrencyBR(programacaoTotal)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="combustivel" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Veículos com Maior Gasto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {topVeiculos.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="rounded-lg bg-slate-100 p-2">
                        <CarFront className="h-4 w-4 text-slate-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">#{index + 1}</p>
                        <p className="truncate font-medium">{item.name}</p>
                      </div>
                    </div>
                    <p className="whitespace-nowrap font-semibold">{formatCurrencyBR(item.value)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumo do Módulo</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Droplets className="h-4 w-4" />
                    Litros Abastecidos
                  </div>
                  <p className="mt-2 text-2xl font-bold">{combustivelLitros.toFixed(1)} L</p>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    Ticket Médio
                  </div>
                  <p className="mt-2 text-2xl font-bold">
                    {formatCurrencyBR(abastecimentosCount > 0 ? combustivelTotal / abastecimentosCount : 0)}
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Fuel className="h-4 w-4" />
                    Abastecimentos
                  </div>
                  <p className="mt-2 text-2xl font-bold">{abastecimentosCount}</p>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BarChart3 className="h-4 w-4" />
                    Veículos com gasto
                  </div>
                  <p className="mt-2 text-2xl font-bold">{topVeiculos.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="operacao" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Itens sem Pedido</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <PackageSearch className="h-4 w-4 text-amber-500" />
                  <span className="text-2xl font-bold">{comprasSemPedidoCount}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Programação sem Responsável</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-sky-500" />
                  <span className="text-2xl font-bold">{programacaoSemResponsavel}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Divergência de Caixa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                  <span className="text-2xl font-bold">{formatCurrencyBR(caixaDiferenca)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Usuários Cadastrados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-500" />
                  <span className="text-2xl font-bold">{usuariosTotal}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
