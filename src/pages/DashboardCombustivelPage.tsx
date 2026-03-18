import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Abastecimento, VeiculoMaquina, TipoCombustivel, fetchAbastecimentos, fetchVeiculos, fetchTiposCombustivel } from '@/lib/combustivelService';
import { formatCurrencyBR } from '@/lib/comprasService';
import DateRangeFilter from '@/components/DateRangeFilter';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { toast } from 'sonner';
import { Fuel, TrendingUp, Droplets, DollarSign } from 'lucide-react';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', '#f59e0b', '#10b981', '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6'];

export default function DashboardCombustivelPage() {
  const [items, setItems] = useState<Abastecimento[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoMaquina[]>([]);
  const [combustiveis, setCombustiveis] = useState<TipoCombustivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterVeiculo, setFilterVeiculo] = useState('');

  const load = useCallback(async () => {
    try {
      const [abs, veic, comb] = await Promise.all([fetchAbastecimentos(), fetchVeiculos(), fetchTiposCombustivel()]);
      setItems(abs); setVeiculos(veic); setCombustiveis(comb);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(i => {
    if (dateFrom && i.data < dateFrom) return false;
    if (dateTo && i.data > dateTo) return false;
    if (filterVeiculo && i.veiculo_id !== filterVeiculo) return false;
    return true;
  });

  const totalGasto = filtered.reduce((s, i) => s + i.valor_total, 0);
  const totalLitros = filtered.reduce((s, i) => s + i.quantidade_litros, 0);
  const totalAbast = filtered.length;
  const mediaLitros = totalAbast > 0 ? totalLitros / totalAbast : 0;

  // Chart data: consumo por veículo
  const consumoPorVeiculo = veiculos.map(v => {
    const veicItems = filtered.filter(i => i.veiculo_id === v.id);
    return {
      name: `${v.modelo} (${v.placa})`,
      litros: veicItems.reduce((s, i) => s + i.quantidade_litros, 0),
      valor: veicItems.reduce((s, i) => s + i.valor_total, 0),
    };
  }).filter(v => v.litros > 0).sort((a, b) => b.valor - a.valor);

  // Chart data: por tipo de combustível
  const consumoPorCombustivel = combustiveis.map(c => {
    const combItems = filtered.filter(i => i.combustivel_id === c.id);
    return {
      name: c.nome,
      litros: combItems.reduce((s, i) => s + i.quantidade_litros, 0),
      valor: combItems.reduce((s, i) => s + i.valor_total, 0),
    };
  }).filter(c => c.litros > 0);

  // Chart data: evolução mensal
  const monthlyMap = new Map<string, { litros: number; valor: number }>();
  for (const item of filtered) {
    const month = item.data.slice(0, 7); // YYYY-MM
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

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard de Combustível</h2>

      <div className="flex flex-wrap gap-4 items-end">
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} />
        <div>
          <Label className="text-xs">Veículo</Label>
          <Select value={filterVeiculo} onValueChange={setFilterVeiculo}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {veiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.modelo} - {v.placa}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gasto</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrencyBR(totalGasto)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Litros</CardTitle>
            <Droplets className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalLitros.toFixed(2)} L</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abastecimentos</CardTitle>
            <Fuel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalAbast}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média por Abast.</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{mediaLitros.toFixed(1)} L</div></CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Consumo por Veículo (R$)</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consumoPorVeiculo} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={v => `R$ ${v.toLocaleString('pt-BR')}`} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrencyBR(v)} />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Por Tipo de Combustível</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={consumoPorCombustivel} dataKey="valor" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {consumoPorCombustivel.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrencyBR(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Evolução Mensal</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucaoMensal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" tickFormatter={v => `R$ ${v.toLocaleString('pt-BR')}`} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}L`} />
                <Tooltip formatter={(v: number, name: string) => name === 'valor' ? formatCurrencyBR(v) : `${v.toFixed(2)} L`} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="valor" name="Valor (R$)" stroke="hsl(var(--primary))" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="litros" name="Litros" stroke="hsl(var(--destructive))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
