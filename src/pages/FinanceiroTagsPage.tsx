import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useProfileMap } from '@/hooks/useProfileMap';
import { parseDateTimeSafe } from '@/lib/formatters';
import {
  deleteFinanceiroTag,
  fetchFinanceiroTags,
  FinanceiroTag,
  saveFinanceiroTag,
  updateFinanceiroTag,
} from '@/lib/financeiroTagsService';

const colorOptions = [
  { label: 'Vermelho', value: '#ef4444' },
  { label: 'Laranja', value: '#f97316' },
  { label: 'Amarelo', value: '#eab308' },
  { label: 'Verde', value: '#22c55e' },
  { label: 'Azul', value: '#3b82f6' },
  { label: 'Roxo', value: '#8b5cf6' },
  { label: 'Cinza', value: '#64748b' },
];

const emptyForm = {
  nome: '',
  cor: '#ef4444',
  ativa: 'true',
};

function formatAuditDate(iso?: string | null) {
  if (!iso) return '-';
  const parsed = parseDateTimeSafe(iso);
  if (!parsed) return '-';
  return `${parsed.toLocaleDateString('pt-BR')} ${parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function TagPreview({ nome, cor }: { nome: string; cor: string }) {
  return (
    <span
      className="inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold text-white"
      style={{ backgroundColor: cor }}
    >
      {nome || 'Tag'}
    </span>
  );
}

export default function FinanceiroTagsPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const [items, setItems] = useState<FinanceiroTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const profileMap = useProfileMap();

  const load = useCallback(async () => {
    try {
      setItems(await fetchFinanceiroTags());
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
    return items.filter((item) => item.nome.toLowerCase().includes(term));
  }, [items, search]);

  function openNew() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowDialog(true);
  }

  function openEdit(item: FinanceiroTag) {
    setEditingId(item.id);
    setForm({
      nome: item.nome,
      cor: item.cor,
      ativa: item.ativa ? 'true' : 'false',
    });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user || !form.nome.trim()) {
      toast.error('Nome da tag é obrigatório');
      return;
    }

    const nome = form.nome.trim().toUpperCase();
    const duplicate = items.find((item) => item.id !== editingId && item.nome.trim().toLowerCase() === nome.toLowerCase());
    if (duplicate) {
      toast.error('Já existe uma tag com este nome');
      return;
    }

    try {
      const payload = {
        nome,
        cor: form.cor,
        ativa: form.ativa === 'true',
        created_by: user.id,
        updated_by: user.id,
      };

      if (editingId) {
        await updateFinanceiroTag(editingId, payload, user.id);
        toast.success('Tag atualizada');
      } else {
        await saveFinanceiroTag(payload, user.id);
        toast.success('Tag cadastrada');
      }

      setShowDialog(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!user || !confirm('Excluir esta tag?')) return;
    try {
      await deleteFinanceiroTag(id, user.id);
      toast.success('Tag excluída');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function AuditIcon({ item }: { item: FinanceiroTag }) {
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
          <h2 className="text-2xl font-bold">Tags Financeiras</h2>
          <p className="text-sm text-muted-foreground">Cadastre etiquetas coloridas para os lançamentos do contas a pagar.</p>
        </div>
        {canCreate('financeiro_tags') && (
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" />
            Nova Tag
          </Button>
        )}
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nome da tag..."
        className="max-w-sm"
      />

      <div className="overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tag</TableHead>
              <TableHead>Cor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Auditoria</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhuma tag encontrada
                </TableCell>
              </TableRow>
            )}

            {filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <TagPreview nome={item.nome} cor={item.cor} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="h-5 w-5 rounded border" style={{ backgroundColor: item.cor }} />
                    {item.cor}
                  </div>
                </TableCell>
                <TableCell>{item.ativa ? 'Ativa' : 'Inativa'}</TableCell>
                <TableCell><AuditIcon item={item} /></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {canEdit('financeiro_tags') && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete('financeiro_tags') && (
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nova'} Tag</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Prioridade"
              />
            </div>
            <div>
              <Label>Cor *</Label>
              <Select value={form.cor} onValueChange={(value) => setForm((prev) => ({ ...prev, cor: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color.value }} />
                        {color.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.ativa} onValueChange={(value) => setForm((prev) => ({ ...prev, ativa: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ativa</SelectItem>
                  <SelectItem value="false">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Pré-visualização</p>
              <TagPreview nome={form.nome.trim().toUpperCase()} cor={form.cor} />
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
