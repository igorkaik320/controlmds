import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, FileSpreadsheet, Search, RotateCcw } from 'lucide-react';
import {
  fetchComprasAvista,
  fetchComprasFaturadas,
  fetchFornecedores,
  fetchConfigRelatorio,
  buildEspelho,
  formatCurrencyBR,
  formatDateBR,
  EspelhoItem,
} from '@/lib/comprasService';
import { exportEspelhoPDF, exportEspelhoXLSX } from '@/lib/comprasExport';
import { fetchObras } from '@/lib/obrasService';
import { fetchEmpresas } from '@/lib/empresasService';
import EmpresaSelect from '@/components/compras/EmpresaSelect';
import DateRangeFilter from '@/components/DateRangeFilter';
import { useFormDraft } from '@/hooks/useFormDraft';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { toast } from 'sonner';

type FonteDados = 'avista' | 'faturadas' | 'ambos';

type Filtros = {
  dateFrom: string;
  dateTo: string;
  fonte: FonteDados;
  empresa: string;
};

export default function EspelhoGeralPage() {
  const [items, setItems] = useState<EspelhoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { canExport } = useModulePermissions();

  const [draftDateFrom, setDraftDateFrom] = useFormDraft('espelho-dateFrom', '');
  const [draftDateTo, setDraftDateTo] = useFormDraft('espelho-dateTo', '');
  const [draftFonte, setDraftFonte] = useFormDraft<FonteDados>('espelho-fonte', 'ambos');
  const [draftEmpresa, setDraftEmpresa] = useFormDraft('espelho-empresa', '');
  const [observation, setObservation] = useFormDraft('espelho-obs', '');

  const [dateFrom, setDateFrom] = useState(draftDateFrom);
  const [dateTo, setDateTo] = useState(draftDateTo);
  const [fonte, setFonte] = useState<FonteDados>(draftFonte);
  const [empresa, setEmpresa] = useState(draftEmpresa);

  const [appliedFilters, setAppliedFilters] = useState<Filtros>({
    dateFrom: draftDateFrom,
    dateTo: draftDateTo,
    fonte: draftFonte,
    empresa: draftEmpresa,
  });

  const [totalAvista, setTotalAvista] = useState(0);
  const [totalFaturadas, setTotalFaturadas] = useState(0);
  const [totalComPedidoFat, setTotalComPedidoFat] = useState(0);
  const [totalSemPedidoFat, setTotalSemPedidoFat] = useState(0);
  const [totalComPedidoAv, setTotalComPedidoAv] = useState(0);
  const [totalSemPedidoAv, setTotalSemPedidoAv] = useState(0);
  const [empresaLogos, setEmpresaLogos] = useState<{ logo_esquerda: string | null; logo_direita: string | null }>({
    logo_esquerda: null,
    logo_direita: null,
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const [comprasAv, comprasFat, fornecedores, obras, empresasData] = await Promise.all([
        fetchComprasAvista(),
        fetchComprasFaturadas(),
        fetchFornecedores(),
        fetchObras(),
        fetchEmpresas(),
      ]);

      let allowedObras: Set<string> | null = null;

      if (appliedFilters.empresa) {
        allowedObras = new Set(
          obras
            .filter((o) => o.empresa_id === appliedFilters.empresa)
            .map((o) => o.nome.toLowerCase())
        );

        const empresaSelecionada = empresasData.find((e) => e.id === appliedFilters.empresa);
        if (empresaSelecionada) {
          setEmpresaLogos({
            logo_esquerda: empresaSelecionada.logo_esquerda,
            logo_direita: empresaSelecionada.logo_direita,
          });
        } else {
          setEmpresaLogos({ logo_esquerda: null, logo_direita: null });
        }
      } else {
        setEmpresaLogos({ logo_esquerda: null, logo_direita: null });
      }

      const filterByEmpresa = (c: any) =>
        !allowedObras || (c.obra && allowedObras.has(c.obra.toLowerCase()));

      const filterByPeriodo = (c: any) => {
        if (appliedFilters.dateFrom && c.data < appliedFilters.dateFrom) return false;
        if (appliedFilters.dateTo && c.data > appliedFilters.dateTo) return false;
        return true;
      };

      const avFiltered = comprasAv.filter(filterByPeriodo).filter(filterByEmpresa);
      const fatFiltered = comprasFat.filter(filterByPeriodo).filter(filterByEmpresa);

      let comprasParaEspelho: any[] = [];
      if (appliedFilters.fonte === 'avista' || appliedFilters.fonte === 'ambos') {
        comprasParaEspelho = [...comprasParaEspelho, ...avFiltered];
      }
      if (appliedFilters.fonte === 'faturadas' || appliedFilters.fonte === 'ambos') {
        comprasParaEspelho = [...comprasParaEspelho, ...fatFiltered];
      }

      setItems(buildEspelho(comprasParaEspelho, fornecedores));

      const avTotal = avFiltered.reduce((s, c) => s + c.valor, 0);
      const fatTotal = fatFiltered.reduce((s, c) => s + c.valor, 0);

      setTotalAvista(avTotal);
      setTotalFaturadas(fatTotal);
      setTotalComPedidoFat(fatFiltered.filter((c) => c.pedido?.trim()).reduce((s, c) => s + c.valor, 0));
      setTotalSemPedidoFat(fatFiltered.filter((c) => !c.pedido?.trim()).reduce((s, c) => s + c.valor, 0));
      setTotalComPedidoAv(avFiltered.filter((c) => c.pedido?.trim()).reduce((s, c) => s + c.valor, 0));
      setTotalSemPedidoAv(avFiltered.filter((c) => !c.pedido?.trim()).reduce((s, c) => s + c.valor, 0));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    load();
  }, [load]);

  const totalGeral = items.reduce((s, i) => s + i.valor_por_obra, 0);

  function formatPeriodoLabel() {
    if (appliedFilters.dateFrom && appliedFilters.dateTo) {
      return `${formatDateBR(appliedFilters.dateFrom)} a ${formatDateBR(appliedFilters.dateTo)}`;
    }
    if (appliedFilters.dateFrom) return `A partir de ${formatDateBR(appliedFilters.dateFrom)}`;
    if (appliedFilters.dateTo) return `Até ${formatDateBR(appliedFilters.dateTo)}`;
    return 'Todos os períodos';
  }

  function handleConsultar() {
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
    setDraftFonte(fonte);
    setDraftEmpresa(empresa);

    setAppliedFilters({
      dateFrom,
      dateTo,
      fonte,
      empresa,
    });
  }

  function handleLimpar() {
    setDateFrom('');
    setDateTo('');
    setFonte('ambos');
    setEmpresa('');

    setDraftDateFrom('');
    setDraftDateTo('');
    setDraftFonte('ambos');
    setDraftEmpresa('');

    setAppliedFilters({
      dateFrom: '',
      dateTo: '',
      fonte: 'ambos',
      empresa: '',
    });
  }

  async function handleExportPDF() {
    let config = await fetchConfigRelatorio();

    if (appliedFilters.empresa && config) {
      const empresas = await fetchEmpresas();
      const empresaSelecionada = empresas.find((e) => e.id === appliedFilters.empresa);

      if (empresaSelecionada) {
        config = {
          ...config,
          logo_esquerda: empresaSelecionada.logo_esquerda || config.logo_esquerda || null,
          logo_direita: empresaSelecionada.logo_direita || config.logo_direita || null,
          cor_cabecalho: empresaSelecionada.cor_cabecalho || config.cor_cabecalho || '#6b7280',
        };
      }
    }

    exportEspelhoPDF(items, formatPeriodoLabel(), config, observation);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  const groupedRows: { item: EspelhoItem; isFirst: boolean; groupSize: number }[] = [];
  let idx = 0;

  while (idx < items.length) {
    const forn = items[idx].fornecedor;
    let j = idx;

    while (j < items.length && items[j].fornecedor === forn) {
      j++;
    }

    const size = j - idx;

    for (let k = idx; k < j; k++) {
      groupedRows.push({
        item: items[k],
        isFirst: k === idx,
        groupSize: size,
      });
    }

    idx = j;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Espelho Geral</h2>
          <p className="text-sm text-muted-foreground">
            Resumo automático das compras agrupado por fornecedor/obra
          </p>
        </div>

        <div className="flex gap-2">
          {canExport('espelho_geral') && (
            <>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <FileDown className="mr-1 h-4 w-4" />
                PDF
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => exportEspelhoXLSX(items, formatPeriodoLabel(), observation)}
              >
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                Excel
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">Fonte dos Dados</Label>
            <Select value={fonte} onValueChange={(v: FonteDados) => setFonte(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ambos">Ambos (À Vista + Faturadas)</SelectItem>
                <SelectItem value="avista">Somente Compras à Vista</SelectItem>
                <SelectItem value="faturadas">Somente Compras Faturadas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <EmpresaSelect value={empresa} onChange={setEmpresa} label="Empresa" allowAll />
          </div>
        </div>

        <div>
          <Label className="text-xs">Observação do relatório</Label>
          <Textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            rows={2}
            placeholder="Observação para o relatório..."
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Período consultado: <span className="font-medium">{formatPeriodoLabel()}</span>
          </div>

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
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Geral</p>
            <p className="text-xl font-bold">{formatCurrencyBR(totalAvista + totalFaturadas)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Compras à Vista</p>
            <p className="text-xl font-bold">{formatCurrencyBR(totalAvista)}</p>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Com Pedido: {formatCurrencyBR(totalComPedidoAv)}</span>
              <span>Sem Pedido: {formatCurrencyBR(totalSemPedidoAv)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Compras Faturadas</p>
            <p className="text-xl font-bold">{formatCurrencyBR(totalFaturadas)}</p>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Com Pedido: {formatCurrencyBR(totalComPedidoFat)}</span>
              <span>Sem Pedido: {formatCurrencyBR(totalSemPedidoFat)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Razão Social</TableHead>
              <TableHead>Banco</TableHead>
              <TableHead>Agência</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Nº Pedido</TableHead>
              <TableHead className="text-right">Valor por Obra</TableHead>
              <TableHead className="text-right">Total Fornecedor</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {groupedRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  Nenhum dado para o período consultado
                </TableCell>
              </TableRow>
            )}

            {groupedRows.map((row, rIdx) => (
              <TableRow key={rIdx}>
                {row.isFirst && (
                  <>
                    <TableCell rowSpan={row.groupSize} className="align-middle text-center">
                      {row.item.item}
                    </TableCell>
                    <TableCell rowSpan={row.groupSize} className="align-middle font-medium">
                      {row.item.fornecedor}
                    </TableCell>
                    <TableCell rowSpan={row.groupSize} className="align-middle">
                      {row.item.razao_social}
                    </TableCell>
                    <TableCell rowSpan={row.groupSize} className="align-middle text-center">
                      {row.item.banco}
                    </TableCell>
                    <TableCell rowSpan={row.groupSize} className="align-middle text-center">
                      {row.item.agencia}
                    </TableCell>
                    <TableCell rowSpan={row.groupSize} className="align-middle">
                      {row.item.conta}
                    </TableCell>
                  </>
                )}

                <TableCell>{row.item.obra}</TableCell>
                <TableCell className="text-center">{row.item.pedido}</TableCell>
                <TableCell className="text-right">{formatCurrencyBR(row.item.valor_por_obra)}</TableCell>

                {row.isFirst && (
                  <TableCell rowSpan={row.groupSize} className="align-middle text-right font-bold">
                    {formatCurrencyBR(row.item.total_fornecedor)}
                  </TableCell>
                )}
              </TableRow>
            ))}

            {items.length > 0 && (
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={8} className="text-right">
                  TOTAL GERAL
                </TableCell>
                <TableCell className="text-right">{formatCurrencyBR(totalGeral)}</TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
