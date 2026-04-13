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

export default function ContasPagarPageStable() {
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
  const [search, setSearch] = useState('');
  
  const [form, setForm] = useState({
    data_emissao: new Date().toISOString().split('T')[0],
    empresa_id: '',
    fornecedor_id: '',
    valor_total: '',
    quantidade_parcelas: '1',
    observacao: '',
  });

  const load = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
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
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((i) => {
    const s = search.toLowerCase();
    return (
      i.empresa_nome?.toLowerCase().includes(s) ||
      i.fornecedor_nome?.toLowerCase().includes(s) ||
      i.observacao?.toLowerCase().includes(s) ||
      i.valor_total.toString().includes(s)
    );
  });

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
      
      if (!empresa || !fornecedor) {
        toast.error('Empresa ou fornecedor não encontrados');
        return;
      }

      const payload = {
        data_emissao: form.data_emissao,
        empresa_id: form.empresa_id,
        empresa_nome: empresa.nome,
        fornecedor_id: form.fornecedor_id,
        fornecedor_nome: fornecedor.nome_fornecedor,
        valor_total: parseFloat(form.valor_total),
        quantidade_parcelas: parseInt(form.quantidade_parcelas),
        observacao: form.observacao,
      };

      if (editingId) {
        await updateContaPagar(editingId, payload, user.id);
        toast.success('Conta atualizada com sucesso!');
      } else {
        await saveContaPagar(payload, user.id);
        toast.success('Conta criada com sucesso!');
      }
      
      setShowDialog(false);
      await load();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir esta conta?')) return;
    
    try {
      await deleteContaPagar(id, user.id);
      toast.success('Conta excluída com sucesso!');
      await load();
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    }
  }

  function openParcelas(item: ContaPagarComParcelas) {
    setContaParcelas(item);
    setShowParcelasDialog(true);
  }

  async function handleParcelasSave(parcelasAtualizadas: ContaPagarParcela[]) {
    await load();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-center text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Financeiro</p>
        <h1 className="text-2xl font-bold">Contas a Pagar</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre e gerencie suas contas a pagar com parcelas automáticas.
        </p>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-2xl font-bold">Contas a Pagar</h2>
          {canCreate('contas_pagar') && (
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" />
              Nova Conta
            </Button>
          )}
        </div>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por empresa, fornecedor, observação..."
          className="max-w-sm"
        />

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
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.data_emissao}</TableCell>
                  <TableCell>
                    <div className="font-medium">{i.empresa_nome || '-'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{i.fornecedor_nome || '-'}</div>
                  </TableCell>
                  <TableCell className="font-mono">{formatCurrency(i.valor_total)}</TableCell>
                  <TableCell>
                    <Badge variant={i.status === 'pago' ? 'default' : 'secondary'}>
                      {i.quantidade_parcelas} parcela{i.quantidade_parcelas > 1 ? 's' : ''}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={i.status === 'pago' ? 'default' : 'secondary'}>
                      {i.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {canEdit('contas_pagar') && (
                        <Button variant="ghost" size="icon" onClick={() => openEdit(i)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openParcelas(i)}>
                        <Eye className="h-4 w-4 mr-1" />
                        {i.quantidade_parcelas} parcelas
                      </Button>
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
      </section>

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
              <Select value={form.empresa_id} onValueChange={(value) => setForm((p) => ({ ...p, empresa_id: value }))}>
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
              <Input 
                type="number"
                min="1"
                value={form.quantidade_parcelas} 
                onChange={(e) => setForm((p) => ({ ...p, quantidade_parcelas: e.target.value }))} 
              />
            </div>
            <div>
              <Label>Observação</Label>
              <Input 
                value={form.observacao} 
                onChange={(e) => setForm((p) => ({ ...p, observacao: e.target.value }))} 
                placeholder="Observações sobre esta conta"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleSubmit}>
              {editingId ? 'Atualizar' : 'Criar'} Conta
            </Button>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
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
    </main>
  );
}
