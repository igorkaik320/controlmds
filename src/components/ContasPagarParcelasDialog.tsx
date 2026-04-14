import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { formatCurrency, formatCurrencyInput, formatCurrencyReal, parseCurrencyInput } from '@/lib/formatters';
import {
  ContaPagarParcela,
  updateParcela,
  saveParcelas,
  deleteParcela,
  updateContaPagar
} from '@/lib/contasPagarService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  contaPagarId: string;
  parcelas: ContaPagarParcela[];
  onSave: (parcelas: ContaPagarParcela[], total: number) => void;
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
  const [removedParcelas, setRemovedParcelas] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setParcelas(initialParcelas?.length ? [...initialParcelas] : []);
    }
  }, [open, initialParcelas]);

  function addParcela() {
    // Adicionar nova parcela com valor 0 para que o usuário possa definir o valor
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
    // Remover a parcela e renumerar as restantes sem redistribuir valor
    const novasParcelas = parcelas.filter((_, i) => i !== index);
    
    // Reenumerar as parcelas restantes
    const renumeradas = novasParcelas.map((p, i) => ({
      ...p,
      numero_parcela: i + 1
    }));
    
    if (parcelas[index]?.id) {
      setRemovedParcelas((prev) => [...prev, parcelas[index].id]);
    }
    setParcelas(renumeradas);
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

      await updateContaPagar(contaPagarId, {
        valor_total: total,
        quantidade_parcelas: parcelas.length
      }, userId);

      if (removedParcelas.length > 0) {
        for (const id of removedParcelas) {
          await deleteParcela(id, userId);
        }
      }

      onSave(parcelas, total);
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
      <DialogContent className="max-w-full max-h-[85vh]">
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

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="w-32">Valor</TableHead>
                  <TableHead className="w-32">Vencimento</TableHead>
                  <TableHead className="w-32">Pagamento</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {parcelas.map((p, i) => (
                  <TableRow key={p.id || i}>
                    <TableCell>{p.numero_parcela}</TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        className="w-28"
                        value={formatCurrencyReal(p.valor_parcela)}
                        onChange={(e) => updateParcelaLocal(i, 'valor_parcela', parseCurrencyInput(e.target.value))}
                        placeholder="R$ 0,00"
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
                        <SelectTrigger className="w-24">
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
