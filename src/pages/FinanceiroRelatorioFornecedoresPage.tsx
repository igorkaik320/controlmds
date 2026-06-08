import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, Building2, FileSpreadsheet, FileText, Search } from 'lucide-react';
import { toast } from 'sonner';
import { fetchContasPagar, ContaPagarComParcelas } from '@/lib/contasPagarService';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SearchableSelect, { SearchableSelectOption } from '@/components/SearchableSelect';

type StatusFiltro = 'aberto' | 'vencido' | 'pago';
type SortField = 'fornecedor' | 'total' | StatusFiltro;
type SortDirection = 'desc' | 'asc';

interface RelatorioFornecedorRow {
  key: string;
  fornecedor: string;
  empresa: string;
  obra: string;
  aberto: number;
  vencido: number;
  pago: number;
  total: number;
  parcelas: number;
}

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function normalizeSearch(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getParcelaStatus(status: string, vencimento: string): StatusFiltro | null {
  if (status === 'paga') return 'pago';
  if (status === 'cancelada') return null;
  if (status === 'vencida') return 'vencido';
  if (status === 'aberta' && vencimento && vencimento < todayISO()) return 'vencido';
  if (status === 'aberta') return 'aberto';
  return null;
}

function formatMoney(value: number) {
  return currency.format(value || 0);
}

export default function FinanceiroRelatorioFornecedoresPage() {
  const [items, setItems] = useState<ContaPagarComParcelas[]>([]);
  const [loading, setLoading] = useState(true);
  const [fornecedorFilter, setFornecedorFilter] = useState('');
  const [empresaFilter, setEmpresaFilter] = useState('');
  const [obraFilter, setObraFilter] = useState('');
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [statusSelecionados, setStatusSelecionados] = useState<StatusFiltro[]>(['aberto', 'vencido', 'pago']);
  const [sortField, setSortField] = useState<SortField>('total');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setItems(await fetchContasPagar());
      } catch (error: any) {
        toast.error(error.message || 'Nao foi possivel carregar o relatorio');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  function toggleStatus(status: StatusFiltro, checked: boolean) {
    setStatusSelecionados((prev) => {
      const next = checked ? Array.from(new Set([...prev, status])) : prev.filter((item) => item !== status);
      return next.length > 0 ? next : prev;
    });
  }

  function clearFilters() {
    setFornecedorFilter('');
    setEmpresaFilter('');
    setObraFilter('');
    setDataInicial('');
    setDataFinal('');
    setStatusSelecionados(['aberto', 'vencido', 'pago']);
    setSortField('total');
    setSortDirection('desc');
  }

  const selectOptions = useMemo(() => {
    const fornecedores = new Map<string, SearchableSelectOption>();
    const empresas = new Map<string, SearchableSelectOption>();
    const obras = new Map<string, SearchableSelectOption>();

    items.forEach((conta) => {
      const fornecedor = conta.fornecedor_nome || 'Sem fornecedor';
      const empresa = conta.empresa_nome || '-';
      const obra = conta.obra_nome || '-';

      if (!fornecedores.has(fornecedor)) {
        fornecedores.set(fornecedor, {
          value: fornecedor,
          label: fornecedor,
          description: empresa !== '-' ? empresa : undefined,
          keywords: `${fornecedor} ${empresa} ${obra}`,
        });
      }

      if (!empresas.has(empresa)) {
        empresas.set(empresa, {
          value: empresa,
          label: empresa,
          keywords: empresa,
        });
      }

      if (!obras.has(obra)) {
        obras.set(obra, {
          value: obra,
          label: obra,
          description: empresa !== '-' ? empresa : undefined,
          keywords: `${obra} ${empresa}`,
        });
      }
    });

    const sortOptions = (options: SearchableSelectOption[]) =>
      options.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base', numeric: true }));

    return {
      fornecedores: sortOptions(Array.from(fornecedores.values())),
      empresas: sortOptions(Array.from(empresas.values())),
      obras: sortOptions(Array.from(obras.values())),
    };
  }, [items]);

  const rows = useMemo(() => {
    const fornecedorTerm = normalizeSearch(fornecedorFilter);
    const empresaTerm = normalizeSearch(empresaFilter);
    const obraTerm = normalizeSearch(obraFilter);
    const grouped = new Map<string, RelatorioFornecedorRow>();

    items.forEach((conta) => {
      const fornecedor = conta.fornecedor_nome || 'Sem fornecedor';
      const empresa = conta.empresa_nome || '-';
      const obra = conta.obra_nome || '-';

      if (fornecedorTerm && !normalizeSearch(fornecedor).includes(fornecedorTerm)) return;
      if (empresaTerm && !normalizeSearch(empresa).includes(empresaTerm)) return;
      if (obraTerm && !normalizeSearch(obra).includes(obraTerm)) return;

      conta.parcelas.forEach((parcela) => {
        if (dataInicial && parcela.data_vencimento < dataInicial) return;
        if (dataFinal && parcela.data_vencimento > dataFinal) return;

        const status = getParcelaStatus(parcela.status, parcela.data_vencimento);
        if (!status || !statusSelecionados.includes(status)) return;

        const key = `${fornecedor}__${empresa}__${obra}`;
        const current = grouped.get(key) || {
          key,
          fornecedor,
          empresa,
          obra,
          aberto: 0,
          vencido: 0,
          pago: 0,
          total: 0,
          parcelas: 0,
        };

        const value = Number(parcela.valor_pago ?? parcela.valor_parcela ?? 0);
        current[status] += value;
        current.total += value;
        current.parcelas += 1;
        grouped.set(key, current);
      });
    });

    return Array.from(grouped.values()).sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'fornecedor') {
        const fornecedorCompare = a.fornecedor.localeCompare(b.fornecedor, 'pt-BR', { sensitivity: 'base', numeric: true });
        if (fornecedorCompare !== 0) return fornecedorCompare * dir;
        const empresaCompare = a.empresa.localeCompare(b.empresa, 'pt-BR', { sensitivity: 'base', numeric: true });
        if (empresaCompare !== 0) return empresaCompare;
        return a.obra.localeCompare(b.obra, 'pt-BR', { sensitivity: 'base', numeric: true });
      }
      const diff = a[sortField] - b[sortField];
      if (diff !== 0) return diff * dir;
      return a.fornecedor.localeCompare(b.fornecedor, 'pt-BR', { sensitivity: 'base', numeric: true });
    });
  }, [items, fornecedorFilter, empresaFilter, obraFilter, dataInicial, dataFinal, statusSelecionados, sortField, sortDirection]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        aberto: acc.aberto + row.aberto,
        vencido: acc.vencido + row.vencido,
        pago: acc.pago + row.pago,
        total: acc.total + row.total,
        parcelas: acc.parcelas + row.parcelas,
      }),
      { aberto: 0, vencido: 0, pago: 0, total: 0, parcelas: 0 }
    );
  }, [rows]);

  const showAberto = statusSelecionados.includes('aberto');
  const showVencido = statusSelecionados.includes('vencido');
  const showPago = statusSelecionados.includes('pago');
  const visibleValueColumns = [showAberto, showVencido, showPago].filter(Boolean).length;
  const tableColSpan = 5 + visibleValueColumns;
  const sortDirectionLabel = sortField === 'fornecedor'
    ? (sortDirection === 'asc' ? 'A-Z' : 'Z-A')
    : (sortDirection === 'desc' ? 'Maior para menor' : 'Menor para maior');

  function buildExportRows() {
    const header = [
      'Fornecedor',
      'Empresa',
      'Obra',
      'Parcelas',
      ...(showAberto ? ['Aberto'] : []),
      ...(showVencido ? ['Vencido'] : []),
      ...(showPago ? ['Pago'] : []),
      'Total',
    ];

    return [
      header,
      ...rows.map((row) => [
        row.fornecedor,
        row.empresa,
        row.obra,
        row.parcelas,
        ...(showAberto ? [row.aberto] : []),
        ...(showVencido ? [row.vencido] : []),
        ...(showPago ? [row.pago] : []),
        row.total,
      ]),
      [
        'Total geral',
        '',
        '',
        totals.parcelas,
        ...(showAberto ? [totals.aberto] : []),
        ...(showVencido ? [totals.vencido] : []),
        ...(showPago ? [totals.pago] : []),
        totals.total,
      ],
    ];
  }

  async function handleExportExcel() {
    if (exportingExcel) return;
    if (rows.length === 0) {
      toast.error('Nada para exportar.');
      return;
    }

    setExportingExcel(true);
    try {
      const XLSX = await import('xlsx');
      const exportRows = buildExportRows();
      const ws = XLSX.utils.aoa_to_sheet(exportRows);
      ws['!cols'] = [
        { wch: 42 },
        { wch: 32 },
        { wch: 34 },
        { wch: 10 },
        ...Array(visibleValueColumns + 1).fill({ wch: 16 }),
      ];

      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let row = 1; row <= range.e.r; row += 1) {
        for (let col = 4; col <= range.e.c; col += 1) {
          const ref = XLSX.utils.encode_cell({ r: row, c: col });
          if (ws[ref]) {
            ws[ref].t = 'n';
            ws[ref].z = '#,##0.00';
          }
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Fornecedores');
      XLSX.writeFile(wb, `relatorio_fornecedores_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel exportado com sucesso.');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao exportar Excel.');
    } finally {
      setExportingExcel(false);
    }
  }

  async function handleExportPdf() {
    if (exportingPdf) return;
    if (rows.length === 0) {
      toast.error('Nada para exportar.');
      return;
    }

    setExportingPdf(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      let y = 12;

      const columns = [
        { key: 'fornecedor', label: 'Fornecedor', x: 10, w: 58 },
        { key: 'empresa', label: 'Empresa', x: 70, w: 45 },
        { key: 'obra', label: 'Obra', x: 117, w: 45 },
        { key: 'parcelas', label: 'Parc.', x: 164, w: 12 },
        ...(showAberto ? [{ key: 'aberto', label: 'Aberto', x: 178, w: 27 }] : []),
        ...(showVencido ? [{ key: 'vencido', label: 'Vencido', x: showAberto ? 207 : 178, w: 27 }] : []),
        ...(showPago ? [{ key: 'pago', label: 'Pago', x: 236 - (!showAberto ? 29 : 0) - (!showVencido ? 29 : 0), w: 27 }] : []),
      ];
      const totalColumn = { key: 'total', label: 'Total', x: 268, w: 19 };

      const checkPage = (height: number) => {
        if (y + height > pageHeight - 10) {
          pdf.addPage();
          y = 12;
          drawHeader();
        }
      };

      const drawHeader = () => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(13);
        pdf.setTextColor(20, 20, 20);
        pdf.text('RELATORIO DE FORNECEDORES', pageWidth / 2, y, { align: 'center' });
        y += 5;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}  |  Ordenacao: ${sortDirectionLabel}`, pageWidth / 2, y, { align: 'center' });
        y += 6;
        pdf.setFillColor(245, 247, 250);
        pdf.rect(margin, y - 4, pageWidth - margin * 2, 7, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(70, 70, 70);
        [...columns, totalColumn].forEach((col) => {
          const align = ['aberto', 'vencido', 'pago', 'total'].includes(col.key) ? 'right' : 'left';
          pdf.text(col.label, align === 'right' ? col.x + col.w : col.x, y, { align });
        });
        y += 6;
      };

      drawHeader();
      pdf.setFontSize(6.8);

      rows.forEach((row, index) => {
        const fornecedorLines = pdf.splitTextToSize(row.fornecedor, 56).slice(0, 2);
        const empresaLines = pdf.splitTextToSize(row.empresa, 43).slice(0, 2);
        const obraLines = pdf.splitTextToSize(row.obra, 43).slice(0, 2);
        const rowHeight = Math.max(7, Math.max(fornecedorLines.length, empresaLines.length, obraLines.length) * 3.2 + 2);
        checkPage(rowHeight);

        if (index % 2 === 1) {
          pdf.setFillColor(252, 252, 252);
          pdf.rect(margin, y - 3.5, pageWidth - margin * 2, rowHeight, 'F');
        }

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(35, 35, 35);
        pdf.text(fornecedorLines, 10, y);
        pdf.text(empresaLines, 70, y);
        pdf.text(obraLines, 117, y);
        pdf.text(String(row.parcelas), 170, y, { align: 'center' });
        columns.forEach((col) => {
          if (!['aberto', 'vencido', 'pago'].includes(col.key)) return;
          pdf.text(formatMoney(Number(row[col.key as StatusFiltro])), col.x + col.w, y, { align: 'right' });
        });
        pdf.setFont('helvetica', 'bold');
        pdf.text(formatMoney(row.total), totalColumn.x + totalColumn.w, y, { align: 'right' });
        y += rowHeight;
      });

      checkPage(10);
      pdf.setDrawColor(60, 60, 60);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 5;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text('TOTAL GERAL', margin, y);
      pdf.text(formatMoney(totals.total), pageWidth - margin, y, { align: 'right' });

      pdf.save(`relatorio_fornecedores_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF exportado com sucesso.');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao exportar PDF.');
    } finally {
      setExportingPdf(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">Carregando relatorio...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Relatorio de Fornecedores</h2>
          <p className="text-sm text-muted-foreground">Valores agrupados por fornecedor, empresa e obra.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exportingPdf || rows.length === 0}>
            <FileText className="mr-2 h-4 w-4" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={exportingExcel || rows.length === 0}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      <section className="rounded-md border bg-card p-4 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-semibold">Filtros</h3>
          <p className="text-xs text-muted-foreground">Refine por fornecedor, empresa, obra, periodo de vencimento e situacao da parcela.</p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_140px_140px]">
          <SearchableSelect
            label="Fornecedor"
            labelClassName="text-xs"
            value={fornecedorFilter}
            onChange={setFornecedorFilter}
            options={selectOptions.fornecedores}
            placeholder="Digite para pesquisar"
          />
          <SearchableSelect
            label="Empresa"
            labelClassName="text-xs"
            value={empresaFilter}
            onChange={setEmpresaFilter}
            options={selectOptions.empresas}
            placeholder="Digite para pesquisar"
          />
          <SearchableSelect
            label="Obra"
            labelClassName="text-xs"
            value={obraFilter}
            onChange={setObraFilter}
            options={selectOptions.obras}
            placeholder="Digite para pesquisar"
          />
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={dataInicial} onChange={(event) => setDataInicial(event.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Ate</Label>
            <Input type="date" value={dataFinal} onChange={(event) => setDataFinal(event.target.value)} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-4">
            {([
              ['aberto', 'Mostrar valor em aberto'],
              ['vencido', 'Mostrar valor vencido'],
              ['pago', 'Mostrar valor pago'],
            ] as Array<[StatusFiltro, string]>).map(([status, label]) => (
              <label key={status} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={statusSelecionados.includes(status)}
                  onCheckedChange={(checked) => toggleStatus(status, checked === true)}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="w-44">
              <Label className="text-xs">Ordenar por</Label>
              <Select value={sortField} onValueChange={(value: SortField) => setSortField(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Total selecionado</SelectItem>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                  <SelectItem value="aberto">Valor aberto</SelectItem>
                  <SelectItem value="vencido">Valor vencido</SelectItem>
                  <SelectItem value="pago">Valor pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-44">
              <Label className="text-xs">Formato</Label>
              <Select value={sortDirection} onValueChange={(value: SortDirection) => setSortDirection(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Maior para menor</SelectItem>
                  <SelectItem value="asc">Menor para maior</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" className="mt-5" onClick={clearFilters}>
              Limpar
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Total selecionado</p>
          <p className="mt-1 text-xl font-bold">{formatMoney(totals.total)}</p>
        </div>
        <div className="rounded-md border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Fornecedores/Obras</p>
          <p className="mt-1 text-xl font-bold">{rows.length}</p>
        </div>
        <div className="rounded-md border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Parcelas</p>
          <p className="mt-1 text-xl font-bold">{totals.parcelas}</p>
        </div>
        <div className="rounded-md border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Maior valor</p>
          <p className="mt-1 text-xl font-bold">{formatMoney(rows[0]?.[sortField] || 0)}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-md border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">Fornecedores</h3>
            <p className="text-xs text-muted-foreground">{rows.length} registro(s) encontrado(s)</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ArrowDownUp className="h-4 w-4" />
            {sortDirectionLabel}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead className="text-center">Parcelas</TableHead>
              {showAberto && <TableHead className="text-right">Aberto</TableHead>}
              {showVencido && <TableHead className="text-right">Vencido</TableHead>}
              {showPago && <TableHead className="text-right">Pago</TableHead>}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={tableColSpan} className="h-28 text-center text-muted-foreground">
                  Nenhum fornecedor encontrado para os filtros informados.
                </TableCell>
              </TableRow>
            )}

            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    <span>{row.fornecedor}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.empresa}</TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{row.obra}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">{row.parcelas}</TableCell>
                {showAberto && <TableCell className="text-right font-semibold">{formatMoney(row.aberto)}</TableCell>}
                {showVencido && <TableCell className="text-right font-semibold text-destructive">{formatMoney(row.vencido)}</TableCell>}
                {showPago && <TableCell className="text-right font-semibold text-emerald-700">{formatMoney(row.pago)}</TableCell>}
                <TableCell className="text-right font-bold">{formatMoney(row.total)}</TableCell>
              </TableRow>
            ))}

            {rows.length > 0 && (
              <TableRow className="bg-muted/40 font-bold">
                <TableCell colSpan={4}>Total geral</TableCell>
                {showAberto && <TableCell className="text-right">{formatMoney(totals.aberto)}</TableCell>}
                {showVencido && <TableCell className="text-right">{formatMoney(totals.vencido)}</TableCell>}
                {showPago && <TableCell className="text-right">{formatMoney(totals.pago)}</TableCell>}
                <TableCell className="text-right">{formatMoney(totals.total)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
