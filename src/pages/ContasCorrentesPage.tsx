import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, Landmark, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { useProfileMap } from '@/hooks/useProfileMap';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency, formatCurrencyInput, formatCurrencyReal, parseCurrencyInput, parseDateTimeSafe } from '@/lib/formatters';
import {
  ContaCorrente,
  deleteContaCorrente,
  fetchContasCorrentes,
  saveContaCorrente,
  updateContaCorrente,
} from '@/lib/contasCorrentesService';

const emptyForm = {
  banco: '',
  agencia: '',
  numero_conta: '',
  digito_verificador: '',
  id_ofx: '',
  data_saldo_inicial: new Date().toISOString().split('T')[0],
  saldo_inicial: 'R$ 0,00',
  ativa: 'true',
  observacao: '',
};

function formatAuditDate(iso?: string | null) {
  if (!iso) return '-';
  const parsed = parseDateTimeSafe(iso);
  if (!parsed) return '-';
  return `${parsed.toLocaleDateString('pt-BR')} ${parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function ContasCorrentesPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const [items, setItems] = useState<ContaCorrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const profileMap = useProfileMap();

  const load = useCallback(async () => {
    try {
      setItems(await fetchContasCorrentes());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      [
        item.banco,
        item.agencia,
        item.numero_conta,
        item.digito_verificador || '',
        item.id_ofx || '',
        item.observacao || '',
      ].some((value) => value.toLowerCase().includes(term))
    );
  }, [items, search]);

  function openNew() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowDialog(true);
  }

  function openEdit(item: ContaCorrente) {
    setEditingId(item.id);
    setForm({
      banco: item.banco,
      agencia: item.agencia,
      numero_conta: item.numero_conta,
      digito_verificador: item.digito_verificador || '',
      id_ofx: item.id_ofx || '',
      data_saldo_inicial: item.data_saldo_inicial,
      saldo_inicial: formatCurrencyInput(formatCurrencyReal(item.saldo_inicial || 0)),
      ativa: item.ativa ? 'true' : 'false',
      observacao: item.observacao || '',
    });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (saving) return;
    if (!user || !form.banco.trim() || !form.agencia.trim() || !form.numero_conta.trim() || !form.data_saldo_inicial) {
      toast.error('Preencha banco, agência, conta e data do saldo inicial.');
      return;
    }

    const payload = {
      banco: form.banco.trim().toUpperCase(),
      agencia: form.agencia.trim(),
      numero_conta: form.numero_conta.trim(),
      digito_verificador: form.digito_verificador.trim() || null,
      id_ofx: form.id_ofx.trim().toUpperCase() || null,
      data_saldo_inicial: form.data_saldo_inicial,
      saldo_inicial: parseCurrencyInput(form.saldo_inicial),
      ativa: form.ativa === 'true',
      observacao: form.observacao.trim() || null,
      created_by: user.id,
      updated_by: user.id,
    };

    setSaving(true);
    try {
      if (editingId) {
        await updateContaCorrente(editingId, payload, user.id);
        toast.success('Conta corrente atualizada');
      } else {
        await saveContaCorrente(payload, user.id);
        toast.success('Conta corrente cadastrada');
      }

      setShowDialog(false);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!user || !confirm('Excluir esta conta corrente?')) return;
    try {
      await deleteContaCorrente(id, user.id);
      toast.success('Conta corrente excluída');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function AuditIcon({ item }: { item: ContaCorrente }) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary">
            <Info className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <p>Criado por {profileMap[item.created_by || ''] || '-'} em {formatAuditDate(item.created_at)}</p>
            {item.updated_by && (
              <p>Atualizado por {profileMap[item.updated_by] || '-'} em {formatAuditDate(item.updated_at)}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold">Contas Correntes</h2>
          <p className="text-sm text-muted-foreground">Cadastre bancos, agências, contas e saldo inicial para conciliação e movimentações.</p>
        </div>
        {canCreate('contas_correntes') && (
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" />
            Nova Conta
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <Label className="text-xs text-muted-foreground">Buscar conta</Label>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Banco, agência, conta..."
          className="mt-1 max-w-sm"
        />
      </div>

      <div className="overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Banco</TableHead>
              <TableHead>Agência</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead>ID OFX</TableHead>
              <TableHead>Saldo Inicial</TableHead>
              <TableHead>Saldo Atual</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Auditoria</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  Nenhuma conta corrente encontrada
                </TableCell>
              </TableRow>
            )}

            {filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                    {item.banco}
                  </span>
                </TableCell>
                <TableCell>{item.agencia}</TableCell>
                <TableCell>{item.numero_conta}{item.digito_verificador ? `-${item.digito_verificador}` : ''}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{item.id_ofx || '-'}</TableCell>
                <TableCell className="font-semibold">{formatCurrency(item.saldo_inicial)}</TableCell>
                <TableCell className={Number(item.saldo_atual || 0) < 0 ? 'font-semibold text-destructive' : 'font-semibold'}>
                  {formatCurrency(item.saldo_atual ?? item.saldo_inicial)}
                </TableCell>
                <TableCell>{new Date(`${item.data_saldo_inicial}T00:00:00`).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell>{item.ativa ? 'Ativa' : 'Inativa'}</TableCell>
                <TableCell><AuditIcon item={item} /></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {canEdit('contas_correntes') && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete('contas_correntes') && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nova'} Conta Corrente</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Banco *</Label>
              <Input value={form.banco} onChange={(e) => setForm((prev) => ({ ...prev, banco: e.target.value }))} placeholder="Ex: Banco do Brasil" />
            </div>
            <div>
              <Label>Agência *</Label>
              <Input value={form.agencia} onChange={(e) => setForm((prev) => ({ ...prev, agencia: e.target.value }))} placeholder="0000" />
            </div>
            <div>
              <Label>Número da Conta *</Label>
              <Input value={form.numero_conta} onChange={(e) => setForm((prev) => ({ ...prev, numero_conta: e.target.value }))} placeholder="000000" />
            </div>
            <div>
              <Label>Dígito Verificador</Label>
              <Input value={form.digito_verificador} onChange={(e) => setForm((prev) => ({ ...prev, digito_verificador: e.target.value }))} placeholder="0" />
            </div>
            <div className="sm:col-span-2">
              <Label>ID OFX</Label>
              <Input
                value={form.id_ofx}
                onChange={(e) => setForm((prev) => ({ ...prev, id_ofx: e.target.value }))}
                placeholder="Ex: 001|55019-1"
                className="font-mono uppercase"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Cole aqui o identificador mostrado na primeira leitura do arquivo OFX.
              </p>
            </div>
            <div>
              <Label>Data do Saldo Inicial *</Label>
              <Input type="date" value={form.data_saldo_inicial} onChange={(e) => setForm((prev) => ({ ...prev, data_saldo_inicial: e.target.value }))} />
            </div>
            <div>
              <Label>Saldo Inicial *</Label>
              <Input value={form.saldo_inicial} onChange={(e) => setForm((prev) => ({ ...prev, saldo_inicial: formatCurrencyInput(e.target.value) }))} placeholder="R$ 0,00" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.ativa} onValueChange={(value) => setForm((prev) => ({ ...prev, ativa: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ativa</SelectItem>
                  <SelectItem value="false">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Observação</Label>
              <Textarea value={form.observacao} onChange={(e) => setForm((prev) => ({ ...prev, observacao: e.target.value }))} placeholder="Observações sobre a conta..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
