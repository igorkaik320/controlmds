import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileDown, FileSpreadsheet, Wallet, Search, RotateCcw } from 'lucide-react';
import {
  fetchProgramacaoSemanal,
  fetchFornecedores,
  fetchConfigRelatorio,
  buildEspelhoSemanal,
  formatCurrencyBR,
  formatDateBR,
  EspelhoItem,
} from '@/lib/comprasService';
import { exportEspelhoSemanalPDF, exportEspelhoSemanalXLSX } from '@/lib/comprasExport';
import { fetchObras } from '@/lib/obrasService';
import { fetchEmpresas } from '@/lib/empresasService';
import EmpresaSelect from '@/components/compras/EmpresaSelect';
import ResponsavelSelect from '@/components/compras/ResponsavelSelect';
import { useFormDraft } from '@/hooks/useFormDraft';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { toast } from 'sonner';

export default function EspelhoSemanalPage() {
  const [items, setItems] = useState<EspelhoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { canExport } = useModulePermissions();

  const [draftDate, setDraftDate] = useFormDraft('espelho-sem-date', new Date().toISOString().split('T')[0]);
  const [draftEmpresa, setDraftEmpresa] = useFormDraft('espelho-sem-empresa', '');
  const [draftResponsavel, setDraftResponsavel] = useFormDraft('espelho-sem-responsavel', '');
  const [observation, setObservation] = useFormDraft('espelho-sem-obs', '');

  const [filterDate, setFilterDate] = useState(draftDate);
  const [filterEmpresa, setFilterEmpresa] = useState(draftEmpresa);
  const [filterResponsavel, setFilterResponsavel] = useState(draftResponsavel);

  const [appliedDate, setAppliedDate] = useState(draftDate);
  const [appliedEmpresa, setAppliedEmpresa] = useState(draftEmpresa);
  const [appliedResponsavel, setAppliedResponsavel] = useState(draftResponsavel);

  const [totalGeral, setTotalGeral] = useState(0);
  const [empresaLogos, setEmpresaLogos] = useState<{ logo_esquerda: string | null; logo_direita: string | null }>({
    logo_esquerda: null,
    logo_direita: null,
  });

  const consultFlashPendingRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [compras, fornecedores, obras, empresas] = await Promise.all([
        fetchProgramacaoSemanal(),
        fetchFornecedores(),
        fetchObras(),
        fetchEmpresas(),
      ]);

      let allowedObras: Set<string> | null = null;

      if (appliedEmpresa) {
        allowedObras = new Set(
          obras.filter((o) => o.empresa_id === appliedEmpresa).map((o) => o.nome.toLowerCase())
        );

        const empresaSelecionada = empresas.find((e) => e.id === appliedEmpresa);
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

      const filtered = (appliedDate ? compras.filter((c) => c.data === appliedDate) : compras)
        .filter((c) => !allowedObras || (c.obra && allowedObras.has(c.obra.toLowerCase())))
        .filter((c) => !appliedResponsavel || (c.responsavel || '') === appliedResponsavel);

      const espelho = buildEspelhoSemanal(filtered, fornecedores);
      setItems(espelho);
      setTotalGeral(espelho.reduce((s, i) => s + i.valor_por_obra, 0));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [appliedDate, appliedEmpresa, appliedResponsavel]);

  useEffect(() => {
    load();
  }, [load]);

  function handleConsultar() {
    consultFlashPendingRef.current = true;
    setDraftDate(filterDate);
    setDraftEmpresa(filterEmpresa);
    setDraftResponsavel(filterResponsavel);

    setAppliedDate(filterDate);
    setAppliedEmpresa(filterEmpresa);
    setAppliedResponsavel(filterResponsavel);
  }

  function handleLimpar() {
    consultFlashPendingRef.current = true;
    const hoje = new Date().toISOString().split('T')[0];

    setFilterDate(hoje);
    setFilterEmpresa('');
    setFilterResponsavel('');

    setDraftDate(hoje);
    setDraftEmpresa('');
    setDraftResponsavel('');

    setAppliedDate(hoje);
    setAppliedEmpresa('');
    setAppliedResponsavel('');
  }

  async function handleExportPDF() {
    let config = await fetchConfigRelatorio();

    if (appliedEmpresa && (empresaLogos.logo_esquerda || empresaLogos.logo_direita) && config) {
      config = {
        ...config,
        logo_esquerda: empresaLogos.logo_esquerda || config.logo_esquerda || null,
        logo_direita: empresaLogos.logo_direita || config.logo_direita || null,
      };
    }

    exportEspelhoSemanalPDF(items, appliedDate ? formatDateBR(appliedDate) : '', config, observation);
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const groupedRows: { item: EspelhoItem; isFirst: boolean; groupSize: number }[] = [];
  let idx = 0;

  while (idx < items.length) {
    const fornecedor = items[idx].fornecedor;
    let j = idx;

    while (j < items.length && items[j].fornecedor === fornecedor) {
      j++;
    }

    const groupSize = j - idx;

    for (let k = idx; k < j; k++) {
      groupedRows.push({
        item: items[k],
        isFirst: k === idx,
        groupSize,
      });
    }

    idx = j;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Espelho Semanal</h2>
          <p className="text-sm text-muted-foreground">
            Resumo da programação semanal agrupado por fornecedor/obra
          </p>
        </div>

        <div className="flex gap-2">
          {canExport('espelho_semanal') && (
            <>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <FileDown className="mr-1 h-4 w-4" />
                PDF
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => exportEspelhoSemanalXLSX(items, appliedDate ? formatDateBR(appliedDate) : '', observation)}
              >
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                Excel
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <Label className="text-xs">Data</Label>
            <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          </div>

          <div>
            <EmpresaSelect value={filterEmpresa} onChange={setFilterEmpresa} label="Empresa" allowAll />
          </div>

          <div>
            <ResponsavelSelect value={filterResponsavel} onChange={setFilterResponsavel} />
          </div>
        </div>

        <div>
          <Label className="text-xs">Observação do relatório</Label>
          <Textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            rows={2}
            placeholder="Observação..."
          />
        </div>

        <div className="flex justify-end gap-2">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" />
              Total Geral
            </div>
            <p className="mt-1 text-2xl font-bold">{formatCurrencyBR(totalGeral)}</p>
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
                  Nenhum dado
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
                    <TableCell rowSpan={row.groupSize} className="align-middle">
                      {row.item.banco}
                    </TableCell>
                    <TableCell rowSpan={row.groupSize} className="align-middle">
                      {row.item.agencia}
                    </TableCell>
                    <TableCell rowSpan={row.groupSize} className="align-middle">
                      {row.item.conta}
                    </TableCell>
                  </>
                )}

                <TableCell>{row.item.obra}</TableCell>
                <TableCell className="text-center">{row.item.pedido}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrencyBR(row.item.valor_por_obra)}</TableCell>

                {row.isFirst && (
                  <TableCell rowSpan={row.groupSize} className="align-middle text-right font-mono font-bold">
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
                <TableCell className="text-right font-mono">{formatCurrencyBR(totalGeral)}</TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
