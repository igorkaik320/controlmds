import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileDown, FileSpreadsheet, ShoppingCart, Receipt, Wallet } from 'lucide-react';
import { fetchComprasAvista, fetchComprasFaturadas, fetchFornecedores, fetchConfigRelatorio, buildEspelho, formatCurrencyBR, formatDateBR, EspelhoItem } from '@/lib/comprasService';
import { exportEspelhoPDF, exportEspelhoXLSX } from '@/lib/comprasExport';
import { useFormDraft } from '@/hooks/useFormDraft';
import { toast } from 'sonner';

export default function EspelhoGeralPage() {
  const [items, setItems] = useState<EspelhoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useFormDraft('espelho-date', new Date().toISOString().split('T')[0]);
  const [observation, setObservation] = useFormDraft('espelho-obs', '');

  const [totalAvista, setTotalAvista] = useState(0);
  const [totalFaturadas, setTotalFaturadas] = useState(0);
  const [totalComPedido, setTotalComPedido] = useState(0);
  const [totalSemPedido, setTotalSemPedido] = useState(0);

  const load = useCallback(async () => {
    try {
      const [comprasAv, comprasFat, fornecedores] = await Promise.all([
        fetchComprasAvista(), fetchComprasFaturadas(), fetchFornecedores()
      ]);

      const avFiltered = filterDate ? comprasAv.filter(c => c.data === filterDate) : comprasAv;
      const fatFiltered = filterDate ? comprasFat.filter(c => c.data === filterDate) : comprasFat;

      setItems(buildEspelho(avFiltered, fornecedores));

      const avTotal = avFiltered.reduce((s, c) => s + c.valor, 0);
      const fatTotal = fatFiltered.reduce((s, c) => s + c.valor, 0);
      const comPedido = fatFiltered.filter(c => c.pedido?.trim()).reduce((s, c) => s + c.valor, 0);
      const semPedido = fatFiltered.filter(c => !c.pedido?.trim()).reduce((s, c) => s + c.valor, 0);

      setTotalAvista(avTotal);
      setTotalFaturadas(fatTotal);
      setTotalComPedido(comPedido);
      setTotalSemPedido(semPedido);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [filterDate]);

  useEffect(() => { load(); }, [load]);

  const totalGeral = items.reduce((s, i) => s + i.valor_por_obra, 0);

  async function handleExportPDF() {
    const config = await fetchConfigRelatorio();
    exportEspelhoPDF(items, filterDate ? formatDateBR(filterDate) : '', config, observation);
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Espelho Geral do Dia</h2>
        <p className="text-sm text-muted-foreground">Resumo automático das compras agrupado por fornecedor/obra</p>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
          <Button variant="outline" size="sm" onClick={() => exportEspelhoXLSX(items, filterDate ? formatDateBR(filterDate) : '', observation)}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
        </div>
        <div>
          <Label className="text-xs">Data</Label>
          <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-44" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Com Pedido (Faturadas)</p>
            <p className="text-xl font-bold">{formatCurrencyBR(totalComPedido)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Sem Pedido (Faturadas)</p>
            <p className="text-xl font-bold">{formatCurrencyBR(totalSemPedido)}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <Label className="text-xs">Observação do relatório</Label>
        <Textarea value={observation} onChange={e => setObservation(e.target.value)} rows={2} placeholder="Observação para o relatório..." />
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
              <TableHead className="text-right">Valor por Obra</TableHead>
              <TableHead className="text-right">Total Fornecedor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Nenhum dado para esta data</TableCell></TableRow>
            )}
            {items.map((i, idx) => (
              <TableRow key={idx}>
                <TableCell>{i.item}</TableCell>
                <TableCell className="font-medium">{i.fornecedor}</TableCell>
                <TableCell>{i.razao_social}</TableCell>
                <TableCell>{i.banco}</TableCell>
                <TableCell>{i.agencia}</TableCell>
                <TableCell>{i.conta}</TableCell>
                <TableCell>{i.obra}</TableCell>
                <TableCell className="text-right">{formatCurrencyBR(i.valor_por_obra)}</TableCell>
                <TableCell className="text-right">{formatCurrencyBR(i.total_fornecedor)}</TableCell>
              </TableRow>
            ))}
            {items.length > 0 && (
              <TableRow className="font-bold bg-muted/50">
                <TableCell colSpan={7} className="text-right">TOTAL GERAL</TableCell>
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
