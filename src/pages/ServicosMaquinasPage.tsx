import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  ServicoMaquina,
  TIPO_SERVICO_LABEL,
  TipoServico,
  deleteServico,
  fetchServicos,
} from '@/lib/servicosMaquinasService';
import { toast } from 'sonner';
import AuditInfo from '@/components/AuditInfo';
import { useProfileMap } from '@/hooks/useProfileMap';
import ServicoMaquinaDialog from '@/components/servicos/ServicoMaquinaDialog';

function formatDate(d: string | null | undefined) {
  if (!d || typeof d !== 'string') return '—';
  try {
    const [y, m, day] = d.split('-');
    if (!y || !m || !day) return '—';
    return `${day}/${m}/${y}`;
  } catch {
    return '—';
  }
}

export default function ServicosMaquinasPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermissions();
  const profileMap = useProfileMap();
  const [items, setItems] = useState<ServicoMaquina[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<TipoServico | 'all'>('all');
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<ServicoMaquina | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchServicos();
      setItems(data);
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
    const term = search.toLowerCase().trim();
    return items.filter((s) => {
      if (tipoFilter !== 'all' && s.tipo_servico !== tipoFilter) return false;
      if (!term) return true;
      const haystack = [
        (s as any).veiculo?.placa,
        (s as any).veiculo?.modelo,
        (s as any).obra?.nome,
        s.observacao,
        ...(s.pecas || []).map((p) => p.componente?.nome),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [items, search, tipoFilter]);

  function openNew() {
    setEditing(null);
    setShowDialog(true);
  }

  function openEdit(s: ServicoMaquina) {
    setEditing(s);
    setShowDialog(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir serviço?')) return;
    try {
      if (!user) throw new Error('Usuário não encontrado');
      await deleteServico(id, user.id);
      toast.success('Excluído');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Serviços de Máquinas</h2>
        {canCreate('servicos_maquinas') && (
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" />
            Novo
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por máquina, obra, peça, observação..."
          className="max-w-md"
        />
        <Select value={tipoFilter} onValueChange={(v) => setTipoFilter(v as any)}>
          <SelectTrigger className="w-[240px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="conserto">Conserto</SelectItem>
            <SelectItem value="troca_pecas">Troca de peças</SelectItem>
            <SelectItem value="conserto_troca_pecas">Conserto + Troca de peças</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Máquina</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Medição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Peças</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead>Auditoria</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  Nenhum serviço registrado
                </TableCell>
              </TableRow>
            )}
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{formatDate(s.data)}</TableCell>
                <TableCell>
                  <div className="font-medium">{(s as any).veiculo?.placa || '—'}</div>
                  <div className="text-xs text-muted-foreground">
                    {(s as any).veiculo?.modelo}
                  </div>
                </TableCell>
                <TableCell>{(s as any).obra?.nome || '—'}</TableCell>
                <TableCell>{s.horimetro != null ? `${s.horimetro} ${s.tipo_medicao === 'km' ? 'km' : s.tipo_medicao === 'meses' ? 'meses' : 'h'}` : '—'}</TableCell>
                <TableCell>{TIPO_SERVICO_LABEL[s.tipo_servico]}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[260px]">
                    {(s.pecas || []).map((p) => (
                      <Badge
                        key={p.id}
                        variant={p.status === 'defeito' ? 'destructive' : 'secondary'}
                      >
                        {p.componente?.nome || '—'}
                      </Badge>
                    ))}
                    {(s.pecas || []).length === 0 && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="max-w-[260px] whitespace-pre-wrap text-xs">
                  {s.observacao || '—'}
                </TableCell>
                <TableCell>
                  <AuditInfo
                    createdBy={s.created_by}
                    createdAt={s.created_at}
                    updatedBy={s.updated_by}
                    updatedAt={s.updated_at}
                    profileMap={profileMap}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {canEdit('servicos_maquinas') && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete('servicos_maquinas') && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ServicoMaquinaDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        editing={editing}
        onSaved={load}
      />
    </div>
  );
}
