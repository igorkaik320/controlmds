import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, Calendar, DollarSign, Bell, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Equipamento {
  id: string;
  nome: string;
}

interface Setor {
  id: string;
  nome: string;
}

interface Fornecedor {
  id: string;
  nome_fornecedor: string;
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
  created_at: string;
}

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
  const [items, setItems] = useState<Manutencao[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    // Carregar dados do localStorage ou usar dados mockados
    const loadInitialData = () => {
      try {
        const storedManutencoes = localStorage.getItem('manutencoes');
        const storedEquipamentos = localStorage.getItem('equipamentos');
        const storedSetores = localStorage.getItem('setores');
        const storedFornecedores = localStorage.getItem('fornecedores');
        
        const mockSetores: Setor[] = storedSetores ? JSON.parse(storedSetores) : [
          { id: '1', nome: 'Administração' },
          { id: '2', nome: 'Produção' },
          { id: '3', nome: 'Manutenção' },
          { id: '4', nome: 'Almoxarifado' },
        ];
        
        const mockEquipamentos: Equipamento[] = storedEquipamentos ? JSON.parse(storedEquipamentos) : [
          { id: '1', nome: 'Escavadeira CAT 320' },
          { id: '2', nome: 'Pá Carregadeira' },
          { id: '3', nome: 'Trator Agrícola' },
          { id: '4', nome: 'Caminção Basculante' },
        ];
        
        const mockFornecedores: Fornecedor[] = storedFornecedores ? JSON.parse(storedFornecedores) : [
          { id: '1', nome_fornecedor: 'Mecânica Central' },
          { id: '2', nome_fornecedor: 'Peças e Serviços LTDA' },
          { id: '3', nome_fornecedor: 'Auto Peças Brasil' },
        ];
        
        const mockManutencoes: Manutencao[] = storedManutencoes ? JSON.parse(storedManutencoes) : [
          {
            id: '1',
            equipamento_id: '1',
            equipamento_nome: 'Escavadeira CAT 320',
            setor_id: '2',
            setor_nome: 'Produção',
            fornecedor_id: '1',
            fornecedor_nome: 'Mecânica Central',
            data: '2024-01-15',
            valor: 5000,
            proxima_manutencao: '2024-04-15',
            avisar_dias_antes: 10,
            ativo: true,
            created_at: new Date().toISOString(),
          },
          {
            id: '2',
            equipamento_id: '2',
            equipamento_nome: 'Pá Carregadeira',
            setor_id: '3',
            setor_nome: 'Manutenção',
            fornecedor_id: '2',
            fornecedor_nome: 'Peças e Serviços LTDA',
            data: '2024-02-20',
            valor: 3500,
            proxima_manutencao: '2024-05-20',
            avisar_dias_antes: 15,
            ativo: true,
            created_at: new Date().toISOString(),
          },
        ];
        
        setSetores(mockSetores);
        setEquipamentos(mockEquipamentos);
        setFornecedores(mockFornecedores);
        setItems(mockManutencoes);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

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

  function handleSubmit() {
    if (!form.equipamento_id || !form.setor_id || !form.data || !form.proxima_manutencao) {
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
        created_at: new Date().toISOString(),
      };

      let updatedItems: Manutencao[];
      
      if (editingId) {
        updatedItems = items.map(item => 
          item.id === editingId 
            ? { ...item, ...payload }
            : item
        );
        toast.success('Manutenção atualizada');
      } else {
        const newItem: Manutencao = {
          id: Date.now().toString(),
          ...payload,
        };
        updatedItems = [...items, newItem];
        toast.success('Manutenção cadastrada');
      }

      localStorage.setItem('manutencoes', JSON.stringify(updatedItems));
      setItems(updatedItems);
      setShowDialog(false);
      setForm(emptyForm);
      setEditingId(null);
    } catch (e: any) {
      console.error('Erro:', e);
      toast.error('Erro ao salvar manutenção');
    }
  }

  function handleDelete(id: string) {
    if (!confirm('Excluir esta manutenção?')) return;

    try {
      const updatedItems = items.filter(item => item.id !== id);
      localStorage.setItem('manutencoes', JSON.stringify(updatedItems));
      setItems(updatedItems);
      toast.success('Manutenção excluída');
    } catch (e: any) {
      console.error('Erro:', e);
      toast.error('Erro ao excluir manutenção');
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

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Manutenção de Equipamentos</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={verificarManutencoesProximas}>
            <Bell className="h-4 w-4 mr-1" />
            Verificar Notificações
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" />
            Nova Manutenção
          </Button>
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
                      <Button variant="ghost" size="icon" onClick={() => openEdit(i)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(i.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
                <select 
                  value={form.equipamento_id} 
                  onChange={(e) => setForm((p) => ({ ...p, equipamento_id: e.target.value }))} 
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione o equipamento</option>
                  {equipamentos.map((equip) => (
                    <option key={equip.id} value={equip.id}>
                      {equip.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Setor *</Label>
                <select 
                  value={form.setor_id} 
                  onChange={(e) => setForm((p) => ({ ...p, setor_id: e.target.value }))} 
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione o setor</option>
                  {setores.map((setor) => (
                    <option key={setor.id} value={setor.id}>
                      {setor.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Fornecedor</Label>
                <select 
                  value={form.fornecedor_id} 
                  onChange={(e) => setForm((p) => ({ ...p, fornecedor_id: e.target.value }))} 
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Nenhum</option>
                  {fornecedores.map((fornecedor) => (
                    <option key={fornecedor.id} value={fornecedor.id}>
                      {fornecedor.nome_fornecedor}
                    </option>
                  ))}
                </select>
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
                <select 
                  value={form.avisar_dias_antes} 
                  onChange={(e) => setForm((p) => ({ ...p, avisar_dias_antes: e.target.value }))} 
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="5">5 dias</option>
                  <option value="10">10 dias</option>
                  <option value="15">15 dias</option>
                  <option value="20">20 dias</option>
                  <option value="30">30 dias</option>
                </select>
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
