import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Fornecedor, fetchFornecedores, saveFornecedor, updateFornecedor, deleteFornecedor } from '@/lib/comprasService';
import { formatCPFCNPJ, formatCelular } from '@/lib/formatters';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { toast } from 'sonner';
import AuditInfo from '@/components/AuditInfo';
import { useProfileMap } from '@/hooks/useProfileMap';

function normalizeSearch(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function digitsOnly(value?: string | null) {
  return (value || '').replace(/\D/g, '');
}

export default function FornecedoresPage() {
  const { user, userRole } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const [items, setItems] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(30);
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState({ nome_fornecedor: '', razao_social: '', banco: '', agencia: '', conta: '', cnpj_cpf: '', celular: '' });

  const profileMap = useProfileMap();

  const load = useCallback(async () => {
    try { setItems(await fetchFornecedores()); } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Busca inteligente: por nome, razão social ou CNPJ/CPF
  const filtered = items.filter(i => {
    const s = normalizeSearch(search);
    const digits = digitsOnly(search);
    if (!s && !digits) return true;

    return normalizeSearch(i.nome_fornecedor).includes(s) ||
      normalizeSearch(i.razao_social).includes(s) ||
      (!!digits && digitsOnly(i.cnpj_cpf).includes(digits));
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * pageSize;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, filtered.length);
  const paginatedItems = filtered.slice(pageStartIndex, pageEndIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function openNew() {
    setEditingId(null);
    setForm({ nome_fornecedor: '', razao_social: '', banco: '', agencia: '', conta: '', cnpj_cpf: '', celular: '' });
    setShowDialog(true);
  }

  function openEdit(item: Fornecedor) {
    setEditingId(item.id);
    setForm({
      nome_fornecedor: item.nome_fornecedor,
      razao_social: item.razao_social || '',
      banco: item.banco || '',
      agencia: item.agencia || '',
      conta: item.conta || '',
      cnpj_cpf: item.cnpj_cpf || '',
      celular: (item as any).celular || '',
    });
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!user || !form.nome_fornecedor.trim()) { toast.error('Nome é obrigatório'); return; }

    // Verificar duplicidade por CNPJ (somente ao criar novo ou se CNPJ mudou)
    const rawCnpj = form.cnpj_cpf.replace(/\D/g, '');
    if (rawCnpj.length >= 11) {
      const duplicate = items.find(i => {
        if (editingId && i.id === editingId) return false;
        return (i.cnpj_cpf || '').replace(/\D/g, '') === rawCnpj;
      });
      if (duplicate) {
        toast.error(`CNPJ/CPF já cadastrado para: ${duplicate.nome_fornecedor}`);
        return;
      }
    }

    try {
      if (editingId) {
        await updateFornecedor(editingId, form, user.id);
        toast.success('Fornecedor atualizado');
      } else {
        await saveFornecedor({ ...form, created_by: user.id } as any, user.id);
        toast.success('Fornecedor cadastrado');
      }
      setShowDialog(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este fornecedor?')) return;
    try { await deleteFornecedor(id, user?.id || ''); load(); toast.success('Excluído'); } catch (e: any) { toast.error(e.message); }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Cadastro de Fornecedores</h2>
        {canCreate('fornecedores') && (
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo Fornecedor</Button>
        )}
      </div>

      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, razão social ou CNPJ/CPF..." className="max-w-md" />

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Razão Social</TableHead>
              <TableHead>CNPJ/CPF</TableHead>
              <TableHead>Banco</TableHead>
              <TableHead>Agência</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead>Auditoria</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum fornecedor</TableCell></TableRow>
            )}
            {paginatedItems.map(i => (
              <TableRow key={i.id}>
                <TableCell>{i.nome_fornecedor}</TableCell>
                <TableCell>{i.razao_social}</TableCell>
                <TableCell>{i.cnpj_cpf}</TableCell>
                <TableCell>{i.banco}</TableCell>
                <TableCell>{i.agencia}</TableCell>
                <TableCell>{i.conta}</TableCell>
                <TableCell>
                  <AuditInfo
                    createdBy={i.created_by}
                    createdAt={i.created_at}
                    profileMap={profileMap}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {canEdit('fornecedores') && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                    )}
                    {canDelete('fornecedores') && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(i.id)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 rounded-md border px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div>
          {filtered.length > 0
            ? `Mostrando ${pageStartIndex + 1}-${pageEndIndex} de ${filtered.length}`
            : 'Nenhum item para mostrar'}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span>Itens por página</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[82px] border-input bg-card text-xs shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30</SelectItem>
              <SelectItem value="60">60</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safeCurrentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[74px] text-center">
              {safeCurrentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={safeCurrentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Novo'} Fornecedor</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome *</Label><Input value={form.nome_fornecedor} onChange={e => setForm(p => ({ ...p, nome_fornecedor: e.target.value }))} /></div>
            <div><Label>Razão Social</Label><Input value={form.razao_social} onChange={e => setForm(p => ({ ...p, razao_social: e.target.value }))} /></div>
            <div>
              <Label>CNPJ/CPF</Label>
              <Input
                value={form.cnpj_cpf}
                onChange={e => setForm(p => ({ ...p, cnpj_cpf: formatCPFCNPJ(e.target.value) }))}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                maxLength={18}
              />
            </div>
            <div>
              <Label>Celular</Label>
              <Input
                value={form.celular}
                onChange={e => setForm(p => ({ ...p, celular: formatCelular(e.target.value) }))}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </div>
            <div><Label>Banco</Label><Input value={form.banco} onChange={e => setForm(p => ({ ...p, banco: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Agência</Label><Input value={form.agencia} onChange={e => setForm(p => ({ ...p, agencia: e.target.value }))} /></div>
              <div><Label>Conta</Label><Input value={form.conta} onChange={e => setForm(p => ({ ...p, conta: e.target.value }))} /></div>
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
