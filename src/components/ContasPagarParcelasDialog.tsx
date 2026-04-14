import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
    setParcelas(novas.map((p, i) => ({ ...p, numero_parcela: i + 1 })));
  }

  async function handleSave() {
    setLoading(true);
    try {
      if (!contaPagarId) {
        toast.error('Conta inválida');
        return;
      }

      const { data: parcelasBanco } = await supabase
        .from('contas_pagar_parcelas')
        .select('id')
        .eq('conta_pagar_id', contaPagarId);

      const idsBanco = (parcelasBanco || []).map(p => p.id);
      const idsTela = parcelas.filter(p => p.id).map(p => p.id);
      const idsParaDeletar = idsBanco.filter(id => !idsTela.includes(id));

      for (const id of idsParaDeletar) {
        await deleteParcela(id, userId);
      }

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

      const total = parcelas.reduce((sum, p) => sum + (p.valor_parcela || 0), 0);

      await supabase
        .from('contas_pagar')
        .update({ 
          valor_total: total,
          quantidade_parcelas: parcelas.length
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
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-auto">
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
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="w-28">Valor</TableHead>
                  <TableHead className="w-36">Vencimento</TableHead>
                  <TableHead className="w-36">Pagamento</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="min-w-[200px]">Observação</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {parcelas.map((p, i) => (
                  <TableRow key={p.id || i}>
                    <TableCell>{p.numero_parcela}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-24"
                        value={p.valor_parcela}
                        onChange={(e) => updateParcelaLocal(i, 'valor_parcela', parseFloat(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={p.data_vencimento || ''}
                        onChange={(e) => updateParcelaLocal(i, 'data_vencimento', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={p.data_pagamento || ''}
                        onChange={(e) => updateParcelaLocal(i, 'data_pagamento', e.target.value || null)}
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={p.status} onValueChange={(v) => updateParcelaLocal(i, 'status', v)}>
                        <SelectTrigger className="w-[110px]">
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
                      <Textarea
                        className="min-w-[180px] min-h-[36px] h-9 resize-none"
                        value={p.observacao || ''}
                        onChange={(e) => updateParcelaLocal(i, 'observacao', e.target.value)}
                        placeholder="Observação..."
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeParcela(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
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
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
