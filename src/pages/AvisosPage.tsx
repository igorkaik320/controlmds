import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AvisoConfiguracao,
  AvisoFinanceiroTipo,
  deleteAvisoConfiguracao,
  fetchAvisosConfiguracoes,
  formatAvisoTipo,
  saveAvisoConfiguracao,
  updateAvisoConfiguracao,
} from '@/lib/avisosService';
import { fetchAllUsersWithRoles, UserWithRole } from '@/lib/cashRegister';

const emptyForm = {
  nome: '',
  tipo: 'parcelas_vencendo_hoje' as AvisoFinanceiroTipo,
  dias_antecedencia: '3',
  ativo: true,
  mostrar_link_consulta: true,
  mostrar_link_relatorio: false,
  usuarios: [] as string[],
};

export default function AvisosPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<AvisoConfiguracao[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const activeUsers = useMemo(
    () => users.filter((item) => item.ativo !== false).sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [users]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [avisosData, usersData] = await Promise.all([
        fetchAvisosConfiguracoes(),
        fetchAllUsersWithRoles().catch(() => []),
      ]);
      setItems(avisosData);
      setUsers(usersData);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao carregar avisos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditingId(null);
    setForm({ ...emptyForm, usuarios: activeUsers.map((item) => item.user_id) });
    setShowDialog(true);
  }

  function openEdit(item: AvisoConfiguracao) {
    setEditingId(item.id);
    setForm({
      nome: item.nome,
      tipo: item.tipo,
      dias_antecedencia: String(item.dias_antecedencia ?? 0),
      ativo: item.ativo,
      mostrar_link_consulta: item.mostrar_link_consulta,
      mostrar_link_relatorio: item.mostrar_link_relatorio,
      usuarios: item.usuarios || [],
    });
    setShowDialog(true);
  }

  function toggleUser(userId: string, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      usuarios: checked
        ? Array.from(new Set([...prev.usuarios, userId]))
        : prev.usuarios.filter((id) => id !== userId),
    }));
  }

  async function handleSubmit() {
    if (!user) return;
    if (!form.nome.trim()) {
      toast.error('Informe o nome do aviso.');
      return;
    }
    if (form.usuarios.length === 0) {
      toast.error('Selecione pelo menos um usuário para receber o aviso.');
      return;
    }

    try {
      const payload = {
        nome: form.nome.trim(),
        modulo: 'financeiro' as const,
        tipo: form.tipo,
        dias_antecedencia: form.tipo === 'parcelas_a_vencer' ? Number(form.dias_antecedencia || 0) : 0,
        ativo: form.ativo,
        mostrar_link_consulta: form.mostrar_link_consulta,
        mostrar_link_relatorio: form.mostrar_link_relatorio,
        created_by: user.id,
        updated_by: user.id,
      };

      if (editingId) {
        await updateAvisoConfiguracao(editingId, payload, form.usuarios, user.id);
        toast.success('Aviso atualizado');
      } else {
        await saveAvisoConfiguracao(payload, form.usuarios, user.id);
        toast.success('Aviso cadastrado');
      }

      setShowDialog(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar aviso.');
    }
  }

  async function handleDelete(id: string) {
    if (!user || !confirm('Excluir este aviso?')) return;
    try {
      await deleteAvisoConfiguracao(id, user.id);
      toast.success('Aviso excluído');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao excluir aviso.');
    }
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">Carregando avisos...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Avisos</h2>
          <p className="text-sm text-muted-foreground">Configure notificações diárias para o financeiro.</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Aviso
        </Button>
      </div>

      <Card className="overflow-hidden rounded-lg border-border/50 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Dias antes</TableHead>
              <TableHead>Destinatários</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nenhum aviso configurado.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.nome}</TableCell>
                  <TableCell>{formatAvisoTipo(item.tipo)}</TableCell>
                  <TableCell>{item.tipo === 'parcelas_a_vencer' ? item.dias_antecedencia : '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{item.usuarios?.length || 0} usuário(s)</TableCell>
                  <TableCell>{item.ativo ? 'Ativo' : 'Inativo'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              {editingId ? 'Editar' : 'Novo'} Aviso
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Contas vencendo hoje"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Tipo de aviso *</Label>
                <Select value={form.tipo} onValueChange={(value: AvisoFinanceiroTipo) => setForm((prev) => ({ ...prev, tipo: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parcelas_vencendo_hoje">Parcelas vencendo hoje</SelectItem>
                    <SelectItem value="parcelas_vencidas">Parcelas vencidas</SelectItem>
                    <SelectItem value="parcelas_a_vencer">Parcelas a vencer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dias antes do vencimento</Label>
                <Input
                  type="number"
                  min={1}
                  disabled={form.tipo !== 'parcelas_a_vencer'}
                  value={form.dias_antecedencia}
                  onChange={(e) => setForm((prev) => ({ ...prev, dias_antecedencia: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.ativo} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, ativo: checked }))} />
                Aviso ativo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.mostrar_link_consulta} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, mostrar_link_consulta: checked }))} />
                Link para consulta
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.mostrar_link_relatorio} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, mostrar_link_relatorio: checked }))} />
                Link para relatório
              </label>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Usuários que recebem *</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm((prev) => ({ ...prev, usuarios: activeUsers.map((item) => item.user_id) }))}>
                    Marcar todos
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm((prev) => ({ ...prev, usuarios: [] }))}>
                    Limpar
                  </Button>
                </div>
              </div>
              <div className="max-h-52 space-y-2 overflow-auto rounded-lg border p-3">
                {activeUsers.map((item) => (
                  <label key={item.user_id} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
                    <Checkbox
                      checked={form.usuarios.includes(item.user_id)}
                      onCheckedChange={(checked) => toggleUser(item.user_id, checked === true)}
                    />
                    <span className="font-medium">{item.display_name}</span>
                    <span className="text-xs text-muted-foreground">{item.role}</span>
                  </label>
                ))}
              </div>
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
