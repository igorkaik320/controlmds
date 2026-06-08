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

const emptyForm = {
  nome: '',
  cor: '#ef4444',
  ordem: '',
  ativa: 'true',
};

function normalizeHexColor(value: string) {
  const raw = value.trim();
  const withHash = raw.startsWith('#') ? raw : `#${raw}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toLowerCase() : '';
}

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
      ordem: item.ordem == null ? '' : String(item.ordem),
      ativa: item.ativa ? 'true' : 'false',
    });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user || !form.nome.trim()) {
      toast.error('Nome da tag é obrigatório');
      return;
    }

    const cor = normalizeHexColor(form.cor);
    if (!cor) {
      toast.error('Informe uma cor válida no formato #RRGGBB');
      return;
    }

    const nome = form.nome.trim().toUpperCase();
    const ordem = form.ordem.trim() ? Number(form.ordem) : null;
    if (ordem != null && (!Number.isInteger(ordem) || ordem < 0)) {
      toast.error('Informe uma ordem valida');
      return;
    }

    const duplicate = items.find((item) => item.id !== editingId && item.nome.trim().toLowerCase() === nome.toLowerCase());
    if (duplicate) {
      toast.error('Já existe uma tag com este nome');
      return;
    }

    try {
      const payload = {
        nome,
        cor,
        ordem,
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
              <TableHead>Ordem</TableHead>
              <TableHead>Cor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Auditoria</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhuma tag encontrada
                </TableCell>
              </TableRow>
            )}

            {filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <TagPreview nome={item.nome} cor={item.cor} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {item.ordem ?? '-'}
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
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={normalizeHexColor(form.cor) || '#000000'}
                  onChange={(e) => setForm((prev) => ({ ...prev, cor: e.target.value }))}
                  className="h-10 w-14 cursor-pointer p-1"
                  aria-label="Selecionar cor da tag"
                />
                <Input
                  value={form.cor}
                  onChange={(e) => setForm((prev) => ({ ...prev, cor: e.target.value }))}
                  onBlur={(e) => {
                    const color = normalizeHexColor(e.target.value);
                    if (color) setForm((prev) => ({ ...prev, cor: color }));
                  }}
                  placeholder="#ef4444"
                  className="font-mono uppercase"
                />
              </div>
            </div>
            <div>
              <Label>Ordem</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={form.ordem}
                onChange={(e) => setForm((prev) => ({ ...prev, ordem: e.target.value }))}
                placeholder="Ex: 1"
              />
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
