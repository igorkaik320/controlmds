import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { fetchAuditLog, fetchProfiles, deleteAuditEntry, AuditEntry } from '@/lib/cashRegister';
import { parseDateTimeSafe } from '@/lib/formatters';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { toast } from 'sonner';

function actionLabel(action: string) {
  switch (action) {
    case 'criacao':
      return <Badge className="bg-entrada text-entrada-foreground">Criação</Badge>;
    case 'edicao':
      return <Badge className="bg-warning text-warning-foreground">Edição</Badge>;
    case 'exclusao':
      return <Badge className="bg-saida text-saida-foreground">Exclusão</Badge>;
    default:
      return <Badge variant="outline">{action}</Badge>;
  }
}

function renderAuditDate(value?: string | null) {
  if (!value) return '—';
  const parsed = parseDateTimeSafe(value);
  if (!parsed) return '—';
  return parsed.toLocaleString('pt-BR');
}

export default function AuditLogPage() {
  const navigate = useNavigate();
  const { canDelete } = useModulePermissions();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const allowDelete = canDelete('auditoria');

  const load = async () => {
    try {
      setLoading(true);

      const auditData = await fetchAuditLog({
        action: filterAction !== 'all' ? filterAction : undefined,
        userId: filterUser !== 'all' ? filterUser : undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
      });

      setEntries(auditData);

      try {
        const profiles = await fetchProfiles();
        setProfileMap(profiles);
      } catch {
        setProfileMap({});
      }
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível carregar a auditoria.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filterAction, filterUser, filterDateFrom, filterDateTo]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este registro de auditoria?')) return;

    try {
      await deleteAuditEntry(id);
      toast.success('Registro excluído');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const userOptions = Object.entries(profileMap);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-5 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Histórico de Alterações</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Auditoria completa do sistema</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label>Ação</Label>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="criacao">Criação</SelectItem>
                <SelectItem value="edicao">Edição</SelectItem>
                <SelectItem value="exclusao">Exclusão</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Usuário</Label>
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {userOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>De</Label>
            <Input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-40"
            />
          </div>

          <div>
            <Label>Até</Label>
            <Input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-40"
            />
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum registro encontrado.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Valores Antigos</TableHead>
                    <TableHead>Valores Novos</TableHead>
                    {allowDelete && <TableHead className="w-16 text-center">Ações</TableHead>}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id} className="group">
                      <TableCell className="text-sm font-mono">
                        {renderAuditDate(e.created_at)}
                      </TableCell>
                      <TableCell>{actionLabel(e.action)}</TableCell>
                      <TableCell className="text-sm capitalize">{e.entity_type}</TableCell>
                      <TableCell className="text-sm">{profileMap[e.user_id] || e.user_id}</TableCell>
                      <TableCell className="text-xs font-mono max-w-[300px]">
                        {e.old_values ? (
                          <pre className="whitespace-pre-wrap break-all">
                            {JSON.stringify(e.old_values, null, 1)}
                          </pre>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-xs font-mono max-w-[300px]">
                        {e.new_values ? (
                          <pre className="whitespace-pre-wrap break-all">
                            {JSON.stringify(e.new_values, null, 1)}
                          </pre>
                        ) : '—'}
                      </TableCell>

                      {allowDelete && (
                        <TableCell>
                          <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(e.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
