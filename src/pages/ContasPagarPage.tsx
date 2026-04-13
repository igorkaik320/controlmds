import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Eye, Calendar, DollarSign, Building, User } from 'lucide-react';
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
  updateParcela,
  deleteParcela,
  gerarParcelas,
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
  
  // Filtros separados
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
    empresa_id: '',
    fornecedor_id: '',
    valor_total: '',
    quantidade_parcelas: '1',
    observacao: '',
  });

  const load = useCallback(async () => {
    try {
      console.log('Carregando dados para contas a pagar...');
      
      const contasData = await fetchContasPagar();
      console.log('Contas carregadas:', contasData.length);
      
      let empresasData: Empresa[] = [];
      let fornecedoresData: Fornecedor[] = [];
      
      try {
        empresasData = await fetchEmpresas();
        console.log('Empresas carregadas:', empresasData.length);
      } catch (e: any) {
        console.error('Erro ao carregar empresas:', e);
        toast.error('Erro ao carregar empresas: ' + e.message);
      }
      
      try {
        fornecedoresData = await fetchFornecedores();
        console.log('Fornecedores carregados:', fornecedoresData.length);
      } catch (e: any) {
        console.error('Erro ao carregar fornecedores:', e);
        toast.error('Erro ao carregar fornecedores: ' + e.message);
      }

      setItems(contasData);
      setEmpresas(empresasData);
      setFornecedores(fornecedoresData);
    } catch (e: any) {
      console.error('Erro ao carregar contas:', e);
      toast.error('Erro ao carregar dados: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((i) => {
    // Se não há filtros aplicados, retorna todos
    if (!filtrosAplicados.empresa && !filtrosAplicados.fornecedor && !filtrosAplicados.dataEmissao) {
      return true;
    }
    
    // Filtro por empresa
    if (filtrosAplicados.empresa && i.empresa_id !== filtrosAplicados.empresa) {
      return false;
    }
    
    // Filtro por fornecedor
    if (filtrosAplicados.fornecedor && i.fornecedor_id !== filtrosAplicados.fornecedor) {
      return false;
    }
    
    // Filtro por data de emissão
    if (filtrosAplicados.dataEmissao && i.data_emissao !== filtrosAplicados.dataEmissao) {
      return false;
    }
    
    return true;
  });

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

  async function handleParcelasSave(parcelasAtualizadas: ContaPagarParcela[]) {
    // Recarregar os dados para atualizar a lista
    await load();
  }

  function handleFornecedorSelect(f: Fornecedor) {
    setForm((prev) => ({
      ...prev,
      fornecedor_id: f.id,
    }));
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

      let savedConta;
      if (editingId) {
        savedConta = await updateContaPagar(editingId, payload, user.id);
        toast.success('Conta atualizada');
      } else {
        savedConta = await saveContaPagar(payload, user.id);
        
        // Gerar parcelas automaticamente
        const parcelas = gerarParcelas(
          savedConta.id,
          payload.valor_total,
          payload.quantidade_parcelas,
          payload.data_emissao,
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

  function getStatusBadge(status: string) {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      aberto: { label: 'Aberto', variant: 'default' },
      pago: { label: 'Pago', variant: 'secondary' },
      cancelado: { label: 'Cancelado', variant: 'destructive' },
    };
    
    const config = variants[status] || { label: status, variant: 'default' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }

  function getParcelaStatusBadge(status: string) {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      aberta: { label: 'Aberta', variant: 'default' },
      paga: { label: 'Paga', variant: 'secondary' },
      vencida: { label: 'Vencida', variant: 'destructive' },
      cancelada: { label: 'Cancelada', variant: 'outline' },
    };
    
    const config = variants[status] || { label: status, variant: 'default' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Contas a Pagar</h2>
        {canCreate('contas_pagar') && (
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" />
            Nova Conta
          </Button>
        )}
      </div>

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
          <Label className="text-xs">Fornecedor</Label>
          <Select value={filterFornecedor || "_all"} onValueChange={(v) => setFilterFornecedor(v === "_all" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os fornecedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos os fornecedores</SelectItem>
              {fornecedores.map((fornecedor) => (
                <SelectItem key={fornecedor.id} value={fornecedor.id}>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {fornecedor.nome_fornecedor}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Data de Emissão</Label>
          <Input
            type="date"
            value={filterDataEmissao}
            onChange={(e) => setFilterDataEmissao(e.target.value)}
            placeholder="Todas as datas"
          />
        </div>

        <div className="flex items-end">
          <Button onClick={handleConsultar} className="w-full">
            <Calendar className="h-4 w-4 mr-2" />
            Consultar
          </Button>
        </div>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data Emissão</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead>Parcelas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Nenhuma conta encontrada
                </TableCell>
              </TableRow>
            )}

            {filtered.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{new Date(i.data_emissao).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell className="font-medium">{i.empresa_nome || '-'}</TableCell>
                <TableCell>{i.fornecedor_nome || '-'}</TableCell>
                <TableCell className="font-mono">{formatCurrency(i.valor_total)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => openParcelas(i)}>
                    <Eye className="h-4 w-4 mr-1" />
                    {i.quantidade_parcelas} parcelas
                  </Button>
                </TableCell>
                <TableCell>{getStatusBadge(i.status)}</TableCell>
                <TableCell className="max-w-[200px] truncate">{i.observacao || '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {canEdit('contas_pagar') && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(i)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete('contas_pagar') && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(i.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
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
            <div>
              <Label>Data de Emissão *</Label>
              <Input 
                type="date"
                value={form.data_emissao} 
                onChange={(e) => setForm((p) => ({ ...p, data_emissao: e.target.value }))} 
              />
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
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {editingId ? 'Atualizar' : 'Cadastrar'}
            </Button>
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
