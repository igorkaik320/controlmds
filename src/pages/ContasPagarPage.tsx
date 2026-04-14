import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, Eye, Calendar, Building, CheckSquare } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { 
  fetchContasPagar, 
  saveContaPagar, 
  updateContaPagar, 
  deleteContaPagar,
  saveParcelas,
  gerarParcelas,
  updateParcelasStatus,
  ContaPagarComParcelas,
  ContaPagarParcela
} from '@/lib/contasPagarService';
import { fetchEmpresas } from '@/lib/empresasService';
import { fetchFornecedores, Fornecedor } from '@/lib/comprasService';
import ContasPagarParcelasDialog from '@/components/ContasPagarParcelasDialog';
import FornecedorSelect from '@/components/compras/FornecedorSelect';

interface Empresa {
  id: string;
  nome: string;
}

export default function ContasPagarPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const [items, setItems] = useState<ContaPagarComParcelas[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showParcelasDialog, setShowParcelasDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contaParcelas, setContaParcelas] = useState<ContaPagarComParcelas | null>(null);
  const [selectedParcelas, setSelectedParcelas] = useState<Set<string>>(new Set());
  const [showBulkStatus, setShowBulkStatus] = useState(false);
  
  // Filtros
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterFornecedor, setFilterFornecedor] = useState('');
  const [filterDataEmissao, setFilterDataEmissao] = useState('');
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    empresa: '',
    fornecedor: '',
    dataEmissao: '',
  });

  const [form, setForm] = useState({
    data_emissao: new Date().toISOString().split('T')[0],
    data_primeiro_vencimento: new Date().toISOString().split('T')[0],
    empresa_id: '',
    fornecedor_id: '',
    valor_total: '',
    quantidade_parcelas: '1',
    observacao: '',
  });

  const load = useCallback(async () => {
    try {
      const [contasData, empresasData, fornecedoresData] = await Promise.all([
        fetchContasPagar(),
        fetchEmpresas().catch(() => []),
        fetchFornecedores().catch(() => []),
      ]);
      setItems(contasData);
      setEmpresas(empresasData);
      setFornecedores(fornecedoresData);
    } catch (e: any) {
      toast.error('Erro ao carregar dados: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((i) => {
    if (!filtrosAplicados.empresa && !filtrosAplicados.fornecedor && !filtrosAplicados.dataEmissao) return true;
    if (filtrosAplicados.empresa && i.empresa_id !== filtrosAplicados.empresa) return false;
    if (filtrosAplicados.fornecedor && i.fornecedor_id !== filtrosAplicados.fornecedor) return false;
    if (filtrosAplicados.dataEmissao && i.data_emissao !== filtrosAplicados.dataEmissao) return false;
    return true;
  });

  // Flatten all parcelas for inline display
  const allParcelas = filtered.flatMap(conta => 
    conta.parcelas.map(p => ({ ...p, conta }))
  );

  function handleConsultar() {
    setFiltrosAplicados({
      empresa: filterEmpresa,
      fornecedor: filterFornecedor,
      dataEmissao: filterDataEmissao,
    });
  }

  function openNew() {
    setEditingId(null);
    setForm({
      data_emissao: new Date().toISOString().split('T')[0],
      data_primeiro_vencimento: new Date().toISOString().split('T')[0],
      empresa_id: '',
      fornecedor_id: '',
      valor_total: '',
      quantidade_parcelas: '1',
      observacao: '',
    });
    setShowDialog(true);
  }

  function openEdit(item: ContaPagarComParcelas) {
    setEditingId(item.id);
    setForm({
      data_emissao: item.data_emissao,
      data_primeiro_vencimento: item.data_primeiro_vencimento || item.data_emissao,
      empresa_id: item.empresa_id || '',
      fornecedor_id: item.fornecedor_id || '',
      valor_total: item.valor_total.toString(),
      quantidade_parcelas: item.quantidade_parcelas.toString(),
      observacao: item.observacao || '',
    });
    setShowDialog(true);
  }

  function openParcelas(item: ContaPagarComParcelas) {
    setContaParcelas(item);
    setShowParcelasDialog(true);
  }

  async function handleParcelasSave() {
    await load();
  }

  function handleFornecedorSelect(f: Fornecedor) {
    setForm((prev) => ({ ...prev, fornecedor_id: f.id }));
  }

  async function handleSubmit() {
    if (!user || !form.valor_total || !form.empresa_id || !form.fornecedor_id) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const empresa = empresas.find(e => e.id === form.empresa_id);
      const fornecedor = fornecedores.find(f => f.id === form.fornecedor_id);
      
      const payload = {
        data_emissao: form.data_emissao,
        data_primeiro_vencimento: form.data_primeiro_vencimento || null,
        empresa_id: form.empresa_id,
        empresa_nome: empresa?.nome || '',
        fornecedor_id: form.fornecedor_id,
        fornecedor_nome: fornecedor?.nome_fornecedor || '',
        valor_total: parseFloat(form.valor_total),
        quantidade_parcelas: parseInt(form.quantidade_parcelas),
        observacao: form.observacao.trim() || null,
        status: 'aberto' as const,
        created_by: user.id,
      };

      if (editingId) {
        await updateContaPagar(editingId, payload, user.id);
        toast.success('Conta atualizada');
      } else {
        const savedConta = await saveContaPagar(payload, user.id);
        
        const parcelas = gerarParcelas(
          savedConta.id,
          payload.valor_total,
          payload.quantidade_parcelas,
          form.data_primeiro_vencimento || form.data_emissao,
          user.id
        );
        await saveParcelas(parcelas, user.id);
        
        toast.success('Conta cadastrada com parcelas geradas');
      }

      setShowDialog(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta conta e todas as parcelas?')) return;
    try {
      await deleteContaPagar(id, user?.id || '');
      toast.success('Conta excluída');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  // Toggle parcela selection
  function toggleParcela(parcelaId: string) {
    setSelectedParcelas(prev => {
      const next = new Set(prev);
      if (next.has(parcelaId)) next.delete(parcelaId);
      else next.add(parcelaId);
      return next;
    });
  }

  // Bulk status change
  async function handleBulkStatusChange(newStatus: string) {
    if (selectedParcelas.size === 0) return;
    try {
      await updateParcelasStatus(Array.from(selectedParcelas), newStatus, user?.id || '');
      toast.success(`${selectedParcelas.size} parcela(s) atualizada(s) para "${newStatus}"`);
      setSelectedParcelas(new Set());
      setShowBulkStatus(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  // Inline single parcela status change
  async function handleInlineStatusChange(parcelaId: string, newStatus: string) {
    try {
      await updateParcelasStatus([parcelaId], newStatus, user?.id || '');
      toast.success('Status atualizado');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      aberto: { label: 'Aberto', variant: 'default' },
      pago: { label: 'Pago', variant: 'secondary' },
      cancelado: { label: 'Cancelado', variant: 'destructive' },
    };
    const config = variants[status] || { label: status, variant: 'default' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }

  function getParcelaStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    const map: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      aberta: 'default',
      paga: 'secondary',
      vencida: 'destructive',
      cancelada: 'outline',
    };
    return map[status] || 'default';
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Contas a Pagar</h2>
        <div className="flex gap-2">
          {selectedParcelas.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{selectedParcelas.size} selecionada(s)</span>
              <Select onValueChange={handleBulkStatusChange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Alterar status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberta">Aberta</SelectItem>
                  <SelectItem value="paga">Paga</SelectItem>
                  <SelectItem value="vencida">Vencida</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {canCreate('contas_pagar') && (
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" />
              Nova Conta
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <Label className="text-xs">Empresa</Label>
          <Select value={filterEmpresa || "_all"} onValueChange={(v) => setFilterEmpresa(v === "_all" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as empresas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas as empresas</SelectItem>
              {empresas.map((empresa) => (
                <SelectItem key={empresa.id} value={empresa.id}>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    {empresa.nome}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <FornecedorSelect
            value={filterFornecedor}
            onChange={(v) => setFilterFornecedor(v)}
            onFornecedorSelect={(f) => setFilterFornecedor(f.id)}
            fornecedores={fornecedores}
            valueMode="id"
            label="Fornecedor"
            placeholder="Todos os fornecedores"
          />
        </div>
        <div>
          <Label className="text-xs">Data de Emissão</Label>
          <Input type="date" value={filterDataEmissao} onChange={(e) => setFilterDataEmissao(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button onClick={handleConsultar} className="w-full">
            <Calendar className="h-4 w-4 mr-2" />
            Consultar
          </Button>
        </div>
      </div>

      {/* Tabela de Contas com Parcelas expandidas */}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <CheckSquare className="h-4 w-4 text-muted-foreground" />
              </TableHead>
              <TableHead>Nº</TableHead>
              <TableHead>Data Emissão</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor Parcela</TableHead>
              <TableHead>Status Parcela</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground">
                  Nenhuma conta encontrada
                </TableCell>
              </TableRow>
            )}

            {filtered.map((conta) => {
              const parcelas = conta.parcelas.sort((a, b) => a.numero_parcela - b.numero_parcela);
              const rowCount = Math.max(parcelas.length, 1);

              return parcelas.length > 0 ? (
                parcelas.map((parcela, idx) => (
                  <TableRow key={`${conta.id}-${parcela.id}`}>
                    <TableCell>
                      <Checkbox
                        checked={selectedParcelas.has(parcela.id)}
                        onCheckedChange={() => toggleParcela(parcela.id)}
                      />
                    </TableCell>
                    {idx === 0 && (
                      <>
                        <TableCell rowSpan={rowCount} className="font-bold text-primary align-top">
                          {conta.numero}
                        </TableCell>
                        <TableCell rowSpan={rowCount} className="align-top">
                          {new Date(conta.data_emissao + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell rowSpan={rowCount} className="font-medium align-top">{conta.empresa_nome || '-'}</TableCell>
                        <TableCell rowSpan={rowCount} className="align-top">{conta.fornecedor_nome || '-'}</TableCell>
                        <TableCell rowSpan={rowCount} className="font-mono align-top">{formatCurrency(conta.valor_total)}</TableCell>
                      </>
                    )}
                    <TableCell className="text-center">{parcela.numero_parcela}/{conta.quantidade_parcelas}</TableCell>
                    <TableCell>
                      {parcela.data_vencimento 
                        ? new Date(parcela.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') 
                        : '-'}
                    </TableCell>
                    <TableCell className="font-mono">{formatCurrency(parcela.valor_parcela)}</TableCell>
                    <TableCell>
                      <Select
                        value={parcela.status}
                        onValueChange={(v) => handleInlineStatusChange(parcela.id, v)}
                      >
                        <SelectTrigger className="h-7 w-[110px]">
                          <Badge variant={getParcelaStatusVariant(parcela.status)} className="text-xs">
                            {parcela.status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aberta">Aberta</SelectItem>
                          <SelectItem value="paga">Paga</SelectItem>
                          <SelectItem value="vencida">Vencida</SelectItem>
                          <SelectItem value="cancelada">Cancelada</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">{parcela.observacao || conta.observacao || '-'}</TableCell>
                    {idx === 0 && (
                      <TableCell rowSpan={rowCount} className="align-top">
                        <div className="flex flex-col gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openParcelas(conta)}>
                            <Eye className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          {canEdit('contas_pagar') && (
                            <Button variant="ghost" size="icon" onClick={() => openEdit(conta)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete('contas_pagar') && (
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(conta.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow key={conta.id}>
                  <TableCell />
                  <TableCell className="font-bold text-primary">{conta.numero}</TableCell>
                  <TableCell>{new Date(conta.data_emissao + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="font-medium">{conta.empresa_nome || '-'}</TableCell>
                  <TableCell>{conta.fornecedor_nome || '-'}</TableCell>
                  <TableCell className="font-mono">{formatCurrency(conta.valor_total)}</TableCell>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">Sem parcelas</TableCell>
                  <TableCell>{conta.observacao || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openParcelas(conta)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Parcelas
                      </Button>
                      {canEdit('contas_pagar') && (
                        <Button variant="ghost" size="icon" onClick={() => openEdit(conta)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete('contas_pagar') && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(conta.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Diálogo de Nova/Editar Conta */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nova'} Conta a Pagar</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Emissão *</Label>
                <Input 
                  type="date"
                  value={form.data_emissao} 
                  onChange={(e) => setForm((p) => ({ ...p, data_emissao: e.target.value }))} 
                />
              </div>
              <div>
                <Label>1º Vencimento *</Label>
                <Input 
                  type="date"
                  value={form.data_primeiro_vencimento} 
                  onChange={(e) => setForm((p) => ({ ...p, data_primeiro_vencimento: e.target.value }))} 
                />
              </div>
            </div>

            <div>
              <Label>Empresa *</Label>
              <Select value={form.empresa_id || undefined} onValueChange={(value) => setForm((p) => ({ ...p, empresa_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id}>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        {empresa.nome}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Fornecedor *</Label>
              <FornecedorSelect
                value={form.fornecedor_id}
                onChange={(v) => setForm((p) => ({ ...p, fornecedor_id: v }))}
                onFornecedorSelect={handleFornecedorSelect}
                valueMode="id"
                label=""
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor Total *</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={form.valor_total} 
                  onChange={(e) => setForm((p) => ({ ...p, valor_total: e.target.value }))} 
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Quantidade de Parcelas *</Label>
                <Select value={form.quantidade_parcelas} onValueChange={(value) => setForm((p) => ({ ...p, quantidade_parcelas: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {num === 1 ? 'parcela' : 'parcelas'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview das parcelas */}
            {!editingId && form.valor_total && parseInt(form.quantidade_parcelas) > 0 && (
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <p className="font-medium text-xs text-muted-foreground">Prévia das parcelas:</p>
                {Array.from({ length: parseInt(form.quantidade_parcelas) }, (_, i) => {
                  const val = parseFloat(form.valor_total) / parseInt(form.quantidade_parcelas);
                  const dt = new Date(`${form.data_primeiro_vencimento || form.data_emissao}T00:00:00`);
                  dt.setMonth(dt.getMonth() + i);
                  return (
                    <div key={i} className="flex justify-between text-xs">
                      <span>Parcela {i + 1}: {dt.toLocaleDateString('pt-BR')}</span>
                      <span className="font-mono">{formatCurrency(val)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <Label>Observação</Label>
              <Input 
                value={form.observacao} 
                onChange={(e) => setForm((p) => ({ ...p, observacao: e.target.value }))} 
                placeholder="Observações sobre a conta..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>{editingId ? 'Atualizar' : 'Cadastrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Edição de Parcelas */}
      <ContasPagarParcelasDialog
        open={showParcelasDialog}
        onClose={() => setShowParcelasDialog(false)}
        contaPagarId={contaParcelas?.id || ''}
        parcelas={contaParcelas?.parcelas || []}
        onSave={handleParcelasSave}
        userId={user?.id || ''}
      />
    </div>
  );
}
