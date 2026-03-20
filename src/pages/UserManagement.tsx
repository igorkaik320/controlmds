import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Shield, ShieldCheck, CheckSquare, XSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { fetchAllUsersWithRoles, updateUserRole, UserWithRole } from '@/lib/cashRegister';
import {
  MODULES,
  ACTIONS,
  ACTION_LABELS,
  ActionKey,
  ModuleKey,
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

function roleLabel(role: string) {
  switch (role) {
    case 'admin': return 'Administrador';
    case 'conferente': return 'Conferente';
    default: return 'Operador';
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
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredUsers = users.filter((u) => {
    if (searchQuery && !u.display_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterRole !== 'all' && u.role !== filterRole) return false;
    return true;
  });

  const selectedUser = users.find((u) => u.user_id === selectedUserId);
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
      await setUserActionPermission(userId, module, {
        can_view: value,
        can_create: value,
        can_edit: value,
        can_delete: value,
        can_export: value,
      }, user.id);
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

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-5 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gerenciamento de Usuários</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Perfis, permissões e acesso por ação em cada módulo</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="flex gap-6 min-h-[calc(100vh-140px)]">
          {/* Left panel - User list */}
          <div className="w-80 shrink-0 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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

            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-1 pr-2">
                {filteredUsers.map((u) => (
                  <button
                    key={u.user_id}
                    onClick={() => setSelectedUserId(u.user_id)}
                    className={`w-full text-left rounded-lg p-3 transition-colors ${
                      selectedUserId === u.user_id
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-muted/50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate">{u.display_name}</span>
                      {roleBadge(u.role)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {u.role === 'admin'
                        ? 'Acesso total'
                        : `${countModulesGranted(u.user_id)}/${MODULES.length} módulos`}
                    </p>
                  </button>
                ))}
                {filteredUsers.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhum usuário encontrado</p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right panel - User details + permissions */}
          <div className="flex-1 min-w-0">
            {!selectedUser ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-lg font-medium">Selecione um usuário</p>
                  <p className="text-sm">Clique em um usuário na lista para gerenciar suas permissões</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-180px)]">
                <div className="space-y-6 pr-4">
                  {/* User info card */}
                  <Card>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h3 className="text-lg font-semibold">{selectedUser.display_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Cadastro: {new Date(selectedUser.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div>{roleBadge(selectedUser.role)}</div>
                      </div>

                      <Separator className="my-4" />

                      <div className="flex items-center gap-4">
                        <Label className="text-sm font-medium">Perfil:</Label>
                        {selectedUser.user_id === user?.id ? (
                          <span className="text-sm text-muted-foreground">Você (não pode alterar seu próprio perfil)</span>
                        ) : (
                          <Select
                            value={selectedUser.role}
                            onValueChange={(v) => handleRoleChange(selectedUser.user_id, v)}
                          >
                            <SelectTrigger className="w-48">
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

                  {/* Admin notice */}
                  {isSelectedAdmin && (
                    <Card className="border-primary/30 bg-primary/5">
                      <CardContent className="p-5 flex items-center gap-3">
                        <ShieldCheck className="h-6 w-6 text-primary shrink-0" />
                        <div>
                          <p className="font-medium text-sm">Administrador — Acesso Total</p>
                          <p className="text-xs text-muted-foreground">
                            Administradores têm acesso total a todos os módulos e ações automaticamente.
                            As permissões abaixo não se aplicam.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Permissions grid */}
                  {!isSelectedAdmin && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-semibold">Permissões por Módulo</h3>
                          <p className="text-xs text-muted-foreground">
                            {countModulesGranted(selectedUser.user_id)} de {MODULES.length} módulos com visualização
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                        {MODULES.map((m) => {
                          const hasAny = ACTIONS.some((a) => getAction(selectedUser.user_id, m.key, a));
                          const hasAll = ACTIONS.every((a) => getAction(selectedUser.user_id, m.key, a));

                          return (
                            <Card key={m.key} className={`transition-colors ${hasAny ? 'border-primary/20' : ''}`}>
                              <CardHeader className="pb-2 pt-3 px-4">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium">{m.label}</CardTitle>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => setAllForModule(selectedUser.user_id, m.key, true)}
                                      disabled={hasAll}
                                    >
                                      <CheckSquare className="h-3 w-3 mr-1" />
                                      Tudo
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => setAllForModule(selectedUser.user_id, m.key, false)}
                                      disabled={!hasAny}
                                    >
                                      <XSquare className="h-3 w-3 mr-1" />
                                      Limpar
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="px-4 pb-3">
                                <div className="flex flex-wrap gap-x-4 gap-y-2">
                                  {ACTIONS.map((action) => {
                                    const granted = getAction(selectedUser.user_id, m.key, action);
                                    return (
                                      <label
                                        key={action}
                                        className="flex items-center gap-2 cursor-pointer"
                                      >
                                        <Switch
                                          checked={granted}
                                          onCheckedChange={() =>
                                            toggleAction(selectedUser.user_id, m.key, action, granted)
                                          }
                                          className="scale-75"
                                        />
                                        <span className="text-xs">{ACTION_LABELS[action]}</span>
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
