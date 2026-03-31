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
  LayoutDashboard,
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
  MapPinned,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModuleKey } from '@/lib/modulePermissions';
import { confirmDraftDiscard } from '@/lib/draftGuard';
import { MdsLogo } from './MdsLogo';

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
      label: 'Administracao',
      defaultOpen: true,
      items: [
        { title: 'Painel Executivo', url: '/painel-executivo', icon: LayoutDashboard },
        { title: 'Usuarios', url: '/usuarios', icon: Users },
        { title: 'Auditoria', url: '/auditoria', icon: History },
        { title: 'Config. Relatorio', url: '/config-relatorio', icon: Settings },
      ],
    });
  }

  groups.push({
    label: 'Financeiro',
    defaultOpen: true,
    items: [
      { title: 'Controle de Caixa', url: '/controle-caixa', icon: Landmark, module: 'controle_caixa' },
    ],
  });

  groups.push({
    label: 'Suprimentos',
    defaultOpen: true,
    items: [
      { title: 'Compras Faturadas', url: '/compras/faturadas', icon: Receipt, module: 'compras_faturadas' },
      { title: 'Compras a Vista', url: '/compras/avista', icon: ShoppingCart, module: 'compras_avista' },
      { title: 'Espelho Geral', url: '/compras/espelho', icon: Eye, module: 'espelho_geral' },
      { title: 'Programacao Semanal', url: '/compras/programacao-semanal', icon: CalendarDays, module: 'programacao_semanal' },
      { title: 'Espelho Semanal', url: '/compras/espelho-semanal', icon: BarChart3, module: 'espelho_semanal' },
      { title: 'Parcelas Faturadas', url: '/compras/parcelas-faturadas', icon: CalendarDays, module: 'parcelas_faturadas' },
    ],
  });

  groups.push({
    label: 'Controle de Combustivel',
    defaultOpen: false,
    items: [
      { title: 'Dashboard', url: '/combustivel/dashboard', icon: Fuel, module: 'combustivel_dashboard' },
      { title: 'Abastecimentos', url: '/combustivel/abastecimentos', icon: Droplets, module: 'abastecimentos' },
      { title: 'Revisoes', url: '/combustivel/revisoes', icon: Wrench, module: 'revisoes_combustivel' },
    ],
  });

  groups.push({
    label: 'Cadastros',
    defaultOpen: false,
    items: [
      { title: 'Empresas', url: '/empresas', icon: Factory, module: 'empresas' },
      { title: 'Fornecedores', url: '/fornecedores', icon: Truck, module: 'fornecedores' },
      { title: 'Obras', url: '/obras', icon: Building2, module: 'obras' },
      { title: 'Responsaveis', url: '/responsaveis', icon: UserCheck, module: 'responsaveis' },
      { title: 'Veiculos/Maquinas', url: '/veiculos', icon: Car, module: 'veiculos_maquinas' },
      { title: 'Postos de Combustivel', url: '/postos-combustivel', icon: MapPinned, module: 'postos_combustivel' },
      { title: 'Tipos de Combustivel', url: '/tipos-combustivel', icon: Droplets, module: 'tipos_combustivel' },
    ],
  });

  function renderMenuItem(item: MenuItem) {
    const hasAccess = !item.module || canAccess(item.module);
    const locked = item.module && !hasAccess && !permLoading;

    if (locked) {
      return (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton className="cursor-not-allowed rounded-xl px-3 py-2 text-white/35 opacity-45">
            <item.icon className="h-4 w-4" />
            {!collapsed && (
              <>
                <span>{item.title}</span>
                <Lock className="ml-auto h-3.5 w-3.5" />
              </>
            )}
            {collapsed && <Lock className="h-3.5 w-3.5" />}
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            className="rounded-xl px-3 py-2 text-[14px] text-white/78 transition-all duration-200 hover:bg-white/8 hover:text-white"
            activeClassName="bg-blue-500 text-white font-semibold shadow-[0_6px_18px_rgba(59,130,246,0.35)]"
          >
            <item.icon className="h-4 w-4" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  async function handleSignOut() {
    if (!confirmDraftDiscard()) return;
    await signOut();
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-700/40 bg-[#233247]">
      <SidebarContent className="bg-[#233247]">
        {!collapsed && (
          <div className="border-b border-white/10 bg-[#0f1a2d] px-4 pt-6 pb-4">
            <div className="mb-3">
              <MdsLogo
                lettersClassName="text-3xl font-black uppercase tracking-[0.05em] text-white"
                textClassName="text-sm font-semibold uppercase tracking-[0.35em] text-blue-200 -mt-1 translate-y-2"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-white/75">{profile?.display_name}</p>
              <span className="inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90">
                {userRole === 'admin'
                  ? 'Administracao'
                  : userRole === 'conferente'
                  ? 'Conferente'
                  : 'Operador'}
              </span>
            </div>
          </div>
        )}

        <SidebarGroup className="px-3 py-3">
          {groups.map((group) => (
            <div key={group.label} className="mb-3">
              {collapsed ? (
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-1">
                    {group.items.map(renderMenuItem)}
                  </SidebarMenu>
                </SidebarGroupContent>
              ) : (
                <Collapsible defaultOpen={group.defaultOpen}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55 transition-colors hover:text-white/85">
                    <span>{group.label}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu className="space-y-1">
                        {group.items.map(renderMenuItem)}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          ))}
        </SidebarGroup>

        <div className="mt-auto border-t border-white/10 p-3">
          <Button
            variant="ghost"
            className="w-full justify-start rounded-xl text-white/72 hover:bg-white/8 hover:text-white"
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
