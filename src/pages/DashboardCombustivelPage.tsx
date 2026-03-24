import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Abastecimento,
  VeiculoMaquina,
  TipoCombustivel,
  PostoCombustivel,
  fetchAbastecimentos,
  fetchVeiculos,
  fetchTiposCombustivel,
  fetchPostosCombustivel,
} from '@/lib/combustivelService';
import { formatCurrencyBR, fetchResponsaveis, Responsavel } from '@/lib/comprasService';
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
  Line,
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
  '#14b8a6',
];

type AppliedFilters = {
  dateFrom: string;
  dateTo: string;
  veiculo: string;
  obra: string;
  posto: string;
  combustivel: string;
  responsavel: string;
};

export default function DashboardCombustivelPage() {
  const [items, setItems] = useState<Abastecimento[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoMaquina[]>([]);
  const [combustiveis, setCombustiveis] = useState<TipoCombustivel[]>([]);
  const [postos, setPostos] = useState<PostoCombustivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);

  const [draftDateFrom, setDraftDateFrom] = useState('');
  const [draftDateTo, setDraftDateTo] = useState('');
  const [draftVeiculo, setDraftVeiculo] = useState('all');
  const [draftObra, setDraftObra] = useState('all');
  const [draftPosto, setDraftPosto] = useState('all');
  const [draftResponsavel, setDraftResponsavel] = useState('all');

  const [filters, setFilters] = useState<AppliedFilters>({
    dateFrom: '',
    dateTo: '',
    veiculo: 'all',
    obra: 'all',
    posto: 'all',
    combustivel: 'all',
    responsavel: 'all',
  });

  const load = useCallback(async () => {
    try {
      const [abs, veic, comb, postosData, responsaveisData] = await Promise.all([
        fetchAbastecimentos(),
        fetchVeiculos(),
        fetchTiposCombustivel(),
        fetchPostosCombustivel(),
        fetchResponsaveis(),
      ]);
      setItems(abs);
      setVeiculos(veic);
      setCombustiveis(comb);
      setPostos(postosData);
      setResponsaveis(responsaveisData);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const obrasComAbastecimento = items
    .filter((item) => item.obra_id && item.obra?.nome)
    .reduce((acc, item) => {
      if (!acc.some((obra) => obra.id === item.obra_id)) {
        acc.push({ id: item.obra_id as string, nome: item.obra?.nome as string });
      }
      return acc;
    }, [] as Array<{ id: string; nome: string }>)
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const filtered = items.filter((item) => {
    if (filters.dateFrom && item.data < filters.dateFrom) return false;
    if (filters.dateTo && item.data > filters.dateTo) return false;
    if (filters.veiculo !== 'all' && item.veiculo_id !== filters.veiculo) return false;
    if (filters.obra !== 'all' && (item.obra_id || '') !== filters.obra) return false;
    if (filters.posto !== 'all' && (item.posto_id || '') !== filters.posto) return false;
    if (filters.combustivel !== 'all' && item.combustivel_id !== filters.combustivel) return false;
    const itemResponsavelId = item.responsavel_id || item.veiculo?.responsavel_id || '';
    if (filters.responsavel !== 'all' && itemResponsavelId !== filters.responsavel) return false;
    return true;
  });

  const totalGasto = filtered.reduce((sum, item) => sum + item.valor_total, 0);
  const totalLitros = filtered.reduce((sum, item) => sum + item.quantidade_litros, 0);
  const totalAbast = filtered.length;
  const mediaLitros = totalAbast > 0 ? totalLitros / totalAbast : 0;

  const consumoPorVeiculo = veiculos
    .map((veiculo) => {
      const veicItems = filtered.filter((item) => item.veiculo_id === veiculo.id);
      return {
        name: veiculo.placa || veiculo.modelo || 'Sem identificacao',
        litros: veicItems.reduce((sum, item) => sum + item.quantidade_litros, 0),
        valor: veicItems.reduce((sum, item) => sum + item.valor_total, 0),
      };
    })
    .filter((veiculo) => veiculo.litros > 0)
    .sort((a, b) => b.valor - a.valor);

  const consumoPorCombustivel = combustiveis
    .map((combustivel) => {
      const combItems = filtered.filter((item) => item.combustivel_id === combustivel.id);
      return {
        name: combustivel.nome,
        litros: combItems.reduce((sum, item) => sum + item.quantidade_litros, 0),
        valor: combItems.reduce((sum, item) => sum + item.valor_total, 0),
      };
    })
    .filter((combustivel) => combustivel.litros > 0);

  const consumoPorObra = obrasComAbastecimento
    .map((obra) => {
      const obraItems = filtered.filter((item) => item.obra_id === obra.id);
      return {
        name: obra.nome,
        litros: obraItems.reduce((sum, item) => sum + item.quantidade_litros, 0),
        valor: obraItems.reduce((sum, item) => sum + item.valor_total, 0),
      };
    })
    .filter((obra) => obra.litros > 0)
    .sort((a, b) => b.valor - a.valor);

  const consumoPorPosto = postos
    .map((posto) => {
      const postoItems = filtered.filter((item) => item.posto_id === posto.id);
      return {
        name: posto.nome,
        litros: postoItems.reduce((sum, item) => sum + item.quantidade_litros, 0),
        valor: postoItems.reduce((sum, item) => sum + item.valor_total, 0),
      };
    })
    .filter((posto) => posto.litros > 0)
    .sort((a, b) => b.valor - a.valor);

  const monthlyMap = new Map<string, { litros: number; valor: number }>();
  for (const item of filtered) {
    const month = item.data.slice(0, 7);
    const current = monthlyMap.get(month) || { litros: 0, valor: 0 };
    current.litros += item.quantidade_litros;
    current.valor += item.valor_total;
    monthlyMap.set(month, current);
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
      obra: draftObra,
      posto: draftPosto,
      combustivel: 'all',
      responsavel: draftResponsavel,
    });
  }

  function handleLimpar() {
    setDraftDateFrom('');
    setDraftDateTo('');
    setDraftVeiculo('all');
    setDraftObra('all');
    setDraftPosto('all');
    setDraftResponsavel('all');

    setFilters({
      dateFrom: '',
      dateTo: '',
      veiculo: 'all',
      obra: 'all',
      posto: 'all',
      combustivel: 'all',
      responsavel: 'all',
    });
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard de Combustivel</h2>
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
              <Label className="text-xs">Veiculo</Label>
              <Select value={draftVeiculo} onValueChange={setDraftVeiculo}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {veiculos.map((veiculo) => (
                    <SelectItem key={veiculo.id} value={veiculo.id}>
                      {veiculo.placa || veiculo.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Obra</Label>
              <Select value={draftObra} onValueChange={setDraftObra}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {obrasComAbastecimento.map((obra) => (
                    <SelectItem key={obra.id} value={obra.id}>
                      {obra.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Posto</Label>
              <Select value={draftPosto} onValueChange={setDraftPosto}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {postos.map((posto) => (
                    <SelectItem key={posto.id} value={posto.id}>
                      {posto.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Responsável</Label>
              <Select value={draftResponsavel} onValueChange={setDraftResponsavel}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {responsaveis.map((resp) => (
                    <SelectItem key={resp.id} value={resp.id}>
                      {resp.nome}
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
            <CardTitle className="text-sm font-medium">Media por Abast.</CardTitle>
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
            <CardTitle className="text-base">Consumo por Veiculo (R$)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consumoPorVeiculo} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => formatCurrencyBR(value)} />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por Tipo de Combustivel</CardTitle>
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
                  {consumoPorCombustivel.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrencyBR(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consumo por Obra (R$)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consumoPorObra}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
                <Tooltip formatter={(value) => formatCurrencyBR(value)} />
                <Bar dataKey="valor" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consumo por Posto (R$)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consumoPorPosto}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
                <Tooltip formatter={(value) => formatCurrencyBR(value)} />
                <Bar dataKey="valor" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Evolucao Mensal</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucaoMensal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value}L`} />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === 'valor' ? formatCurrencyBR(value) : `${value.toFixed(2)} L`
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
