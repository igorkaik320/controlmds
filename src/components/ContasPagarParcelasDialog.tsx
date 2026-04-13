import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { 
  ContaPagarParcela, 
  updateParcela, 
  saveParcelas 
} from '@/lib/contasPagarService';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  contaPagarId: string;
  parcelas: ContaPagarParcela[];
  onSave: (parcelas: ContaPagarParcela[]) => void;
  userId: string;
}

/**
 * 🔒 Função segura para datas (resolve erro de timestamp)
 */
function normalizeDate(date?: string | null) {
  if (!date || typeof date !== 'string') return null;

  const trimmed = date.trim();
  if (!trimmed) return null;

  const parts = trimmed.split('-');
  if (parts.length !== 3) return null;

  const [year, month, day] = parts;

  if (!year || !month || !day) return null;

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export default function ContasPagarParcelasDialog({ 
  open, 
  onClose, 
  contaPagarId, 
  parcelas: initialParcelas, 
  onSave, 
  userId 
}: Props) {
  const [parcelas, setParcelas] = useState<ContaPagarParcela[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setParcelas(initialParcelas?.length ? [...initialParcelas] : []);
    }
  }, [open, initialParcelas]);

  function addParcela() {
    const novaParcela: ContaPagarParcela = {
      id: '',
      conta_pagar_id: contaPagarId,
      numero_parcela: parcelas.length + 1,
      valor_parcela: 0,
      data_vencimento: new Date().toISOString().split('T')[0],
      data_pagamento: null,
      valor_pago: null,
      status: 'aberta',
      observacao: null,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setParcelas([...parcelas, novaParcela]);
  }

  function updateParcelaLocal(index: number, field: keyof ContaPagarParcela, value: any) {
    const novasParcelas = [...parcelas];
    novasParcelas[index] = { ...novasParcelas[index], [field]: value };
    setParcelas(novasParcelas);
  }

  function removeParcela(index: number) {
    const novasParcelas = parcelas.filter((_, i) => i !== index);
    const renumeradas = novasParcelas.map((p, i) => ({
      ...p,
      numero_parcela: i + 1
    }));
    setParcelas(renumeradas);
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      aberta: { label: 'Aberta', variant: 'default' },
      paga: { label: 'Paga', variant: 'secondary' },
      vencida: { label: 'Vencida', variant: 'destructive' },
      cancelada: { label: 'Cancelada', variant: 'outline' },
    };
    
    const config = variants[status] || { label: status, variant: 'default' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }

  async function handleSave() {
    setLoading(true);
    try {
      for (const parcela of parcelas) {
        if (!parcela.valor_parcela || parcela.valor_parcela <= 0) {
          toast.error('Todas as parcelas devem ter um valor maior que zero');
          setLoading(false);
          return;
        }

        if (!normalizeDate(parcela.data_vencimento)) {
          toast.error('Data de vencimento inválida');
          setLoading(false);
          return;
        }
      }

      const parcelasLimpas = parcelas.map(p => ({
        ...p,
        data_vencimento: normalizeDate(p.data_vencimento),
        data_pagamento: normalizeDate(p.data_pagamento),
        valor_pago: p.valor_pago ?? null,
        observacao: p.observacao?.trim() || null,
        updated_at: new Date().toISOString(),
      }));

      const parcelasExistentes = parcelasLimpas.filter(p => p.id);
      const parcelasNovas = parcelasLimpas.filter(p => !p.id);

      for (const parcela of parcelasExistentes) {
        await updateParcela(parcela.id, parcela, userId);
      }

      if (parcelasNovas.length > 0) {
        await saveParcelas(parcelasNovas, userId);
      }

      onSave(parcelas);
      onClose();
      toast.success('Parcelas atualizadas com sucesso');

    } catch (error: any) {
      console.error('Erro ao salvar parcelas:', error);
      toast.error('Erro ao salvar parcelas: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Editar Parcelas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Total de parcelas: {parcelas.length}
            </div>
            <Button size="sm" onClick={addParcela}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Parcela
            </Button>
          </div>

          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">#</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observação</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhuma parcela cadastrada
                    </TableCell>
                  </TableRow>
                )}

                {parcelas.map((parcela, index) => (
                  <TableRow key={parcela.id || `nova-${index}`}>
                    <TableCell className="font-medium">
                      {parcela.numero_parcela}/{parcelas.length}
                    </TableCell>

                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={parcela.valor_parcela}
                        onChange={(e) =>
                          updateParcelaLocal(index, 'valor_parcela', parseFloat(e.target.value) || 0)
                        }
                        className="w-24 font-mono text-sm"
                      />
                    </TableCell>

                    <TableCell>
                      <Input
                        type="date"
                        value={parcela.data_vencimento || ''}
                        onChange={(e) =>
                          updateParcelaLocal(index, 'data_vencimento', e.target.value)
                        }
                        className="w-32 text-sm"
                      />
                    </TableCell>

                    <TableCell>
                      <Input
                        type="date"
                        value={parcela.data_pagamento || ''}
                        onChange={(e) =>
                          updateParcelaLocal(
                            index,
                            'data_pagamento',
                            e.target.value ? e.target.value : null
                          )
                        }
                        className="w-32 text-sm"
                      />
                    </TableCell>

                    <TableCell>
                      <Select
                        value={parcela.status}
                        onValueChange={(value) => updateParcelaLocal(index, 'status', value)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aberta">Aberta</SelectItem>
                          <SelectItem value="paga">Paga</SelectItem>
                          <SelectItem value="vencida">Vencida</SelectItem>
                          <SelectItem value="cancelada">Cancelada</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell>
                      <Input
                        value={parcela.observacao || ''}
                        onChange={(e) =>
                          updateParcelaLocal(index, 'observacao', e.target.value || null)
                        }
                        className="w-32 text-sm"
                        placeholder="Obs..."
                      />
                    </TableCell>

                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeParcela(index)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
            <div className="text-sm">
              Total das parcelas:{' '}
              <strong>
                {formatCurrency(parcelas.reduce((sum, p) => sum + p.valor_parcela, 0))}
              </strong>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Parcelas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
