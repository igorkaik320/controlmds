import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileDown, FileSpreadsheet, Wallet } from 'lucide-react';
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
  const [filterDate, setFilterDate] = useFormDraft('espelho-sem-date', new Date().toISOString().split('T')[0]);
  const [observation, setObservation] = useFormDraft('espelho-sem-obs', '');
  const [filterEmpresa, setFilterEmpresa] = useFormDraft('espelho-sem-empresa', '');
  const [filterResponsavel, setFilterResponsavel] = useFormDraft('espelho-sem-responsavel', '');
  const [totalGeral, setTotalGeral] = useState(0);
  const [empresaLogos, setEmpresaLogos] = useState<{ logo_esquerda: string | null; logo_direita: string | null }>({
    logo_esquerda: null,
    logo_direita: null,
  });
  const [empresaCorCabecalho, setEmpresaCorCabecalho] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [compras, fornecedores, obras, empresas] = await Promise.all([
        fetchProgramacaoSemanal(),
        fetchFornecedores(),
        fetchObras(),
        fetchEmpresas(),
      ]);

      let allowedObras: Set<string> | null = null;

      if (filterEmpresa) {
        allowedObras = new Set(
          obras.filter((o) => o.empresa_id === filterEmpresa).map((o) => o.nome.toLowerCase())
        );

        const empresa = empresas.find((e) => e.id === filterEmpresa);
        if (empresa) {
          setEmpresaLogos({
            logo_esquerda: empresa.logo_esquerda,
            logo_direita: empresa.logo_direita,
          });
          setEmpresaCorCabecalho(empresa.cor_cabecalho || null);
        } else {
          setEmpresaLogos({ logo_esquerda: null, logo_direita: null });
          setEmpresaCorCabecalho(null);
        }
      } else {
        setEmpresaLogos({ logo_esquerda: null, logo_direita: null });
        setEmpresaCorCabecalho(null);
      }

      const filtered = (filterDate ? compras.filter((c) => c.data === filterDate) : compras)
        .filter((c) => !allowedObras || (c.obra && allowedObras.has(c.obra.toLowerCase())))
        .filter((c) => !filterResponsavel || (c.responsavel || '') === filterResponsavel);

      const espelho = buildEspelhoSemanal(filtered, fornecedores);
      setItems(espelho);
      setTotalGeral(espelho.reduce((s, i) => s + i.valor_por_obra, 0));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterDate, filterEmpresa, filterResponsavel]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleExportPDF() {
    let config = await fetchConfigRelatorio();

    if (filterEmpresa && config) {
      config = {
        ...config,
        logo_esquerda: empresaLogos.logo_esquerda || config.logo_esquerda || null,
        logo_direita: empresaLogos.logo_direita || config.logo_direita || null,
        cor_cabecalho: empresaCorCabecalho || config.cor_cabecalho || '#6b7280',
      };
    } else if (config) {
      config = {
        ...config,
        cor_cabecalho: '#6b7280',
      };
    }

    exportEspelhoSemanalPDF(items, filterDate ? formatDateBR(filterDate) : '', config, observation);
  }

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Carregando...</div>;
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
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold">Espelho Semanal</h2>
          <p className="text-sm text-muted-foreground">
            Resumo da programação semanal agrupado por fornecedor/obra
          </p>
        </div>

        {canExport('espelho_semanal') && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileDown className="h-4 w-4 mr-1" />
              PDF
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportEspelhoSemanalXLSX(items, filterDate ? formatDateBR(filterDate) : '', observation)
              }
            >
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Excel
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Data</Label>
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-44"
          />
        </div>

        <div className="w-48">
          <EmpresaSelect value={filterEmpresa} onChange={setFilterEmpresa} label="Empresa" allowAll />
        </div>

        <div className="w-48">
          <ResponsavelSelect value={filterResponsavel} onChange={setFilterResponsavel} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Wallet className="h-4 w-4" />
              Total Geral
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrencyBR(totalGeral)}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <Label className="text-xs">Observação do relatório</Label>
        <Textarea value={observation} onChange={(e) => setObservation(e.target.value)} rows={2} />
      </div>

      <div className="rounded-md border overflow-auto">
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
              <TableHead>Valor por Obra</TableHead>
              <TableHead>Total Fornecedor</TableHead>
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
                <TableCell className="font-mono">{formatCurrencyBR(row.item.valor_por_obra)}</TableCell>

                {row.isFirst && (
                  <TableCell rowSpan={row.groupSize} className="align-middle font-mono font-bold">
                    {formatCurrencyBR(row.item.total_fornecedor)}
                  </TableCell>
                )}
              </TableRow>
            ))}

            {items.length > 0 && (
              <TableRow className="font-bold bg-muted/50">
                <TableCell colSpan={8} className="text-right">
                  TOTAL GERAL
                </TableCell>
                <TableCell className="font-mono">{formatCurrencyBR(totalGeral)}</TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
