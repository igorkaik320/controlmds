import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useProfileMap } from '@/hooks/useProfileMap';
import { parseDateTimeSafe } from '@/lib/formatters';
import {
  CategoriaFinanceira,
  CategoriaFinanceiraNatureza,
  CategoriaFinanceiraTipo,
  deleteCategoriaFinanceira,
  fetchCategoriasFinanceiras,
  saveCategoriaFinanceira,
  updateCategoriaFinanceira,
} from '@/lib/categoriasFinanceirasService';

const emptyForm = {
  codigo: '2.',
  nome: '',
  tipo: 'despesa' as CategoriaFinanceiraTipo,
  natureza: 'movimento' as CategoriaFinanceiraNatureza,
  parent_id: '',
  ativa: 'true',
};

function formatAuditDate(iso?: string | null) {
  if (!iso) return '-';
  const parsed = parseDateTimeSafe(iso);
  if (!parsed) return '-';
  return `${parsed.toLocaleDateString('pt-BR')} ${parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function normalizeRootCode(raw: string, tipo: CategoriaFinanceiraTipo) {
  const digits = raw.replace(/\D/g, '');
  const first = tipo === 'receita' ? '1' : '2';
  if (!digits) return `${first}.`;
  if (digits.length === 1) return digits;
  return `${digits[0]}.${digits.slice(1).replace(/(\d{2})(?=\d)/g, '$1.')}`;
}

function normalizeChildCode(raw: string, parentCode: string) {
  const parentDigits = parentCode.replace(/\D/g, '');
  let suffix = raw.replace(/\D/g, '');
  if (suffix.startsWith(parentDigits)) suffix = suffix.slice(parentDigits.length);
  if (!suffix) return `${parentCode}.`;
  const normalizedSuffix = suffix.length <= 2 ? suffix.padStart(2, '0') : suffix.replace(/(\d{2})(?=\d)/g, '$1.');
  return `${parentCode}.${normalizedSuffix}`;
}

function normalizeCategoryCode(raw: string, tipo: CategoriaFinanceiraTipo, parent?: CategoriaFinanceira) {
  const code = parent ? normalizeChildCode(raw, parent.codigo) : normalizeRootCode(raw, tipo);
  return code.replace(/\.+/g, '.').replace(/\.$/, '');
}

function getLevel(code: string) {
  return Math.max(0, code.split('.').length - 1);
}

export default function CategoriasFinanceirasPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const [items, setItems] = useState<CategoriaFinanceira[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const profileMap = useProfileMap();

  const load = useCallback(async () => {
    try {
      setItems(await fetchCategoriasFinanceiras());
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
      `${item.codigo} ${item.nome} ${item.tipo} ${item.natureza}`.toLowerCase().includes(term)
    );
  }, [items, search]);

  const totalizadoras = useMemo(
    () => items.filter((item) => item.id !== editingId && item.natureza === 'totalizadora'),
    [items, editingId]
  );

  function openNew() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowDialog(true);
  }

  function openEdit(item: CategoriaFinanceira) {
    setEditingId(item.id);
    setForm({
      codigo: item.codigo,
      nome: item.nome,
      tipo: item.tipo,
      natureza: item.natureza,
      parent_id: item.parent_id || '',
      ativa: item.ativa ? 'true' : 'false',
    });
    setShowDialog(true);
  }

  function validateForm() {
    const parent = items.find((item) => item.id === form.parent_id);
    const codigo = normalizeCategoryCode(form.codigo, form.tipo, parent);
    const nome = form.nome.trim();

    if (!codigo || !nome) {
      toast.error('Código e nome são obrigatórios');
      return false;
    }

    if (form.tipo === 'receita' && !codigo.startsWith('1')) {
      toast.error('Categorias de receita devem começar com 1');
      return false;
    }

    if (form.tipo === 'despesa' && !codigo.startsWith('2')) {
      toast.error('Categorias de despesa devem começar com 2');
      return false;
    }

    const duplicate = items.find((item) => item.id !== editingId && item.codigo.trim() === codigo);
    if (duplicate) {
      toast.error('Já existe uma categoria com este código');
      return false;
    }

    return true;
  }

  async function handleSubmit() {
    if (!user || !validateForm()) return;

    const parent = items.find((item) => item.id === form.parent_id);
    if (parent && parent.tipo !== form.tipo) {
      toast.error('A categoria pai precisa ser do mesmo tipo');
      return;
    }

    try {
      const payload = {
        codigo: normalizeCategoryCode(form.codigo, form.tipo, parent),
        nome: form.nome.trim().toUpperCase(),
        tipo: form.tipo,
        natureza: form.natureza,
        parent_id: form.parent_id || null,
        ativa: form.ativa === 'true',
        created_by: user.id,
        updated_by: user.id,
      };

      if (editingId) {
        await updateCategoriaFinanceira(editingId, payload, user.id);
        toast.success('Categoria atualizada');
      } else {
        await saveCategoriaFinanceira(payload, user.id);
        toast.success('Categoria cadastrada');
      }

      setShowDialog(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!user || !confirm('Excluir esta categoria?')) return;
    try {
      await deleteCategoriaFinanceira(id, user.id);
      toast.success('Categoria excluída');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function handleTipoChange(tipo: CategoriaFinanceiraTipo) {
    setForm((prev) => ({
      ...prev,
      tipo,
      parent_id: '',
      codigo: tipo === 'receita' ? '1.' : '2.',
    }));
  }

  function handleMatrizChange(value: string) {
    const parentId = value === 'none' ? '' : value;
    const parent = items.find((item) => item.id === parentId);
    setForm((prev) => ({
      ...prev,
      parent_id: parentId,
      codigo: parent ? `${parent.codigo}.` : prev.tipo === 'receita' ? '1.' : '2.',
    }));
  }

  function AuditIcon({ item }: { item: CategoriaFinanceira }) {
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
    <div className="space-y-4 text-[13px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Categorias Financeiras</h2>
          <p className="text-xs text-muted-foreground">
            Plano de categorias para receitas e despesas.
          </p>
        </div>
        {canCreate('categorias_financeiras') && (
          <Button size="sm" onClick={openNew} className="h-9 gap-1">
            <Plus className="h-4 w-4" />
            Nova
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card p-3">
        <Label className="text-xs font-medium text-muted-foreground">Buscar categoria</Label>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Código, nome, tipo..."
          className="mt-1 h-8 max-w-md text-xs"
        />
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-8 text-xs">Código</TableHead>
              <TableHead className="h-8 text-xs">Descrição</TableHead>
              <TableHead className="h-8 text-xs">Tipo</TableHead>
              <TableHead className="h-8 text-xs">Natureza</TableHead>
              <TableHead className="h-8 text-xs">Matriz</TableHead>
              <TableHead className="h-8 text-xs">Status</TableHead>
              <TableHead className="h-8 w-[64px] text-center text-xs">Info</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Nenhuma categoria encontrada
                </TableCell>
              </TableRow>
            )}

            {filtered.map((item) => {
              const parent = items.find((categoria) => categoria.id === item.parent_id);
              return (
                <TableRow
                  key={item.id}
                  className={item.natureza === 'totalizadora' ? 'bg-muted/40 font-semibold' : ''}
                >
                  <TableCell className="py-2 font-medium">
                    <span style={{ paddingLeft: `${getLevel(item.codigo) * 14}px` }}>{item.codigo}</span>
                  </TableCell>
                  <TableCell className="py-2">{item.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={item.tipo === 'receita' ? 'text-success' : 'text-destructive'}>
                      {item.tipo === 'receita' ? 'Receita' : 'Despesa'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.natureza === 'movimento' ? 'default' : 'secondary'} className="text-[11px]">
                      {item.natureza === 'movimento' ? 'Movimento' : 'Totalizadora'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {parent ? `${parent.codigo} - ${parent.nome}` : '-'}
                  </TableCell>
                  <TableCell>{item.ativa ? 'Ativa' : 'Inativa'}</TableCell>
                  <TableCell className="text-center">
                    <AuditIcon item={item} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {canEdit('categorias_financeiras') && (
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete('categorias_financeiras') && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nova'} Categoria Financeira</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código *</Label>
                <Input
                  value={form.codigo}
                  onChange={(e) => setForm((prev) => ({ ...prev, codigo: e.target.value }))}
                  onBlur={() => {
                    const parent = items.find((item) => item.id === form.parent_id);
                    setForm((prev) => ({ ...prev, codigo: normalizeCategoryCode(prev.codigo, prev.tipo, parent) }));
                  }}
                  placeholder="Ex: 2.0.01"
                />
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
            </div>

            <div>
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: FORNECEDORES"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={(value: CategoriaFinanceiraTipo) => handleTipoChange(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Natureza *</Label>
                <Select value={form.natureza} onValueChange={(value: CategoriaFinanceiraNatureza) => setForm((prev) => ({ ...prev, natureza: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="totalizadora">Totalizadora</SelectItem>
                    <SelectItem value="movimento">Movimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Matriz</Label>
              <Select value={form.parent_id || 'none'} onValueChange={handleMatrizChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem matriz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem matriz</SelectItem>
                  {totalizadoras
                    .filter((item) => item.tipo === form.tipo)
                    .map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.codigo} - {item.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
