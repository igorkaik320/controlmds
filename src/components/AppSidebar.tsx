import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NavLink } from '@/components/NavLink';
import {
  Landmark, ShoppingCart, Receipt, Eye, Settings, Users, History, Truck, LogOut, Lock,
  Building2, ChevronDown, CalendarDays, BarChart3, UserCheck, Fuel, Car, Droplets,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModuleKey } from '@/lib/modulePermissions';

interface MenuItem { title: string; url: string; icon: any; module?: ModuleKey; }
interface MenuGroup { label: string; items: MenuItem[]; defaultOpen?: boolean; }

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { userRole, profile, signOut } = useAuth();
  const { canAccess, loading: permLoading } = useModulePermissions();
  const isAdmin = userRole === 'admin';

  const groups: MenuGroup[] = [
    {
      label: 'Financeiro',
      defaultOpen: true,
      items: [
        { title: 'Controle de Caixa', url: '/', icon: Landmark, module: 'controle_caixa' },
      ],
    },
    {
      label: 'Previsão de Compras',
      defaultOpen: true,
      items: [
        { title: 'Compras Faturadas', url: '/compras/faturadas', icon: Receipt, module: 'compras_faturadas' },
        { title: 'Compras à Vista', url: '/compras/avista', icon: ShoppingCart, module: 'compras_avista' },
        { title: 'Espelho Geral', url: '/compras/espelho', icon: Eye, module: 'espelho_geral' },
        { title: 'Programação Semanal', url: '/compras/programacao-semanal', icon: CalendarDays, module: 'programacao_semanal' },
        { title: 'Espelho Semanal', url: '/compras/espelho-semanal', icon: BarChart3, module: 'espelho_semanal' },
      ],
    },
    {
      label: 'Controle de Combustível',
      defaultOpen: false,
      items: [
        { title: 'Dashboard', url: '/combustivel/dashboard', icon: Fuel, module: 'combustivel_dashboard' },
        { title: 'Abastecimentos', url: '/combustivel/abastecimentos', icon: Droplets, module: 'abastecimentos' },
      ],
    },
    {
      label: 'Cadastros',
      defaultOpen: false,
      items: [
        { title: 'Fornecedores', url: '/fornecedores', icon: Truck, module: 'fornecedores' },
        { title: 'Obras', url: '/obras', icon: Building2, module: 'obras' },
        { title: 'Responsáveis', url: '/responsaveis', icon: UserCheck, module: 'responsaveis' },
        { title: 'Veículos/Máquinas', url: '/veiculos', icon: Car, module: 'veiculos_maquinas' },
        { title: 'Tipos de Combustível', url: '/tipos-combustivel', icon: Droplets, module: 'tipos_combustivel' },
      ],
    },
  ];

  const adminGroup: MenuGroup | null = isAdmin ? {
    label: 'Administração',
    defaultOpen: false,
    items: [
      { title: 'Usuários', url: '/usuarios', icon: Users },
      { title: 'Auditoria', url: '/auditoria', icon: History },
      { title: 'Config. Relatório', url: '/config-relatorio', icon: Settings },
    ],
  } : null;

  if (adminGroup) groups.push(adminGroup);

  function renderMenuItem(item: MenuItem) {
    const hasAccess = !item.module || canAccess(item.module);
    const locked = item.module && !hasAccess && !permLoading;

    if (locked) {
      return (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton className="opacity-50 cursor-not-allowed">
            <item.icon className="h-4 w-4" />
            {!collapsed && (
              <>
                <span>{item.title}</span>
                <Lock className="h-3 w-3 ml-auto" />
              </>
            )}
            {collapsed && <Lock className="h-3 w-3" />}
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild>
          <NavLink to={item.url}>
            <item.icon className="h-4 w-4" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {!collapsed && (
          <div className="p-4 border-b border-sidebar-border">
            <h2 className="text-lg font-bold text-sidebar-foreground">Sistema Financeiro</h2>
            <p className="text-xs text-muted-foreground">{profile?.display_name}</p>
          </div>
        )}

        <SidebarGroup>
          {groups.map((group) => (
            <div key={group.label}>
              {collapsed ? (
                <SidebarGroupContent>
                  <SidebarMenu>{group.items.map(renderMenuItem)}</SidebarMenu>
                </SidebarGroupContent>
              ) : (
                <Collapsible defaultOpen={group.defaultOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground">
                    {group.label}
                    <ChevronDown className="h-3 w-3" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>{group.items.map(renderMenuItem)}</SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          ))}
        </SidebarGroup>

        <div className="mt-auto p-2 border-t border-sidebar-border">
          <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            {!collapsed && 'Sair'}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
