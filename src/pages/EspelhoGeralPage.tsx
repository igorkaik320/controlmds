import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
import ObraSelect from '@/components/compras/ObraSelect';
import DateRangeFilter from '@/components/DateRangeFilter';
import { useFormDraft } from '@/hooks/useFormDraft';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';

type FonteDados = 'avista' | 'faturadas' | 'ambos';

type Filtros = {
  dateFrom: string;
  dateTo: string;
  fonte: FonteDados;
  empresa: string;
  obra: string;
  semPedidoOnly: boolean;
};

function parseFonteParam(value: string | null): FonteDados | undefined {
  if (value === 'avista' || value === 'faturadas' || value === 'ambos') {
    return value;
  }
  return undefined;
}

export default function EspelhoGeralPage() {
  const [items, setItems] = useState<EspelhoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { canExport } = useModulePermissions();

  const [searchParams] = useSearchParams();
  const searchDateFrom = searchParams.get('dateFrom') ?? '';
  const searchDateTo = searchParams.get('dateTo') ?? '';
  const searchFonteValue = parseFonteParam(searchParams.get('fonte'));
  const searchEmpresa = searchParams.get('empresa') ?? '';
  const searchObra = searchParams.get('obra') ?? '';
  const searchSemPedido = searchParams.get('semPedido') === '1';

  const [draftDateFrom, setDraftDateFrom] = useFormDraft('espelho-dateFrom', '');
  const [draftDateTo, setDraftDateTo] = useFormDraft('espelho-dateTo', '');
  const [draftFonte, setDraftFonte] = useFormDraft<FonteDados>('espelho-fonte', 'ambos');
  const [draftEmpresa, setDraftEmpresa] = useFormDraft('espelho-empresa', '');
  const [draftObra, setDraftObra] = useFormDraft('espelho-obra', '');
  const [observation, setObservation] = useFormDraft('espelho-obs', '');

  const initialDateFrom = searchDateFrom || draftDateFrom;
  const initialDateTo = searchDateTo || draftDateTo;
  const initialFonte = searchFonteValue ?? draftFonte;
  const initialEmpresa = searchEmpresa || draftEmpresa;
  const initialObra = searchObra || draftObra;

  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [fonte, setFonte] = useState<FonteDados>(initialFonte);
  const [empresa, setEmpresa] = useState(initialEmpresa);
  const [obra, setObra] = useState(initialObra);
  const [semPedidoOnly, setSemPedidoOnly] = useState(searchSemPedido);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [appliedFilters, setAppliedFilters] = useState<Filtros>({
    dateFrom: initialDateFrom,
    dateTo: initialDateTo,
    fonte: initialFonte,
    empresa: initialEmpresa,
    obra: initialObra,
    semPedidoOnly: searchSemPedido,
  });

  useEffect(() => {
    if (searchDateFrom && searchDateFrom !== dateFrom) {
      setDraftDateFrom(searchDateFrom);
      setDateFrom(searchDateFrom);
    }
  }, [searchDateFrom, dateFrom, setDraftDateFrom]);

  useEffect(() => {
    if (searchDateTo && searchDateTo !== dateTo) {
      setDraftDateTo(searchDateTo);
      setDateTo(searchDateTo);
    }
  }, [searchDateTo, dateTo, setDraftDateTo]);

  useEffect(() => {
    if (searchFonteValue && searchFonteValue !== fonte) {
      setDraftFonte(searchFonteValue);
      setFonte(searchFonteValue);
    }
  }, [searchFonteValue, fonte, setDraftFonte]);

  useEffect(() => {
    if (searchEmpresa && searchEmpresa !== empresa) {
      setDraftEmpresa(searchEmpresa);
      setEmpresa(searchEmpresa);
    }
  }, [searchEmpresa, empresa, setDraftEmpresa]);

  useEffect(() => {
    if (searchObra && searchObra !== obra) {
      setDraftObra(searchObra);
      setObra(searchObra);
    }
  }, [searchObra, obra, setDraftObra]);

  useEffect(() => {
    if (searchSemPedido !== semPedidoOnly) {
      setSemPedidoOnly(searchSemPedido);
    }
  }, [searchSemPedido, semPedidoOnly]);

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

  const consultFlashPendingRef = useRef(false);

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

      const filterByObra = (c: any) => {
        const selectedObra = appliedFilters.obra.trim().toLowerCase();
        if (!selectedObra) return true;
        return (c.obra || '').toLowerCase().includes(selectedObra);
      };

      const filterByPeriodo = (c: any) => {
        if (appliedFilters.dateFrom && c.data < appliedFilters.dateFrom) return false;
        if (appliedFilters.dateTo && c.data > appliedFilters.dateTo) return false;
        return true;
      };

      const avFiltered = comprasAv.filter(filterByPeriodo).filter(filterByEmpresa).filter(filterByObra);
      const fatFiltered = comprasFat.filter(filterByPeriodo).filter(filterByEmpresa).filter(filterByObra);

      let comprasParaEspelho: any[] = [];
      if (appliedFilters.fonte === 'avista' || appliedFilters.fonte === 'ambos') {
        comprasParaEspelho = [...comprasParaEspelho, ...avFiltered];
      }
      if (appliedFilters.fonte === 'faturadas' || appliedFilters.fonte === 'ambos') {
        comprasParaEspelho = [...comprasParaEspelho, ...fatFiltered];
      }

      if (appliedFilters.semPedidoOnly) {
        comprasParaEspelho = comprasParaEspelho.filter((c) => !c.pedido?.trim());
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
      if (consultFlashPendingRef.current) {
        consultFlashPendingRef.current = false;
        toast.success('Dados atualizados', { duration: 2200 });
      }
    }
  }, [appliedFilters]);

  useEffect(() => {
    load();
  }, [load]);

  const getItemKey = useCallback((item: EspelhoItem) => {
    return item.source_id || [
      item.fornecedor,
      item.obra,
      item.pedido,
      item.valor_por_obra,
      item.item,
    ].join('|');
  }, []);

  const getGroupKeys = useCallback((item: EspelhoItem) => {
    return items
      .filter((current) => current.fornecedor === item.fornecedor)
      .map(getItemKey);
  }, [getItemKey, items]);

  const isGroupSelected = useCallback((item: EspelhoItem) => {
    const groupKeys = getGroupKeys(item);
    return groupKeys.length > 0 && groupKeys.every((key) => selectedItems.has(key));
  }, [getGroupKeys, selectedItems]);

  const toggleGroupSelection = useCallback((item: EspelhoItem, checked: boolean) => {
    const groupKeys = getGroupKeys(item);
    setSelectedItems((current) => {
      const next = new Set(current);
      groupKeys.forEach((key) => {
        if (checked) {
          next.add(key);
        } else {
          next.delete(key);
        }
      });
      return next;
    });
  }, [getGroupKeys]);

  const recalculateFornecedorTotals = useCallback((selected: EspelhoItem[]) => {
    const totals = new Map<string, number>();
    selected.forEach((item) => {
      const key = item.fornecedor.toLowerCase();
      totals.set(key, (totals.get(key) || 0) + item.valor_por_obra);
    });

    return selected.map((item) => ({
      ...item,
      total_fornecedor: totals.get(item.fornecedor.toLowerCase()) || 0,
    }));
  }, []);

  const totalGeral = useMemo(() => items.reduce((s, i) => s + i.valor_por_obra, 0), [items]);

  const selectedReportItems = useMemo(() => {
    if (selectedItems.size === 0) return items;
    return recalculateFornecedorTotals(items.filter((item) => selectedItems.has(getItemKey(item))));
  }, [getItemKey, items, recalculateFornecedorTotals, selectedItems]);

  const selectedVisibleCount = useMemo(() => {
    return items.filter((item) => selectedItems.has(getItemKey(item))).length;
  }, [getItemKey, items, selectedItems]);

  const groupedRows = useMemo(() => {
    const rows: { item: EspelhoItem; isFirst: boolean; groupSize: number }[] = [];
    let idx = 0;

    while (idx < items.length) {
      const forn = items[idx].fornecedor;
      let j = idx;

      while (j < items.length && items[j].fornecedor === forn) {
        j++;
      }

      const size = j - idx;

      for (let k = idx; k < j; k++) {
        rows.push({
          item: items[k],
          isFirst: k === idx,
          groupSize: size,
        });
      }

      idx = j;
    }

    return rows;
  }, [items]);

  function formatPeriodoLabel() {
    if (appliedFilters.dateFrom && appliedFilters.dateTo) {
      return `${formatDateBR(appliedFilters.dateFrom)} a ${formatDateBR(appliedFilters.dateTo)}`;
    }
    if (appliedFilters.dateFrom) return `A partir de ${formatDateBR(appliedFilters.dateFrom)}`;
    if (appliedFilters.dateTo) return `Até ${formatDateBR(appliedFilters.dateTo)}`;
    return 'Todos os períodos';
  }

  function formatObraLabel() {
    return appliedFilters.obra.trim() || 'Todas as obras';
  }

  function handleConsultar() {
    consultFlashPendingRef.current = true;
    setSelectedItems(new Set());
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
    setDraftFonte(fonte);
    setDraftEmpresa(empresa);
    setDraftObra(obra);

    setAppliedFilters({
      dateFrom,
      dateTo,
      fonte,
      empresa,
      obra,
      semPedidoOnly,
    });
  }

  function handleLimpar() {
    consultFlashPendingRef.current = true;
    setSelectedItems(new Set());
    setDateFrom('');
    setDateTo('');
    setFonte('ambos');
    setEmpresa('');
    setObra('');

    setDraftDateFrom('');
    setDraftDateTo('');
    setDraftFonte('ambos');
    setDraftEmpresa('');
    setDraftObra('');
    setSemPedidoOnly(false);

    setAppliedFilters({
      dateFrom: '',
      dateTo: '',
      fonte: 'ambos',
      empresa: '',
      obra: '',
      semPedidoOnly: false,
    });
  }

  async function handleExportPDF() {
    if (selectedReportItems.length === 0) {
      toast.error('Nenhum lançamento selecionado para exportar.');
      return;
    }

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

    exportEspelhoPDF(selectedReportItems, formatPeriodoLabel(), config, observation, formatObraLabel());
  }

  async function handleExportXLSX() {
    if (selectedReportItems.length === 0) {
      toast.error('Nenhum lançamento selecionado para exportar.');
      return;
    }

    exportEspelhoXLSX(selectedReportItems, formatPeriodoLabel(), observation, formatObraLabel());
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
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
                onClick={handleExportXLSX}
              >
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                Excel
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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

          <div>
            <Label className="text-xs">Obra</Label>
            <ObraSelect value={obra} onChange={setObra} placeholder="Todas as obras" />
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

          <div className="text-sm text-muted-foreground">
            Obra: <span className="font-medium">{formatObraLabel()}</span>
          </div>

          <div className="text-sm text-muted-foreground">
            Relatório: <span className="font-medium">
              {selectedItems.size > 0 ? `${selectedVisibleCount} selecionado(s)` : 'Todos os itens filtrados'}
            </span>
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
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedVisibleCount === items.length && items.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedItems(new Set(items.map(getItemKey)));
                    } else {
                      setSelectedItems(new Set());
                    }
                  }}
                />
              </TableHead>
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
                <TableCell colSpan={11} className="text-center text-muted-foreground">
                  Nenhum dado para o período consultado
                </TableCell>
              </TableRow>
            )}

            {groupedRows.map((row, rIdx) => (
              <TableRow key={rIdx}>
                {row.isFirst && (
                  <>
                    <TableCell rowSpan={row.groupSize} className="align-middle">
                      <Checkbox
                        checked={isGroupSelected(row.item)}
                        onCheckedChange={(checked) => toggleGroupSelection(row.item, checked === true)}
                      />
                    </TableCell>
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
                <TableCell colSpan={9} className="text-right">
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
