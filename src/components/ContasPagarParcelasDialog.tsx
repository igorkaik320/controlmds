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
  saveParcelas,
  deleteParcela
} from '@/lib/contasPagarService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  contaPagarId: string;
  parcelas: ContaPagarParcela[];
  onSave: (parcelas: ContaPagarParcela[]) => void;
  userId: string;
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
    const novas = [...parcelas];
    novas[index] = { ...novas[index], [field]: value };
    setParcelas(novas);
  }

  function removeParcela(index: number) {
    const novas = parcelas.filter((_, i) => i !== index);
    const renumeradas = novas.map((p, i) => ({
      ...p,
      numero_parcela: i + 1
    }));
    setParcelas(renumeradas);
  }

  function getStatusBadge(status: string) {
    const map: any = {
      aberta: { label: 'Aberta', variant: 'default' },
      paga: { label: 'Paga', variant: 'secondary' },
      vencida: { label: 'Vencida', variant: 'destructive' },
      cancelada: { label: 'Cancelada', variant: 'outline' },
    };
    const s = map[status] || map.aberta;
    return <Badge variant={s.variant}>{s.label}</Badge>;
  }

  async function handleSave() {
    setLoading(true);

    try {
      if (!contaPagarId) {
        toast.error('Conta inválida');
        return;
      }

      // 🔥 BUSCAR PARCELAS DO BANCO
      const { data: parcelasBanco } = await supabase
        .from('contas_pagar_parcelas')
        .select('id')
        .eq('conta_pagar_id', contaPagarId);

      const idsBanco = (parcelasBanco || []).map(p => p.id);
      const idsTela = parcelas.filter(p => p.id).map(p => p.id);

      // 🔥 DELETAR AS REMOVIDAS
      const idsParaDeletar = idsBanco.filter(id => !idsTela.includes(id));

      for (const id of idsParaDeletar) {
        await deleteParcela(id, userId);
      }

      // 🔥 ATUALIZAR EXISTENTES
      for (const p of parcelas.filter(p => p.id)) {
        await updateParcela(p.id, {
          conta_pagar_id: contaPagarId,
          numero_parcela: p.numero_parcela,
          valor_parcela: p.valor_parcela,
          data_vencimento: p.data_vencimento || null,
          data_pagamento: p.data_pagamento || null,
          valor_pago: p.valor_pago ?? null,
          status: p.status,
          observacao: p.observacao || null,
        }, userId);
      }

      // 🔥 INSERIR NOVAS
      const novas = parcelas.filter(p => !p.id).map(p => ({
        conta_pagar_id: contaPagarId,
        numero_parcela: p.numero_parcela,
        valor_parcela: p.valor_parcela,
        data_vencimento: p.data_vencimento || null,
        data_pagamento: p.data_pagamento || null,
        valor_pago: p.valor_pago ?? null,
        status: p.status,
        observacao: p.observacao || null,
        created_by: userId,
      }));

      if (novas.length > 0) {
        await saveParcelas(novas, userId);
      }

      // 🔥 ATUALIZA TOTAL DA CONTA
      const total = parcelas.reduce((sum, p) => sum + (p.valor_parcela || 0), 0);

await supabase
  .from('contas_pagar')
  .update({ 
    valor_total: total,
    quantidade_parcelas: parcelas.length // 🔥 atualiza quantidade corretamente
  })
  .eq('id', contaPagarId);

onSave(parcelas);
onClose();

toast.success('Parcelas salvas com sucesso');

} catch (e: any) {
  console.error(e);
  toast.error('Erro ao salvar parcelas: ' + e.message);
} finally {
  setLoading(false);
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
                  <TableHead>#</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Obs</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {parcelas.map((p, i) => (
                  <TableRow key={p.id || i}>
                    <TableCell>{p.numero_parcela}</TableCell>

                    <TableCell>
                      <Input
                        type="number"
                        value={p.valor_parcela}
                        onChange={(e) =>
                          updateParcelaLocal(i, 'valor_parcela', parseFloat(e.target.value) || 0)
                        }
                      />
                    </TableCell>

                    <TableCell>
                      <Input
                        type="date"
                        value={p.data_vencimento || ''}
                        onChange={(e) =>
                          updateParcelaLocal(i, 'data_vencimento', e.target.value)
                        }
                      />
                    </TableCell>

                    <TableCell>
                      <Input
                        type="date"
                        value={p.data_pagamento || ''}
                        onChange={(e) =>
                          updateParcelaLocal(i, 'data_pagamento', e.target.value || null)
                        }
                      />
                    </TableCell>

                    <TableCell>
                      <Select
                        value={p.status}
                        onValueChange={(v) => updateParcelaLocal(i, 'status', v)}
                      >
                        <SelectTrigger>
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
                        value={p.observacao || ''}
                        onChange={(e) =>
                          updateParcelaLocal(i, 'observacao', e.target.value)
                        }
                      />
                    </TableCell>

                    <TableCell>
                      <Button variant="ghost" onClick={() => removeParcela(i)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            Total: <strong>{formatCurrency(parcelas.reduce((s, p) => s + p.valor_parcela, 0))}</strong>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
