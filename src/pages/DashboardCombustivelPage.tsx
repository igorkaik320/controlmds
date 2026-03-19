import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Abastecimento,
  VeiculoMaquina,
  TipoCombustivel,
  fetchAbastecimentos,
  fetchVeiculos,
  fetchTiposCombustivel
} from '@/lib/combustivelService';
import { formatCurrencyBR } from '@/lib/comprasService';
import DateRangeFilter from '@/components/DateRangeFilter';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { toast } from 'sonner';
import { Fuel, TrendingUp, Droplets, DollarSign, RotateCcw, Search } from 'lucide-react';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  '#f59e0b',
  '#10b981',
  '#6366f1',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6'
];

type AppliedFilters = {
  dateFrom: string;
  dateTo: string;
  veiculo: string;
  categoria: string;
  combustivel: string;
};

export default function DashboardCombustivelPage() {
  const [items, setItems] = useState<Abastecimento[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoMaquina[]>([]);
  const [combustiveis, setCombustiveis] = useState<TipoCombustivel[]>([]);
  const [loading, setLoading] = useState(true);

  const [draftDateFrom, setDraftDateFrom] = useState('');
  const [draftDateTo, setDraftDateTo] = useState('');
  const [draftVeiculo, setDraftVeiculo] = useState('all');
  const [draftCategoria, setDraftCategoria] = useState('all');
  const [draftCombustivel, setDraftCombustivel] = useState('all');

  const [filters, setFilters] = useState<AppliedFilters>({
    dateFrom: '',
    dateTo: '',
    veiculo: 'all',
    categoria: 'all',
    combustivel: 'all',
  });

  const load = useCallback(async () => {
    try {
      const [abs, veic, comb] = await Promise.all([
        fetchAbastecimentos(),
        fetchVeiculos(),
        fetchTiposCombustivel()
      ]);
      setItems(abs);
      setVeiculos(veic);
      setCombustiveis(comb);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categoriasUnicas = Array.from(
    new Set(
      veiculos
        .map((v) => v.categoria)
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const filtered = items.filter((i) => {
    if (filters.dateFrom && i.data < filters.dateFrom) return false;
    if (filters.dateTo && i.data > filters.dateTo) return false;
    if (filters.veiculo !== 'all' && i.veiculo_id !== filters.veiculo) return false;
    if (filters.combustivel !== 'all' && i.combustivel_id !== filters.combustivel) return false;

    const categoriaItem = i.veiculo?.categoria || '';
    if (filters.categoria !== 'all' && categoriaItem !== filters.categoria) return false;

    return true;
  });

  const totalGasto = filtered.reduce((s, i) => s + i.valor_total, 0);
  const totalLitros = filtered.reduce((s, i) => s + i.quantidade_litros, 0);
  const totalAbast = filtered.length;
  const mediaLitros = totalAbast > 0 ? totalLitros / totalAbast : 0;

  const consumoPorVeiculo = veiculos
    .map((v) => {
      const veicItems = filtered.filter((i) => i.veiculo_id === v.id);
      return {
        name: v.placa || v.modelo || 'Sem identificação',
        litros: veicItems.reduce((s, i) => s + i.quantidade_litros, 0),
        valor: veicItems.reduce((s, i) => s + i.valor_total, 0),
      };
    })
    .filter((v) => v.litros > 0)
    .sort((a, b) => b.valor - a.valor);

  const consumoPorCombustivel = combustiveis
    .map((c) => {
      const combItems = filtered.filter((i) => i.combustivel_id === c.id);
      return {
        name: c.nome,
        litros: combItems.reduce((s, i) => s + i.quantidade_litros, 0),
        valor: combItems.reduce((s, i) => s + i.valor_total, 0),
      };
    })
    .filter((c) => c.litros > 0);

  const consumoPorCategoria = categoriasUnicas
    .map((categoria) => {
      const catItems = filtered.filter((i) => (i.veiculo?.categoria || '') === categoria);
      return {
        name: categoria,
        litros: catItems.reduce((s, i) => s + i.quantidade_litros, 0),
        valor: catItems.reduce((s, i) => s + i.valor_total, 0),
      };
    })
    .filter((c) => c.litros > 0)
    .sort((a, b) => b.valor - a.valor);

  const monthlyMap = new Map<string, { litros: number; valor: number }>();
  for (const item of filtered) {
    const month = item.data.slice(0, 7);
    const cur = monthlyMap.get(month) || { litros: 0, valor: 0 };
    cur.litros += item.quantidade_litros;
    cur.valor += item.valor_total;
    monthlyMap.set(month, cur);
  }

  const evolucaoMensal = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month: month.split('-').reverse().join('/'),
      ...data,
    }));

  function handleConsultar() {
    setFilters({
      dateFrom: draftDateFrom,
      dateTo: draftDateTo,
      veiculo: draftVeiculo,
      categoria: draftCategoria,
      combustivel: draftCombustivel,
    });
  }

  function handleLimpar() {
    setDraftDateFrom('');
    setDraftDateTo('');
    setDraftVeiculo('all');
    setDraftCategoria('all');
    setDraftCombustivel('all');

    setFilters({
      dateFrom: '',
      dateTo: '',
      veiculo: 'all',
      categoria: 'all',
      combustivel: 'all',
    });
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard de Combustível</h2>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <DateRangeFilter
              dateFrom={draftDateFrom}
              dateTo={draftDateTo}
              onDateFromChange={setDraftDateFrom}
              onDateToChange={setDraftDateTo}
            />

            <div>
              <Label className="text-xs">Veículo</Label>
              <Select value={draftVeiculo} onValueChange={setDraftVeiculo}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {veiculos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.placa || v.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={draftCategoria} onValueChange={setDraftCategoria}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categoriasUnicas.map((categoria) => (
                    <SelectItem key={categoria} value={categoria}>
                      {categoria}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Combustível</Label>
              <Select value={draftCombustivel} onValueChange={setDraftCombustivel}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {combustiveis.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleConsultar}>
                <Search className="h-4 w-4 mr-1" />
                Consultar
              </Button>
              <Button variant="outline" onClick={handleLimpar}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gasto</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyBR(totalGasto)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Litros</CardTitle>
            <Droplets className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLitros.toFixed(2)} L</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abastecimentos</CardTitle>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAbast}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média por Abast.</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mediaLitros.toFixed(1)} L</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consumo por Veículo (R$)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consumoPorVeiculo} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `R$ ${v.toLocaleString('pt-BR')}`} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrencyBR(v)} />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por Tipo de Combustível</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={consumoPorCombustivel}
                  dataKey="valor"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {consumoPorCombustivel.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrencyBR(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consumo por Categoria (R$)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consumoPorCategoria}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `R$ ${v.toLocaleString('pt-BR')}`} />
                <Tooltip formatter={(v: number) => formatCurrencyBR(v)} />
                <Bar dataKey="valor" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucaoMensal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" tickFormatter={(v) => `R$ ${v.toLocaleString('pt-BR')}`} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}L`} />
                <Tooltip
                  formatter={(v: number, name: string) =>
                    name === 'valor' ? formatCurrencyBR(v) : `${v.toFixed(2)} L`
                  }
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="valor"
                  name="Valor (R$)"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="litros"
                  name="Litros"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
