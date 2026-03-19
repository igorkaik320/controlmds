import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NavLink } from '@/components/NavLink';
import {
  Landmark,
  ShoppingCart,
  Receipt,
  Eye,
  Settings,
  Users,
  History,
  Truck,
  LogOut,
  Lock,
  Building2,
  ChevronDown,
  CalendarDays,
  BarChart3,
  UserCheck,
  Fuel,
  Car,
  Droplets,
  Factory,
  Tags,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModuleKey } from '@/lib/modulePermissions';

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  module?: ModuleKey;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
  defaultOpen?: boolean;
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { userRole, profile, signOut } = useAuth();
  const { canAccess, loading: permLoading } = useModulePermissions();
  const isAdmin = userRole === 'admin';

  const groups: MenuGroup[] = [];

  if (isAdmin) {
    groups.push({
      label: 'Administração',
      defaultOpen: true,
      items: [
        { title: 'Usuários', url: '/usuarios', icon: Users },
        { title: 'Auditoria', url: '/auditoria', icon: History },
        { title: 'Config. Relatório', url: '/config-relatorio', icon: Settings },
      ],
    });
  }

  groups.push({
    label: 'Financeiro',
    defaultOpen: true,
    items: [
      { title: 'Controle de Caixa', url: '/', icon: Landmark, module: 'controle_caixa' },
    ],
  });

  groups.push({
    label: 'Previsão de Compras',
    defaultOpen: true,
    items: [
      { title: 'Compras Faturadas', url: '/compras/faturadas', icon: Receipt, module: 'compras_faturadas' },
      { title: 'Compras à Vista', url: '/compras/avista', icon: ShoppingCart, module: 'compras_avista' },
      { title: 'Espelho Geral', url: '/compras/espelho', icon: Eye, module: 'espelho_geral' },
      { title: 'Programação Semanal', url: '/compras/programacao-semanal', icon: CalendarDays, module: 'programacao_semanal' },
      { title: 'Espelho Semanal', url: '/compras/espelho-semanal', icon: BarChart3, module: 'espelho_semanal' },
    ],
  });

  groups.push({
    label: 'Controle de Combustível',
    defaultOpen: false,
    items: [
      { title: 'Dashboard', url: '/combustivel/dashboard', icon: Fuel, module: 'combustivel_dashboard' },
      { title: 'Abastecimentos', url: '/combustivel/abastecimentos', icon: Droplets, module: 'abastecimentos' },
    ],
  });

  groups.push({
    label: 'Cadastros',
    defaultOpen: false,
    items: [
      { title: 'Empresas', url: '/empresas', icon: Factory, module: 'empresas' },
      { title: 'Fornecedores', url: '/fornecedores', icon: Truck, module: 'fornecedores' },
      { title: 'Obras', url: '/obras', icon: Building2, module: 'obras' },
      { title: 'Responsáveis', url: '/responsaveis', icon: UserCheck, module: 'responsaveis' },
      { title: 'Veículos/Máquinas', url: '/veiculos', icon: Car, module: 'veiculos_maquinas' },
      { title: 'Categorias de Veículos', url: '/categorias-veiculos', icon: Tags, module: 'veiculos_maquinas' },
      { title: 'Tipos de Combustível', url: '/tipos-combustivel', icon: Droplets, module: 'tipos_combustivel' },
    ],
  });

  function renderMenuItem(item: MenuItem) {
    const hasAccess = !item.module || canAccess(item.module);
    const locked = item.module && !hasAccess && !permLoading;

    if (locked) {
      return (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton className="cursor-not-allowed text-sidebar-foreground/50 opacity-40">
            <item.icon className="h-4 w-4" />
            {!collapsed && (
              <>
                <span>{item.title}</span>
                <Lock className="ml-auto h-3 w-3" />
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
          <NavLink
            to={item.url}
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeClassName="bg-sidebar-primary font-medium text-sidebar-primary-foreground"
          >
            <item.icon className="h-4 w-4" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  async function handleSignOut() {
    await signOut();
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="bg-sidebar-background">
        {!collapsed && (
          <div className="border-b border-sidebar-border p-4">
            <h2 className="tracking-tight text-base font-bold text-sidebar-foreground">ControlMDS</h2>
            <p className="mt-0.5 text-xs text-sidebar-foreground/60">{profile?.display_name}</p>
          </div>
        )}

        <SidebarGroup className="px-2 py-1">
          {groups.map((group) => (
            <div key={group.label} className="mb-1">
              {collapsed ? (
                <SidebarGroupContent>
                  <SidebarMenu>{group.items.map(renderMenuItem)}</SidebarMenu>
                </SidebarGroupContent>
              ) : (
                <Collapsible defaultOpen={group.defaultOpen}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground">
                    {group.label}
                    <ChevronDown className="h-3 w-3 transition-transform" />
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

        <div className="mt-auto border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {!collapsed && 'Sair'}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
