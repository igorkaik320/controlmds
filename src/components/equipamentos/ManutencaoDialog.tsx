import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Wrench } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  fetchManutencoes,
  saveManutencao,
  updateManutencao,
  deleteManutencao,
  type Manutencao,
  type Equipamento,
} from '@/lib/equipamentosService';
import { fetchFornecedores, type Fornecedor } from '@/lib/comprasService';
import { toast } from 'sonner';
import FornecedorSelect from '@/components/compras/FornecedorSelect';

// Função de formatação de valor
function formatarValor(valor: string): string {
  // Remove tudo que não é número
  const numeros = valor.replace(/\D/g, '');
  
  // Converte para número e formata
  const numero = parseFloat(numeros) / 100;
  
  if (isNaN(numero)) return '';
  
  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Função para converter valor formatado para número
function converterValorParaNumero(valorFormatado: string): number {
  // Remove R$, espaços e pontos, substitui vírgula por ponto
  const limpo = valorFormatado.replace(/[R$\s.]/g, '').replace(',', '.');
  const numero = parseFloat(limpo);
  return isNaN(numero) ? 0 : numero;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipamento: Equipamento | null;
}

export default function ManutencaoDialog({ open, onOpenChange, equipamento }: Props) {
  try {
    const { user } = useAuth();
    const { canEdit, canDelete } = useModulePermissions();
    const [manutencoes, setManutencoes] = useState<Manutencao[]>([]);
    const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingManutencao, setEditingManutencao] = useState<Manutencao | null>(null);
  
  const [form, setForm] = useState({
    fornecedor_id: '',
    valor: formatarValor(''),
    data: new Date().toISOString().slice(0, 10),
    observacao: '',
    definir_proxima: false,
    proxima_manutencao: '',
    receber_avisos: false,
    avisar_dias_antes: '7'
  });

  useEffect(() => {
    if (!open || !equipamento) return;
    
    const loadData = async () => {
      setLoading(true);
      try {
        const [manutencoesData, fornecedoresData] = await Promise.all([
          fetchManutencoes(),
          fetchFornecedores().catch(() => []),
        ]);
        
        // Filtrar manutenções apenas deste equipamento
        const equipManutencoes = manutencoesData.filter(m => m.equipamento_id === equipamento.id);
        setManutencoes(equipManutencoes);
        setFornecedores(fornecedoresData);
        
        // Se não tiver manutenções, mostrar formulário
        if (equipManutencoes.length === 0) {
          setShowForm(true);
        } else {
          setShowForm(false);
        }
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [open, equipamento]);

  function resetForm() {
    setForm({
      fornecedor_id: '',
      valor: '',
      data: new Date().toISOString().slice(0, 10),
      observacao: '',
      definir_proxima: false,
      proxima_manutencao: '',
      receber_avisos: false,
      avisar_dias_antes: '7'
    });
    setEditingManutencao(null);
  }

  function openNewForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(manutencao: Manutencao) {
    if (!manutencao || !manutencao.id) {
      toast.error('Manutenção inválida');
      return;
    }

    setEditingManutencao(manutencao);
    
    try {
      const valorSeguro = typeof manutencao.valor === 'number' && !isNaN(manutencao.valor) 
        ? manutencao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
        : '0,00';

      setForm({
        fornecedor_id: manutencao.fornecedor_id || '',
        valor: valorSeguro,
        data: manutencao.data,
        observacao: manutencao.observacao || '',
        definir_proxima: !!manutencao.proxima_manutencao,
        proxima_manutencao: manutencao.proxima_manutencao || '',
        receber_avisos: (manutencao.avisar_dias_antes || 0) > 0,
        avisar_dias_antes: (manutencao.avisar_dias_antes || 7).toString()
      });
      setShowForm(true);
    } catch (error) {
      toast.error('Erro ao carregar manutenção para edição');
      console.error('Erro em openEditForm:', error);
    }
  }

  async function handleSubmit() {
    if (!user || !equipamento) return;
    
    if (!form.data) {
      toast.error('Data da manutenção é obrigatória');
      return;
    }
    
    if (!form.valor || converterValorParaNumero(form.valor) <= 0) {
      toast.error('Valor da manutenção é obrigatório');
      return;
    }

    try {
      const selectedFornecedor = form.fornecedor_id ? fornecedores.find(f => f.id === form.fornecedor_id) : null;
      
      const payload = {
        equipamento_id: equipamento.id,
        equipamento_nome: equipamento.nome,
        setor_id: equipamento.setor_id || null,
        setor_nome: equipamento.setor_nome || null,
        fornecedor_id: form.fornecedor_id || null,
        fornecedor_nome: selectedFornecedor?.nome_fornecedor || '',
        data: form.data,
        valor: converterValorParaNumero(form.valor),
        proxima_manutencao: form.definir_proxima ? form.proxima_manutencao : null,
        avisar_dias_antes: form.receber_avisos ? parseInt(form.avisar_dias_antes) : 0,
        ativo: true,
        observacao: form.observacao.trim() || null
      };

      if (editingManutencao) {
        await updateManutencao(editingManutencao.id, payload, user.id);
        toast.success('Manutenção atualizada com sucesso');
      } else {
        await saveManutencao(payload, user.id);
        toast.success('Manutenção cadastrada com sucesso');
      }
      
      setShowForm(false);
      resetForm();
      
      // Recarregar lista
      const updatedManutencoes = await fetchManutencoes();
      setManutencoes(updatedManutencoes.filter(m => m.equipamento_id === equipamento.id));
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta manutenção?')) return;
    
    try {
      if (!user) throw new Error('Usuário não encontrado');
      await deleteManutencao(id, user.id);
      toast.success('Manutenção excluída');
      
      // Recarregar lista
      const updatedManutencoes = await fetchManutencoes();
      setManutencoes(updatedManutencoes.filter(m => m.equipamento_id === equipamento.id));
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function formatDate(dateStr: any): string {
    if (!dateStr) return '-';
    if (typeof dateStr !== 'string') return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return '-';
      const [y, m, d] = parts;
      if (!y || !m || !d) return '-';
      return `${d}/${m}/${y}`;
    } catch {
      return '-';
    }
  }

  function formatarValorMonetario(valor: number | null | undefined): string {
    if (!valor || typeof valor !== 'number' || isNaN(valor)) {
      return 'R$ 0,00';
    }
    try {
      return valor.toLocaleString('pt-BR', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2,
        style: 'currency',
        currency: 'BRL'
      });
    } catch (error) {
      return 'R$ 0,00';
    }
  }

  function getStatusBadge(manutencao: Manutencao) {
    if (!manutencao?.ativo) {
      return <Badge variant="secondary">Inativa</Badge>;
    }
    
    if (!manutencao?.proxima_manutencao) {
      return <Badge variant="default">Ativa</Badge>;
    }
    
    try {
      const hoje = new Date();
      const dataProxima = new Date(manutencao.proxima_manutencao);
      
      // Verificar se a data é válida
      if (isNaN(dataProxima.getTime())) {
        return <Badge variant="default">Ativa</Badge>;
      }
      
      const diasDiff = Math.ceil((dataProxima.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      const avisarDias = manutencao.avisar_dias_antes || 7;
      
      if (diasDiff < 0) {
        return <Badge variant="destructive">Vencida</Badge>;
      } else if (diasDiff <= avisarDias) {
        return <Badge variant="outline">Próxima</Badge>;
      } else {
        return <Badge variant="default">Ativa</Badge>;
      }
    } catch (error) {
      return <Badge variant="default">Ativa</Badge>;
    }
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="py-8 text-center">
            <p>Carregando...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Manutenções — {equipamento?.nome}
            {equipamento?.n_patrimonio ? ` — Patrimônio ${equipamento.n_patrimonio}` : ''}
          </DialogTitle>
          <DialogDescription>
            Gerencie as manutenções deste equipamento
          </DialogDescription>
        </DialogHeader>

        {showForm ? (
          // Formulário de cadastro/edição
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Equipamento</Label>
                <p className="font-medium">{equipamento?.nome}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Setor</Label>
                <p className="font-medium">{equipamento?.setor_nome || '-'}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Modelo</Label>
                <p className="font-medium">{equipamento?.modelo || '-'}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Marca</Label>
                <p className="font-medium">{equipamento?.marca || '-'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data">Data da Manutenção *</Label>
              <Input
                id="data"
                type="date"
                value={form.data}
                onChange={(e) => setForm(p => ({ ...p, data: e.target.value }))}
                required
              />
            </div>

            <FornecedorSelect
              value={form.fornecedor_id}
              onChange={(value) => setForm(p => ({ ...p, fornecedor_id: value }))}
              fornecedores={fornecedores}
              valueMode="id"
              placeholder="Selecione ou digite..."
              label="Fornecedor"
            />

            <div className="space-y-2">
              <Label htmlFor="valor">Valor *</Label>
              <Input
                id="valor"
                type="text"
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => {
                  const valorFormatado = formatarValor(e.target.value);
                  setForm(p => ({ ...p, valor: valorFormatado }));
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacao">Ordem de Serviço / Observações</Label>
              <Textarea
                id="observacao"
                placeholder="Número da ordem de serviço ou observações..."
                value={form.observacao}
                onChange={(e) => setForm(p => ({ ...p, observacao: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="definir_proxima"
                  checked={form.definir_proxima}
                  onChange={(e) => setForm(p => ({ 
                    ...p, 
                    definir_proxima: e.target.checked,
                    proxima_manutencao: e.target.checked ? p.proxima_manutencao : ''
                  }))}
                />
                <Label htmlFor="definir_proxima">Definir próxima manutenção</Label>
              </div>
              {form.definir_proxima && (
                <Input
                  type="date"
                  placeholder="Data da próxima manutenção"
                  value={form.proxima_manutencao}
                  onChange={(e) => setForm(p => ({ ...p, proxima_manutencao: e.target.value }))}
                />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="receber_avisos"
                  checked={form.receber_avisos}
                  onChange={(e) => setForm(p => ({ 
                    ...p, 
                    receber_avisos: e.target.checked,
                    avisar_dias_antes: e.target.checked ? p.avisar_dias_antes : '7'
                  }))}
                />
                <Label htmlFor="receber_avisos">Receber avisos</Label>
              </div>
              {form.receber_avisos && (
                <div className="flex items-center space-x-2">
                  <Label htmlFor="avisar_dias_antes" className="text-sm">Avisar</Label>
                  <Input
                    id="avisar_dias_antes"
                    type="number"
                    min="1"
                    max="365"
                    className="w-20"
                    value={form.avisar_dias_antes}
                    onChange={(e) => setForm(p => ({ ...p, avisar_dias_antes: e.target.value }))}
                  />
                  <Label className="text-sm">dias antes</Label>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowForm(false);
                resetForm();
              }}>
                {manutencoes.length === 0 ? 'Cancelar' : 'Voltar'}
              </Button>
              <Button onClick={handleSubmit}>
                {editingManutencao ? 'Atualizar' : 'Salvar'} Manutenção
              </Button>
            </DialogFooter>
          </div>
        ) : (
          // Lista de manutenções
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Manutenções cadastradas ({manutencoes.length})</h3>
              <Button onClick={openNewForm}>
                <Plus className="h-4 w-4 mr-1" />
                Nova Manutenção
              </Button>
            </div>

            {manutencoes.length === 0 ? (
              <div className="text-center py-8">
                <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma manutenção cadastrada</p>
                <Button onClick={openNewForm} className="mt-4">
                  <Plus className="h-4 w-4 mr-1" />
                  Cadastrar primeira manutenção
                </Button>
              </div>
            ) : (
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead className="w-32">Valor</TableHead>
                      <TableHead>Próxima</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Observação</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manutencoes.map((manutencao) => {
                      const id = manutencao?.id || 'unknown';
                      const data = formatDate(manutencao?.data);
                      const fornecedor = manutencao?.fornecedor_nome || '-';
                      const valor = formatarValorMonetario(manutencao?.valor);
                      const proxima = manutencao?.proxima_manutencao ? formatDate(manutencao.proxima_manutencao) : '-';
                      const observacao = manutencao?.observacao || '-';

                      return (
                        <TableRow key={id}>
                          <TableCell>{data}</TableCell>
                          <TableCell>{fornecedor}</TableCell>
                          <TableCell className="w-32 text-right font-medium">
                            {valor}
                          </TableCell>
                          <TableCell>{proxima}</TableCell>
                          <TableCell>{getStatusBadge(manutencao)}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{observacao}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {canEdit('manutencao_equipamentos') && (
                                <Button variant="ghost" size="icon" onClick={() => openEditForm(manutencao)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {canDelete('manutencao_equipamentos') && (
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(manutencao.id)}>
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
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
  } catch (error) {
    console.error('🔍 ERRO CAPTURADO NO MANUTENCAODIALOG:', error);
    console.trace('Stack trace completo:', error);
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="py-8 text-center">
            <p className="text-red-500">Ocorreu um erro ao carregar o diálogo de manutenção.</p>
            <p className="text-sm text-muted-foreground">Verifique o console para mais detalhes.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
}
