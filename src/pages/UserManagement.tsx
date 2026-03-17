import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { fetchAllUsersWithRoles, updateUserRole, UserWithRole } from '@/lib/cashRegister';
import { MODULES, fetchAllPermissions, setModulePermission, ModulePermission } from '@/lib/modulePermissions';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

function roleBadge(role: string) {
  switch (role) {
    case 'admin': return <Badge className="bg-destructive text-destructive-foreground">Administrador</Badge>;
    case 'conferente': return <Badge className="bg-warning text-warning-foreground">Conferente</Badge>;
    default: return <Badge className="bg-primary text-primary-foreground">Operador</Badge>;
  }
}

export default function UserManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const load = async () => {
    try {
      const [usersData, permsData] = await Promise.all([fetchAllUsersWithRoles(), fetchAllPermissions()]);
      setUsers(usersData);
      setPermissions(permsData);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateUserRole(userId, newRole);
      toast.success('Perfil atualizado');
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handlePermissionToggle = async (userId: string, module: string, currentGranted: boolean) => {
    if (!user) return;
    try {
      await setModulePermission(userId, module, !currentGranted, user.id);
      toast.success('Permissão atualizada');
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const getUserPermission = (userId: string, module: string): boolean => {
    const perm = permissions.find(p => p.user_id === userId && p.module === module);
    return perm?.granted ?? false;
  };

  const nonAdminUsers = users.filter(u => u.role !== 'admin');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-5 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gerenciamento de Usuários</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Definir perfis, permissões e acesso a módulos</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle>Perfis de Usuários</CardTitle></CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Usuário</TableHead>
                        <TableHead>Perfil Atual</TableHead>
                        <TableHead>Alterar Perfil</TableHead>
                        <TableHead>Cadastro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.user_id}>
                          <TableCell className="font-medium">{u.display_name}</TableCell>
                          <TableCell>{roleBadge(u.role)}</TableCell>
                          <TableCell>
                            {u.user_id === user?.id ? (
                              <span className="text-sm text-muted-foreground">Você</span>
                            ) : (
                              <Select value={u.role} onValueChange={(v) => handleRoleChange(u.user_id, v)}>
                                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="operador">Operador</SelectItem>
                                  <SelectItem value="conferente">Conferente</SelectItem>
                                  <SelectItem value="admin">Administrador</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Acesso aos Módulos</CardTitle>
                <p className="text-sm text-muted-foreground">Administradores têm acesso total. Configure o acesso dos demais usuários abaixo.</p>
              </CardHeader>
              <CardContent>
                {nonAdminUsers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Todos os usuários são administradores.</p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Usuário</TableHead>
                          {MODULES.map(m => (
                            <TableHead key={m.key} className="text-center text-xs">{m.label}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {nonAdminUsers.map(u => (
                          <TableRow key={u.user_id}>
                            <TableCell className="font-medium">{u.display_name}</TableCell>
                            {MODULES.map(m => {
                              const granted = getUserPermission(u.user_id, m.key);
                              return (
                                <TableCell key={m.key} className="text-center">
                                  <Switch
                                    checked={granted}
                                    onCheckedChange={() => handlePermissionToggle(u.user_id, m.key, granted)}
                                  />
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
