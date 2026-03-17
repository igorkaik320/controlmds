import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileDown, FileSpreadsheet, Wallet } from 'lucide-react';
import { fetchProgramacaoSemanal, fetchFornecedores, fetchConfigRelatorio, buildEspelhoSemanal, formatCurrencyBR, formatDateBR, EspelhoItem } from '@/lib/comprasService';
import { exportEspelhoSemanalPDF, exportEspelhoSemanalXLSX } from '@/lib/comprasExport';
import { useFormDraft } from '@/hooks/useFormDraft';
import { toast } from 'sonner';

export default function EspelhoSemanalPage() {
  const [items, setItems] = useState<EspelhoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useFormDraft('espelho-sem-date', new Date().toISOString().split('T')[0]);
  const [observation, setObservation] = useFormDraft('espelho-sem-obs', '');
  const [totalGeral, setTotalGeral] = useState(0);

  const load = useCallback(async () => {
    try {
      const [compras, fornecedores] = await Promise.all([fetchProgramacaoSemanal(), fetchFornecedores()]);
      const filtered = filterDate ? compras.filter(c => c.data === filterDate) : compras;
      const espelho = buildEspelhoSemanal(filtered, fornecedores);
      setItems(espelho);
      setTotalGeral(espelho.reduce((s, i) => s + i.valor_por_obra, 0));
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [filterDate]);

  useEffect(() => { load(); }, [load]);

  async function handleExportPDF() {
    const config = await fetchConfigRelatorio();
    exportEspelhoSemanalPDF(items, filterDate ? formatDateBR(filterDate) : '', config, observation);
  }

  if (loading) return <div className="p-6 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold">Espelho Semanal</h2>
          <p className="text-sm text-muted-foreground">Resumo da programação semanal agrupado por fornecedor/obra</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
          <Button variant="outline" size="sm" onClick={() => exportEspelhoSemanalXLSX(items, filterDate ? formatDateBR(filterDate) : '', observation)}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div><Label className="text-xs">Data</Label><Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-44" /></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-sm"><Wallet className="h-4 w-4" /> Total Geral</div><p className="text-2xl font-bold mt-1">{formatCurrencyBR(totalGeral)}</p></CardContent></Card>
      </div>

      <div><Label className="text-xs">Observação do relatório</Label><Textarea value={observation} onChange={e => setObservation(e.target.value)} rows={2} /></div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Item</TableHead><TableHead>Fornecedor</TableHead><TableHead>Razão Social</TableHead>
            <TableHead>Banco</TableHead><TableHead>Agência</TableHead><TableHead>Conta</TableHead>
            <TableHead>Obra</TableHead><TableHead>Valor por Obra</TableHead><TableHead>Total Fornecedor</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Nenhum dado</TableCell></TableRow>}
            {items.map((i, idx) => (
              <TableRow key={idx}>
                <TableCell>{i.item}</TableCell><TableCell>{i.fornecedor}</TableCell><TableCell>{i.razao_social}</TableCell>
                <TableCell>{i.banco}</TableCell><TableCell>{i.agencia}</TableCell><TableCell>{i.conta}</TableCell>
                <TableCell>{i.obra}</TableCell><TableCell className="font-mono">{formatCurrencyBR(i.valor_por_obra)}</TableCell>
                <TableCell className="font-mono">{formatCurrencyBR(i.total_fornecedor)}</TableCell>
              </TableRow>
            ))}
            {items.length > 0 && (
              <TableRow className="font-bold bg-muted/50">
                <TableCell colSpan={7} className="text-right">TOTAL GERAL</TableCell>
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
