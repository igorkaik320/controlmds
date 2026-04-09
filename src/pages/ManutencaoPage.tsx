import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, Wrench, Calendar, DollarSign, Bell, AlertTriangle } from 'lucide-react';
import FornecedorSelect from '@/components/compras/FornecedorSelect';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { 
  Manutencao, 
  fetchManutencoes, 
  saveManutencao, 
  updateManutencao, 
  deleteManutencao,
  fetchEquipamentos,
  fetchSetores 
} from '@/lib/equipamentosService';
import { fetchFornecedores } from '@/lib/comprasService';
import { toast } from 'sonner';

import type { Fornecedor } from '@/lib/comprasService';

const emptyForm = {
  equipamento_id: '',
  setor_id: '',
  fornecedor_id: '',
  data: '',
  valor: '',
  proxima_manutencao: '',
  avisar_dias_antes: '10',
  ativo: true,
};

export default function ManutencaoPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const [items, setItems] = useState<Manutencao[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [setores, setSetores] = useState<any[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try {
      const [manutencoesData, equipamentosData, setoresData, fornecedoresData] = await Promise.all([
        fetchManutencoes(),
        fetchEquipamentos(),
        fetchSetores(),
        fetchFornecedores()
      ]);

      setItems(manutencoesData);
      setEquipamentos(equipamentosData);
      setSetores(setoresData);
      setFornecedores(fornecedoresData);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((i) => {
    const s = search.toLowerCase();
    return i.equipamento_nome.toLowerCase().includes(s) || 
           i.setor_nome.toLowerCase().includes(s) ||
           (i.fornecedor_nome || '').toLowerCase().includes(s);
  });

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setShowDialog(true);
  }

  function openEdit(item: Manutencao) {
    setEditingId(item.id);
    setForm({
      equipamento_id: item.equipamento_id,
      setor_id: item.setor_id,
      fornecedor_id: item.fornecedor_id || '',
      data: item.data,
      valor: item.valor.toString(),
      proxima_manutencao: item.proxima_manutencao,
      avisar_dias_antes: item.avisar_dias_antes.toString(),
      ativo: item.ativo,
    });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user || !form.equipamento_id || !form.setor_id || !form.data || !form.proxima_manutencao) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const equipamento = equipamentos.find(e => e.id === form.equipamento_id);
      const setor = setores.find(s => s.id === form.setor_id);
      const fornecedor = fornecedores.find(f => f.id === form.fornecedor_id);

      const payload = {
        equipamento_id: form.equipamento_id,
        equipamento_nome: equipamento?.nome || '',
        setor_id: form.setor_id,
        setor_nome: setor?.nome || '',
        fornecedor_id: form.fornecedor_id || null,
        fornecedor_nome: fornecedor?.nome_fornecedor || null,
        data: form.data,
        valor: parseFloat(form.valor) || 0,
        proxima_manutencao: form.proxima_manutencao,
        avisar_dias_antes: parseInt(form.avisar_dias_antes) || 10,
        ativo: form.ativo,
        created_by: user.id,
      };

      if (editingId) {
        await updateManutencao(editingId, payload);
        toast.success('Manutenção atualizada');
      } else {
        await saveManutencao(payload, user.id);
        toast.success('Manutenção cadastrada');
      }

      setShowDialog(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta manutenção?')) return;

    try {
      await deleteManutencao(id);
      load();
      toast.success('Manutenção excluída');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function verificarManutencoesProximas() {
    const hoje = new Date();
    const manutencoesProximas = items.filter(item => {
      if (!item.ativo) return false;
      const dataProxima = new Date(item.proxima_manutencao);
      const diasDiff = Math.ceil((dataProxima.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      return diasDiff <= item.avisar_dias_antes && diasDiff >= 0;
    });

    if (manutencoesProximas.length > 0) {
      manutencoesProximas.forEach(item => {
        const dataProxima = new Date(item.proxima_manutencao);
        const diasDiff = Math.ceil((dataProxima.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        const fornecedorInfo = item.fornecedor_nome ? ` - Fornecedor: ${item.fornecedor_nome}` : '';
        toast.warning(`⚠️ Manutenção próxima: ${item.equipamento_nome} (${item.setor_nome})${fornecedorInfo} - Faltam ${diasDiff} dias`, {
          duration: 10000,
        });
      });
    } else {
      toast.info('Nenhuma manutenção próxima encontrada');
    }
  }

  useEffect(() => {
    // Verificar notificações ao carregar a página
    verificarManutencoesProximas();
    
    // Configurar verificação periódica (a cada 5 minutos)
    const interval = setInterval(verificarManutencoesProximas, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [items]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;
  }

  const selectedEquipment = equipamentos.find((equip) => equip.id === form.equipamento_id);
  const setorSelectValue = form.setor_id || 'none';
  const isSectorLocked = Boolean(selectedEquipment?.setor_id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Manutenção de Equipamentos</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={verificarManutencoesProximas}>
            <Bell className="h-4 w-4 mr-1" />
            Verificar Notificações
          </Button>
          {canCreate('manutencao_equipamentos') && (
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" />
              Nova Manutenção
            </Button>
          )}
        </div>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por equipamento, setor ou fornecedor..."
        className="max-w-sm"
      />

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipamento</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Data da Manutenção</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Próxima Manutenção</TableHead>
              <TableHead>Aviso (dias)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  Nenhuma manutenção encontrada
                </TableCell>
              </TableRow>
            )}

            {filtered.map((i) => {
              const hoje = new Date();
              const dataProxima = new Date(i.proxima_manutencao);
              const diasDiff = Math.ceil((dataProxima.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
              const estaProximo = i.ativo && diasDiff <= i.avisar_dias_antes && diasDiff >= 0;
              const estaVencido = i.ativo && diasDiff < 0;

              return (
                <TableRow key={i.id} className={estaVencido ? 'bg-red-50' : estaProximo ? 'bg-yellow-50' : ''}>
                  <TableCell className="font-medium">{i.equipamento_nome}</TableCell>
                  <TableCell>{i.setor_nome}</TableCell>
                  <TableCell>{i.fornecedor_nome || '-'}</TableCell>
                  <TableCell>{new Date(i.data).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>R$ {i.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className={estaVencido ? 'text-red-600 font-semibold' : estaProximo ? 'text-yellow-600 font-semibold' : ''}>
                    {new Date(i.proxima_manutencao).toLocaleDateString('pt-BR')}
                    {estaVencido && ' (Vencido)'}
                    {estaProximo && !estaVencido && ` (${diasDiff} dias)`}
                  </TableCell>
                  <TableCell>{i.avisar_dias_antes} dias</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        i.ativo 
                          ? estaVencido 
                            ? 'bg-red-100 text-red-800' 
                            : estaProximo 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {i.ativo ? (estaVencido ? 'Vencido' : estaProximo ? 'Próximo' : 'Ativo') : 'Inativo'}
                      </span>
                      {estaProximo && (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {canEdit('manutencao_equipamentos') && (
                        <Button variant="ghost" size="icon" onClick={() => openEdit(i)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete('manutencao_equipamentos') && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(i.id)}>
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

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="w-[min(95vw,1000px)] max-w-[1000px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nova'} Manutenção</DialogTitle>
            <DialogDescription>Preencha os dados da manutenção e mantenha o setor vinculado ao equipamento.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Equipamento *</Label>
                <Select
                  value={form.equipamento_id}
                  onValueChange={(value) => {
                    const selected = equipamentos.find((equip) => equip.id === value);
                    setForm((p) => ({
                      ...p,
                      equipamento_id: value,
                      setor_id: selected?.setor_id || '',
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o equipamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipamentos.map((equip) => (
                      <SelectItem key={equip.id} value={equip.id}>
                        {equip.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Setor *</Label>
                <Select
                  value={setorSelectValue}
                  disabled={isSectorLocked}
                  onValueChange={(value) => setForm((p) => ({ ...p, setor_id: value === 'none' ? '' : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isSectorLocked ? 'Setor vinculado ao equipamento' : 'Selecione o setor'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {setores.map((setor) => (
                      <SelectItem key={setor.id} value={setor.id}>
                        {setor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-3">
                <FornecedorSelect
                  value={form.fornecedor_id}
                  onChange={(value) => setForm((p) => ({ ...p, fornecedor_id: value }))}
                  fornecedores={fornecedores}
                  valueMode="id"
                  placeholder="Selecione ou digite..."
                  label="Fornecedor"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data da Manutenção *</Label>
                <Input 
                  type="date"
                  value={form.data} 
                  onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} 
                />
              </div>

              <div>
                <Label>Valor (R$)</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={form.valor} 
                  onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))} 
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Próxima Manutenção *</Label>
                <Input 
                  type="date"
                  value={form.proxima_manutencao} 
                  onChange={(e) => setForm((p) => ({ ...p, proxima_manutencao: e.target.value }))} 
                />
              </div>

              <div>
                <Label>Avisar (dias antes)</Label>
                <Select value={form.avisar_dias_antes} onValueChange={(value) => setForm((p) => ({ ...p, avisar_dias_antes: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 dias</SelectItem>
                    <SelectItem value="10">10 dias</SelectItem>
                    <SelectItem value="15">15 dias</SelectItem>
                    <SelectItem value="20">20 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="ativo" 
                checked={form.ativo}
                onCheckedChange={(checked) => setForm((p) => ({ ...p, ativo: checked as boolean }))}
              />
              <Label htmlFor="ativo">Manutenção ativa (receber notificações)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
