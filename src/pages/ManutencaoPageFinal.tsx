import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, Calendar, DollarSign, Bell, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { formatCurrencyInput, parseCurrencyInput } from '@/lib/formatters';
import FornecedorSelect from '@/components/compras/FornecedorSelect';
import type { Fornecedor } from '@/lib/comprasService';
import { formatCurrencyBR } from '@/lib/comprasService';
import { useMaintenanceNotifications } from '@/lib/maintenanceNotifications';

interface Equipamento {
  id: string;
  nome: string;
  setor_id?: string;
  setor_nome?: string;
}

interface Setor {
  id: string;
  nome: string;
}

interface Manutencao {
  id: string;
  equipamento_id: string;
  equipamento_nome: string;
  setor_id: string;
  setor_nome: string;
  fornecedor_id?: string;
  fornecedor_nome?: string;
  data: string;
  valor: number;
  proxima_manutencao: string;
  avisar_dias_antes: number;
  ativo: boolean;
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
}

interface NotificationItem extends Manutencao {
  diasDiff: number;
}

const SELECT_NONE_VALUE = '__none__';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const parseDateOnly = (value: string | null | undefined) => {
  if (!value || typeof value !== 'string') return new Date();
  try {
    const onlyDate = value.split('T')[0];
    return new Date(`${onlyDate}T00:00:00`);
  } catch {
    return new Date();
  }
};

const formatLocalDate = (value: string) => parseDateOnly(value).toLocaleDateString('pt-BR');
const formatCurrencyForInput = (value: number) => formatCurrencyInput(String(Math.round(value * 100)));

export default function ManutencaoPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const [items, setItems] = useState<Manutencao[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    equipamento_id: '',
    setor_id: SELECT_NONE_VALUE,
    fornecedor_id: '',
    data: '',
    valor: '',
    proxima_manutencao: '',
    avisar_dias_antes: '10',
    ativo: true,
  });
  const { openNotificationDialog } = useMaintenanceNotifications();

  const load = useCallback(async () => {
    try {
      // Carregar dados em paralelo
      const [manutencoesData, equipamentosData, setoresData, fornecedoresData] = await Promise.all([
        supabase.from('manutencoes').select('*').order('created_at', { ascending: false }),
        supabase.from('equipamentos').select('*').order('nome'),
        supabase.from('setores').select('*').order('nome'),
        supabase.from<Fornecedor>('fornecedores').select('*').order('nome_fornecedor'),
      ]);

      setItems(manutencoesData.data || []);
      setEquipamentos(equipamentosData.data || []);
      setSetores(setoresData.data || []);
      setFornecedores(fornecedoresData.data || []);
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

  const selectedEquipment = useMemo(
    () => equipamentos.find((equip) => equip.id === form.equipamento_id),
    [equipamentos, form.equipamento_id]
  );
  const selectedEquipmentHasSector = Boolean(selectedEquipment?.setor_id);

  function handleEquipmentSelect(value: string) {
    const equipamento = equipamentos.find((e) => e.id === value);
    setForm((prev) => ({
      ...prev,
      equipamento_id: value,
      setor_id: equipamento?.setor_id ?? SELECT_NONE_VALUE,
    }));
  }

  function openNew() {
    setEditingId(null);
    setForm({
      equipamento_id: '',
      setor_id: SELECT_NONE_VALUE,
      fornecedor_id: '',
      data: '',
      valor: '',
      proxima_manutencao: '',
      avisar_dias_antes: '10',
      ativo: true,
    });
    setShowDialog(true);
  }

  function openEdit(item: Manutencao) {
    setEditingId(item.id);
    setForm({
      equipamento_id: item.equipamento_id,
      setor_id: item.setor_id || SELECT_NONE_VALUE,
      fornecedor_id: item.fornecedor_id || '',
      data: item.data,
      valor: formatCurrencyForInput(item.valor),
      proxima_manutencao: item.proxima_manutencao,
      avisar_dias_antes: item.avisar_dias_antes.toString(),
      ativo: item.ativo,
    });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (
      !user ||
      !form.equipamento_id ||
      form.setor_id === SELECT_NONE_VALUE ||
      !form.data ||
      !form.proxima_manutencao ||
      !form.valor
    ) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const equipamento = equipamentos.find(e => e.id === form.equipamento_id);
      const selectedSetorId = form.setor_id === SELECT_NONE_VALUE ? null : form.setor_id;
      const setor = selectedSetorId ? setores.find(s => s.id === selectedSetorId) : undefined;
      const selectedFornecedorId = form.fornecedor_id || null;
      const fornecedor = selectedFornecedorId ? fornecedores.find((f) => f.id === selectedFornecedorId) : undefined;
      const valorNumber = parseCurrencyInput(form.valor);

      const payload = {
        equipamento_id: form.equipamento_id,
        equipamento_nome: equipamento?.nome || '',
        setor_id: selectedSetorId,
        setor_nome: setor?.nome || null,
        fornecedor_id: selectedFornecedorId,
        fornecedor_nome: fornecedor?.nome_fornecedor || null,
        data: form.data,
        valor: valorNumber,
        proxima_manutencao: form.proxima_manutencao,
        avisar_dias_antes: parseInt(form.avisar_dias_antes) || 10,
        ativo: form.ativo,
      };

      if (editingId) {
        await supabase
          .from('manutencoes')
          .update({ ...payload, updated_by: user.id, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        toast.success('Manutenção atualizada');
      } else {
        await supabase
          .from('manutencoes')
          .insert({ ...payload, created_by: user.id });
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
      await supabase.from('manutencoes').delete().eq('id', id);
      load();
      toast.success('Manutenção excluída');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Manutenção de Equipamentos</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={openNotificationDialog}>
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
                <TableCell>{formatLocalDate(i.data)}</TableCell>
                  <TableCell>{formatCurrencyBR(i.valor)}</TableCell>
                  <TableCell className={estaVencido ? 'text-red-600 font-semibold' : estaProximo ? 'text-yellow-600 font-semibold' : ''}>
                    {formatLocalDate(i.proxima_manutencao)}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nova'} Manutenção</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Equipamento *</Label>
                <Select value={form.equipamento_id} onValueChange={handleEquipmentSelect}>
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
                <Select value={form.setor_id} onValueChange={(value) => setForm((p) => ({ ...p, setor_id: value }))}>
                  <SelectTrigger disabled={selectedEquipmentHasSector}>
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {setores.map((setor) => (
                      <SelectItem key={setor.id} value={setor.id}>
                        {setor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedEquipmentHasSector ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Setor vinculado ao equipamento: {selectedEquipment?.setor_nome || 'Sem setor registrado'}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    Escolha o setor manualmente caso o equipamento não esteja cadastrado em nenhum.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <FornecedorSelect
                  value={form.fornecedor_id}
                  onChange={(value) => setForm((p) => ({ ...p, fornecedor_id: value }))}
                  fornecedores={fornecedores}
                  label="Fornecedor"
                  valueMode="id"
                  placeholder="Digite nome, razao social ou CNPJ/CPF"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setForm((p) => ({ ...p, fornecedor_id: '' }))}
                    className="uppercase tracking-wide text-[11px]"
                  >
                    Nenhum
                  </Button>
                  {form.fornecedor_id && (
                    <span>
                      {fornecedores.find((f) => f.id === form.fornecedor_id)?.razao_social ||
                        fornecedores.find((f) => f.id === form.fornecedor_id)?.nome_fornecedor}
                    </span>
                  )}
                </div>
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
                  type="text"
                  value={form.valor}
                  onChange={(e) => setForm((p) => ({ ...p, valor: formatCurrencyInput(e.target.value) }))}
                  placeholder="R$ 0,00"
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
