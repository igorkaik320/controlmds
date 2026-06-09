import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CalendarClock, CircleDollarSign, FileBarChart, RotateCcw, Search, TrendingUp, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EmpresaSelect from '@/components/compras/EmpresaSelect';
import { fetchContasPagar, ContaPagarComParcelas, ContaPagarParcela } from '@/lib/contasPagarService';
import { fetchProgramacaoSemanal, ProgramacaoSemanal } from '@/lib/comprasService';
import { fetchObras, Obra } from '@/lib/obrasService';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, string> = {
  aberta: 'Aberta',
  paga: 'Paga',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  aberta: '#2563eb',
  paga: '#16a34a',
  vencida: '#dc2626',
  cancelada: '#64748b',
};

const CHART_COLORS = ['#0f172a', '#2563eb', '#f97316', '#16a34a', '#9333ea', '#0891b2', '#be123c', '#ca8a04'];

const PROGRAMACAO_STATUS_COLORS: Record<string, string> = {
  aberta: '#2563eb',
  paga: '#16a34a',
  vencida: '#dc2626',
};

type DashboardParcela = ContaPagarParcela & {
  conta: ContaPagarComParcelas;
};

type ChartItem = DashboardParcela & {
  value: number;
};

type ChartGroup = {
  name: string;
  value: number;
  filterValue: string;
};

type ProgramacaoStatusChartItem = {
  name: string;
  value: number;
  filterValue: string;
  color: string;
};

function monthLabel(date: string) {
  const [year, month] = date.split('-');
  return `${month}/${year.slice(2)}`;
}

function monthEndDate(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return '';
  return new Date(year, month, 0).toISOString().slice(0, 10);
}

function compactCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function normalizeLookupText(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getProgramacaoStatus(item: ProgramacaoSemanal) {
  const itemStatus = item.status || 'aberta';
  if (itemStatus === 'aberta' && item.data && item.data < todayISO()) return 'vencida';
  return itemStatus;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey || entry.name} className="text-muted-foreground">
          <span style={{ color: entry.color }}>●</span> {entry.name}: {formatCurrency(Number(entry.value) || 0)}
        </p>
      ))}
      <p className="mt-1 text-[11px] text-muted-foreground">Clique para ver os lançamentos</p>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone = 'default',
}: {
  title: string;
  value: string;
  description: string;
  icon: any;
  tone?: 'default' | 'blue' | 'red' | 'green';
}) {
  return (
    <Card className="rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground',
            tone === 'blue' && 'bg-primary/10 text-primary',
            tone === 'red' && 'bg-destructive/10 text-destructive',
            tone === 'green' && 'bg-success/10 text-success'
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function aggregateBy(
  items: ChartItem[],
  getName: (item: ChartItem) => string,
  getFilterValue: (item: ChartItem) => string,
  limit = 8
): ChartGroup[] {
  const map = new Map<string, ChartGroup>();

  items.forEach((item) => {
    const name = getName(item) || 'Sem informação';
    const filterValue = getFilterValue(item) || name;
    const current = map.get(filterValue) || { name, value: 0, filterValue };
    current.value += item.value;
    map.set(filterValue, current);
  });

  return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, limit);
}

export default function ContasPagarDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ContaPagarComParcelas[]>([]);
  const [programacaoItems, setProgramacaoItems] = useState<ProgramacaoSemanal[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);

  const [draftDateFrom, setDraftDateFrom] = useState('');
  const [draftDateTo, setDraftDateTo] = useState('');
  const [draftEmpresa, setDraftEmpresa] = useState('');
  const [draftStatus, setDraftStatus] = useState('todos');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [status, setStatus] = useState('todos');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [contas, programacao, obrasData] = await Promise.all([
        fetchContasPagar(),
        fetchProgramacaoSemanal(),
        fetchObras(),
      ]);
      setItems(contas);
      setProgramacaoItems(programacao);
      setObras(obrasData);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const parcelas = useMemo<DashboardParcela[]>(() => {
    return items
      .flatMap((conta) =>
        (conta.parcelas || []).map((parcela) => ({
          ...parcela,
          conta,
        }))
      )
      .filter((parcela) => {
        if (!parcela.data_vencimento) return false;
        if (dateFrom && parcela.data_vencimento < dateFrom) return false;
        if (dateTo && parcela.data_vencimento > dateTo) return false;
        if (empresa && parcela.conta.empresa_id !== empresa) return false;
        if (status !== 'todos' && parcela.status !== status) return false;
        return true;
      });
  }, [items, dateFrom, dateTo, empresa, status]);

  const payableParcelas = useMemo(() => parcelas.filter((parcela) => parcela.status !== 'cancelada'), [parcelas]);

  const metrics = useMemo(() => {
    const total = payableParcelas.reduce((sum, parcela) => sum + Number(parcela.valor_parcela || 0), 0);
    const aberto = payableParcelas
      .filter((parcela) => parcela.status === 'aberta' || parcela.status === 'vencida')
      .reduce((sum, parcela) => sum + Number(parcela.valor_parcela || 0), 0);
    const pago = payableParcelas
      .filter((parcela) => parcela.status === 'paga')
      .reduce((sum, parcela) => sum + Number(parcela.valor_parcela || 0), 0);
    const vencido = payableParcelas
      .filter((parcela) => parcela.status === 'vencida')
      .reduce((sum, parcela) => sum + Number(parcela.valor_parcela || 0), 0);

    return { total, aberto, pago, vencido, count: payableParcelas.length };
  }, [payableParcelas]);

  const chartItems = useMemo<ChartItem[]>(() => {
    return payableParcelas.map((parcela) => ({
      ...parcela,
      value: Number(parcela.valor_parcela || 0),
    }));
  }, [payableParcelas]);

  const topFornecedores = useMemo(
    () =>
      aggregateBy(
        chartItems,
        (parcela) => parcela.conta.fornecedor_nome || 'Sem fornecedor',
        (parcela) => parcela.conta.fornecedor_nome || 'Sem fornecedor'
      ),
    [chartItems]
  );

  const topCategorias = useMemo(
    () =>
      aggregateBy(
        chartItems,
        (parcela) =>
          parcela.conta.categoria_codigo
            ? `${parcela.conta.categoria_codigo} - ${parcela.conta.categoria_nome || 'Sem descrição'}`
            : parcela.conta.categoria_nome || 'Sem categoria',
        (parcela) => parcela.conta.categoria_financeira_id || parcela.conta.categoria_nome || 'Sem categoria'
      ),
    [chartItems]
  );

  const topTags = useMemo(
    () =>
      aggregateBy(
        chartItems,
        (parcela) => parcela.conta.tag_nome || 'Sem tag',
        (parcela) => parcela.conta.tag_id || parcela.conta.tag_nome || 'Sem tag'
      ),
    [chartItems]
  );

  const evolucaoMensal = useMemo(() => {
    const map = new Map<string, { key: string; month: string; previsto: number; pago: number; vencido: number }>();

    chartItems.forEach((parcela) => {
      const key = parcela.data_vencimento.slice(0, 7);
      const current = map.get(key) || { key, month: monthLabel(parcela.data_vencimento), previsto: 0, pago: 0, vencido: 0 };
      current.previsto += parcela.value;
      if (parcela.status === 'paga') current.pago += parcela.value;
      if (parcela.status === 'vencida') current.vencido += parcela.value;
      map.set(key, current);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value);
  }, [chartItems]);

  const porStatus = useMemo(() => {
    const map = new Map<string, number>();
    chartItems.forEach((parcela) => {
      map.set(parcela.status, (map.get(parcela.status) || 0) + parcela.value);
    });
    return Array.from(map.entries()).map(([key, value]) => ({
      name: STATUS_LABELS[key] || key,
      value,
      filterValue: key,
      color: STATUS_COLORS[key] || '#64748b',
    }));
  }, [chartItems]);

  const programacaoPorStatus = useMemo<ProgramacaoStatusChartItem[]>(() => {
    const obrasPorNome = new Map(
      obras.map((obra) => [normalizeLookupText(obra.nome), obra])
    );

    const totals = new Map<string, number>([
      ['aberta', 0],
      ['paga', 0],
      ['vencida', 0],
    ]);

    programacaoItems.forEach((item) => {
      if (!item.data) return;
      if (dateFrom && item.data < dateFrom) return;
      if (dateTo && item.data > dateTo) return;

      if (empresa) {
        const obra = obrasPorNome.get(normalizeLookupText(item.obra));
        if (obra?.empresa_id !== empresa) return;
      }

      const statusValue = getProgramacaoStatus(item);
      if (!totals.has(statusValue)) return;
      totals.set(statusValue, (totals.get(statusValue) || 0) + Number(item.valor || 0));
    });

    return [
      { name: 'Aberto', filterValue: 'aberta', value: totals.get('aberta') || 0, color: PROGRAMACAO_STATUS_COLORS.aberta },
      { name: 'Pago', filterValue: 'paga', value: totals.get('paga') || 0, color: PROGRAMACAO_STATUS_COLORS.paga },
      { name: 'Vencido', filterValue: 'vencida', value: totals.get('vencida') || 0, color: PROGRAMACAO_STATUS_COLORS.vencida },
    ].filter((item) => item.value > 0);
  }, [programacaoItems, obras, dateFrom, dateTo, empresa]);

  function handleConsultar() {
    setDateFrom(draftDateFrom);
    setDateTo(draftDateTo);
    setEmpresa(draftEmpresa);
    setStatus(draftStatus);
  }

  function handleLimpar() {
    setDraftDateFrom('');
    setDraftDateTo('');
    setDraftEmpresa('');
    setDraftStatus('todos');
    setDateFrom('');
    setDateTo('');
    setEmpresa('');
    setStatus('todos');
  }

  function goToLancamentos(type: 'fornecedor' | 'categoria' | 'tag' | 'status', payload: any) {
    if (!payload) return;
    const drillStatuses = type === 'status'
      ? [payload.filterValue || payload.name]
      : status === 'todos'
        ? []
        : [status];

    navigate('/contas-pagar', {
      state: {
        dashboardFilter: {
          type,
          value: payload.filterValue || payload.name,
          label: payload.name,
        },
        filters: {
          dateFrom,
          dateTo,
          empresa,
          statuses: drillStatuses,
        },
      },
    });
  }

  function goToMonth(payload: any) {
    if (!payload?.key) return;

    navigate('/contas-pagar', {
      state: {
        dashboardFilter: {
          type: 'mes',
          value: payload.key,
          label: payload.month,
        },
        filters: {
          dateFrom: `${payload.key}-01`,
          dateTo: monthEndDate(payload.key),
          empresa,
          statuses: status === 'todos' ? [] : [status],
        },
      },
    });
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">Carregando dashboard...</div>;
  }

  return (
    <div className="space-y-5 text-[13px] text-foreground">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Contas a Pagar</h1>
          <p className="text-sm text-muted-foreground">Visão analítica por fornecedores, categorias, tags, status e evolução mensal.</p>
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-2" onClick={load}>
          <RotateCcw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <Card className="rounded-lg p-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[180px_180px_260px_180px_auto_auto]">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">De</Label>
            <Input className="h-9 bg-card text-sm" type="date" value={draftDateFrom} onChange={(event) => setDraftDateFrom(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Até</Label>
            <Input className="h-9 bg-card text-sm" type="date" value={draftDateTo} onChange={(event) => setDraftDateTo(event.target.value)} />
          </div>
          <EmpresaSelect
            value={draftEmpresa}
            onChange={setDraftEmpresa}
            label="Empresa"
            labelClassName="font-medium text-muted-foreground"
            triggerClassName="h-9 border-input bg-card text-sm shadow-none"
            allowAll
          />
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Status</Label>
            <Select value={draftStatus} onValueChange={setDraftStatus}>
              <SelectTrigger className="h-9 border-input bg-card text-sm shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="aberta">Aberta</SelectItem>
                <SelectItem value="paga">Paga</SelectItem>
                <SelectItem value="vencida">Vencida</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="h-9 w-full gap-2" onClick={handleConsultar}>
              <Search className="h-4 w-4" />
              Consultar
            </Button>
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="h-9 w-full gap-2" onClick={handleLimpar}>
              <RotateCcw className="h-4 w-4" />
              Limpar
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total previsto" value={formatCurrency(metrics.total)} description={`${metrics.count} parcela(s) no filtro`} icon={CircleDollarSign} tone="blue" />
        <StatCard title="Em aberto" value={formatCurrency(metrics.aberto)} description="Abertas e vencidas" icon={CalendarClock} />
        <StatCard title="Pago" value={formatCurrency(metrics.pago)} description="Parcelas baixadas" icon={TrendingUp} tone="green" />
        <StatCard title="Vencido" value={formatCurrency(metrics.vencido)} description="Pendências vencidas" icon={AlertTriangle} tone="red" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <Card className="rounded-lg p-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold">Evolução de Gastos</h3>
            <p className="text-xs text-muted-foreground">Clique no mês para abrir os lançamentos.</p>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={evolucaoMensal}
                margin={{ left: 4, right: 16, top: 8, bottom: 8 }}
                onClick={(data: any) => goToMonth(data?.activePayload?.[0]?.payload)}
                className="cursor-pointer"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tickFormatter={compactCurrency} tick={{ fontSize: 11, fill: '#64748b' }} width={72} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="previsto" name="Previsto" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pago" name="Pago" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="vencido" name="Vencido" stroke="#dc2626" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-lg p-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold">Composição por Status</h3>
            <p className="text-xs text-muted-foreground">Clique em uma fatia para abrir os lançamentos.</p>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={porStatus}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={64}
                  outerRadius={104}
                  paddingAngle={2}
                  onClick={(entry) => goToLancamentos('status', entry)}
                  className="cursor-pointer"
                >
                  {porStatus.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-lg p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Top Fornecedores</h3>
              <p className="text-xs text-muted-foreground">Clique em um fornecedor para abrir os lançamentos.</p>
            </div>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topFornecedores} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={compactCurrency} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fill: '#334155' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Valor" radius={[0, 4, 4, 0]} fill="#2563eb" onClick={(entry) => goToLancamentos('fornecedor', entry)} className="cursor-pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-lg p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Por Categorias</h3>
              <p className="text-xs text-muted-foreground">Clique em uma categoria para abrir os lançamentos.</p>
            </div>
            <FileBarChart className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCategorias} margin={{ left: 4, right: 16, top: 8, bottom: 56 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" angle={-28} textAnchor="end" interval={0} height={72} tick={{ fontSize: 10, fill: '#334155' }} />
                <YAxis tickFormatter={compactCurrency} tick={{ fontSize: 11, fill: '#64748b' }} width={72} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Valor" radius={[4, 4, 0, 0]} onClick={(entry) => goToLancamentos('categoria', entry)} className="cursor-pointer">
                  {topCategorias.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-lg p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Por Tags</h3>
              <p className="text-xs text-muted-foreground">Clique em uma tag para abrir os lançamentos.</p>
            </div>
            <FileBarChart className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTags} margin={{ left: 4, right: 16, top: 8, bottom: 56 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" angle={-28} textAnchor="end" interval={0} height={72} tick={{ fontSize: 10, fill: '#334155' }} />
                <YAxis tickFormatter={compactCurrency} tick={{ fontSize: 11, fill: '#64748b' }} width={72} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Valor" radius={[4, 4, 0, 0]} onClick={(entry) => goToLancamentos('tag', entry)} className="cursor-pointer">
                  {topTags.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-lg p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Programação Semanal</h3>
              <p className="text-xs text-muted-foreground">Aberto, pago e vencido no período filtrado.</p>
            </div>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-[320px]">
            {programacaoPorStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={programacaoPorStatus} margin={{ left: 4, right: 16, top: 8, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#334155' }} />
                  <YAxis tickFormatter={compactCurrency} tick={{ fontSize: 11, fill: '#64748b' }} width={72} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Valor" radius={[4, 4, 0, 0]}>
                    {programacaoPorStatus.map((entry) => (
                      <Cell key={entry.filterValue} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                Nenhum valor de programação semanal no filtro atual.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
