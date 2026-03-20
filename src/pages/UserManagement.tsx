import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Shield,
  ShieldCheck,
  CheckSquare,
  XSquare,
  Users,
  KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { fetchAllUsersWithRoles, updateUserRole, UserWithRole } from '@/lib/cashRegister';
import {
  MODULES,
  ACTIONS,
  ACTION_LABELS,
  ActionKey,
  fetchAllActionPermissions,
  setUserActionPermission,
  UserActionPermission,
} from '@/lib/modulePermissions';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

function roleBadge(role: string) {
  switch (role) {
    case 'admin':
      return <Badge className="bg-destructive text-destructive-foreground">Administrador</Badge>;
    case 'conferente':
      return <Badge className="bg-amber-500 text-white">Conferente</Badge>;
    default:
      return <Badge className="bg-primary text-primary-foreground">Operador</Badge>;
  }
}

export default function UserManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [permissions, setPermissions] = useState<UserActionPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  const load = async () => {
    try {
      const [usersData, permsData] = await Promise.all([
        fetchAllUsersWithRoles(),
        fetchAllActionPermissions(),
      ]);

      setUsers(usersData);
      setPermissions(permsData);

      if (!selectedUserId && usersData.length > 0) {
        setSelectedUserId(usersData[0].user_id);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredUsers = users.filter((u) => {
    if (searchQuery && !u.display_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterRole !== 'all' && u.role !== filterRole) return false;
    return true;
  });

  const selectedUser =
    filteredUsers.find((u) => u.user_id === selectedUserId) ||
    users.find((u) => u.user_id === selectedUserId);

  const isSelectedAdmin = selectedUser?.role === 'admin';

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateUserRole(userId, newRole);
      toast.success('Perfil atualizado');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  function getUserPerm(userId: string, module: string): UserActionPermission | undefined {
    return permissions.find((p) => p.user_id === userId && p.module === module);
  }

  function getAction(userId: string, module: string, action: ActionKey): boolean {
    const perm = getUserPerm(userId, module);
    if (!perm) return false;
    return perm[action];
  }

  async function toggleAction(userId: string, module: string, action: ActionKey, current: boolean) {
    if (!user) return;

    try {
      await setUserActionPermission(userId, module, { [action]: !current }, user.id);
      toast.success('Permissão atualizada');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function setAllForModule(userId: string, module: string, value: boolean) {
    if (!user) return;

    try {
      await setUserActionPermission(
        userId,
        module,
        {
          can_view: value,
          can_create: value,
          can_edit: value,
          can_delete: value,
          can_export: value,
        },
        user.id
      );
      toast.success(value ? 'Todas permissões habilitadas' : 'Todas permissões removidas');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const countModulesGranted = (userId: string): number => {
    let count = 0;
    for (const m of MODULES) {
      if (getAction(userId, m.key, 'can_view')) count++;
    }
    return count;
  };

  const countTotalActions = (userId: string): number => {
    let count = 0;
    for (const m of MODULES) {
      for (const action of ACTIONS) {
        if (getAction(userId, m.key, action)) count++;
      }
    }
    return count;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="container mx-auto flex items-center gap-4 px-4 py-5">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Gerenciamento de Usuários</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Perfis, permissões e acesso por ação em cada módulo
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card className="border-primary/10 bg-gradient-to-br from-card to-card/70">
            <CardContent className="flex items-center gap-3 p-5">
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Usuários</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/10 bg-gradient-to-br from-card to-card/70">
            <CardContent className="flex items-center gap-3 p-5">
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Administradores</p>
                <p className="text-2xl font-bold">{users.filter((u) => u.role === 'admin').length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/10 bg-gradient-to-br from-card to-card/70">
            <CardContent className="flex items-center gap-3 p-5">
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Módulos</p>
                <p className="text-2xl font-bold">{MODULES.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex min-h-[calc(100vh-250px)] flex-col gap-6 xl:flex-row">
          <Card className="w-full shrink-0 border-primary/10 xl:w-80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Usuários</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuário..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos os perfis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os perfis</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="conferente">Conferente</SelectItem>
                  <SelectItem value="operador">Operador</SelectItem>
                </SelectContent>
              </Select>

              <ScrollArea className="h-[calc(100vh-360px)]">
                <div className="space-y-2 pr-2">
                  {filteredUsers.map((u) => (
                    <button
                      key={u.user_id}
                      onClick={() => setSelectedUserId(u.user_id)}
                      className={`w-full overflow-hidden rounded-xl border p-3 text-left transition-all ${
                        selectedUserId === u.user_id
                          ? 'border-primary/30 bg-primary/10 shadow-sm'
                          : 'border-transparent hover:bg-muted/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{u.display_name}</span>
                      </div>

                      <div className="mt-2">
                        {roleBadge(u.role)}
                      </div>

                      <p className="mt-2 text-xs text-muted-foreground">
                        {u.role === 'admin'
                          ? 'Acesso total'
                          : `${countModulesGranted(u.user_id)}/${MODULES.length} módulos`}
                      </p>
                    </button>
                  ))}

                  {filteredUsers.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum usuário encontrado
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="min-w-0 flex-1">
            {!selectedUser ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Shield className="mx-auto mb-3 h-12 w-12 opacity-30" />
                  <p className="text-lg font-medium">Selecione um usuário</p>
                  <p className="text-sm">
                    Clique em um usuário na lista para gerenciar suas permissões
                  </p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="space-y-6 pr-4">
                  <Card className="border-primary/10">
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-1">
                          <h3 className="truncate text-xl font-bold">{selectedUser.display_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Cadastro: {new Date(selectedUser.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="shrink-0">{roleBadge(selectedUser.role)}</div>
                      </div>

                      <Separator className="my-4" />

                      <div className="grid gap-4 md:grid-cols-3">
                        <Card className="border-border/60 shadow-none">
                          <CardContent className="p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Perfil</p>
                            <div className="mt-3">
                              {selectedUser.user_id === user?.id ? (
                                <span className="text-sm text-muted-foreground">
                                  Você não pode alterar seu próprio perfil
                                </span>
                              ) : (
                                <Select
                                  value={selectedUser.role}
                                  onValueChange={(v) => handleRoleChange(selectedUser.user_id, v)}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="operador">Operador</SelectItem>
                                    <SelectItem value="conferente">Conferente</SelectItem>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-border/60 shadow-none">
                          <CardContent className="p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Módulos com acesso</p>
                            <p className="mt-3 text-2xl font-bold">
                              {isSelectedAdmin ? 'Todos' : countModulesGranted(selectedUser.user_id)}
                            </p>
                          </CardContent>
                        </Card>

                        <Card className="border-border/60 shadow-none">
                          <CardContent className="p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ações liberadas</p>
                            <p className="mt-3 text-2xl font-bold">
                              {isSelectedAdmin ? 'Todas' : countTotalActions(selectedUser.user_id)}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    </CardContent>
                  </Card>

                  {isSelectedAdmin && (
                    <Card className="border-primary/30 bg-primary/5">
                      <CardContent className="flex items-center gap-3 p-5">
                        <ShieldCheck className="h-6 w-6 shrink-0 text-primary" />
                        <div>
                          <p className="text-sm font-semibold">Administrador - Acesso Total</p>
                          <p className="text-xs text-muted-foreground">
                            Administradores têm acesso total a todos os módulos e ações automaticamente.
                            As permissões abaixo não se aplicam.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {!isSelectedAdmin && (
                    <>
                      <div>
                        <h3 className="text-base font-semibold">Permissões por Módulo</h3>
                        <p className="text-xs text-muted-foreground">
                          Configure visualização, criação, edição, exclusão e exportação por tela.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {MODULES.map((m) => {
                          const hasAny = ACTIONS.some((a) => getAction(selectedUser.user_id, m.key, a));
                          const hasAll = ACTIONS.every((a) => getAction(selectedUser.user_id, m.key, a));

                          return (
                            <Card
                              key={m.key}
                              className={`border-border/70 transition-all ${
                                hasAny ? 'border-primary/20 bg-primary/[0.03]' : ''
                              }`}
                            >
                              <CardHeader className="px-4 pb-2 pt-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <CardTitle className="pr-2 text-sm font-semibold">{m.label}</CardTitle>

                                  <div className="flex flex-wrap gap-1 sm:justify-end">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => setAllForModule(selectedUser.user_id, m.key, true)}
                                      disabled={hasAll}
                                    >
                                      <CheckSquare className="mr-1 h-3 w-3" />
                                      Tudo
                                    </Button>

                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => setAllForModule(selectedUser.user_id, m.key, false)}
                                      disabled={!hasAny}
                                    >
                                      <XSquare className="mr-1 h-3 w-3" />
                                      Limpar
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>

                              <CardContent className="px-4 pb-4">
                                <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                                  {ACTIONS.map((action) => {
                                    const granted = getAction(selectedUser.user_id, m.key, action);

                                    return (
                                      <label
                                        key={action}
                                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                                          granted
                                            ? 'border-primary/20 bg-primary/5'
                                            : 'border-border/70 bg-background'
                                        }`}
                                      >
                                        <Switch
                                          checked={granted}
                                          onCheckedChange={() =>
                                            toggleAction(selectedUser.user_id, m.key, action, granted)
                                          }
                                          className="scale-75"
                                        />
                                        <span className="text-xs font-medium">{ACTION_LABELS[action]}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
