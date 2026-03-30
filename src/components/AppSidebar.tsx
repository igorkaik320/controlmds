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
  ChevronRight,
  CalendarDays,
  BarChart3,
  UserCheck,
  Fuel,
  Car,
  Droplets,
  Factory,
  MapPinned,
  Wrench,
  Package,
  Cog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModuleKey } from '@/lib/modulePermissions';
import { confirmDraftDiscard } from '@/lib/draftGuard';
import { MdsLogo } from './MdsLogo';
import { useState } from 'react';

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  module?: ModuleKey;
}

interface SubGroup {
  label: string;
  icon: any;
  items: MenuItem[];
}

interface MenuGroup {
  label: string;
  icon?: any;
  items?: MenuItem[];
  subGroups?: SubGroup[];
  defaultOpen?: boolean;
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { userRole, profile, signOut } = useAuth();
  const { canAccess, loading: permLoading } = useModulePermissions();
  const isAdmin = userRole === 'admin';

  const [openSubGroups, setOpenSubGroups] = useState<Record<string, boolean>>({
    Compras: true,
  });

  const toggleSubGroup = (label: string) => {
    setOpenSubGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const groups: MenuGroup[] = [];

  if (isAdmin) {
    groups.push({
      label: 'Administracao',
      icon: Cog,
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
    icon: Landmark,
    defaultOpen: true,
    items: [
      { title: 'Controle de Caixa', url: '/controle-caixa', icon: Landmark, module: 'controle_caixa' },
    ],
  });

  groups.push({
    label: 'Suprimentos',
    icon: Package,
    defaultOpen: true,
    subGroups: [
      {
        label: 'Compras',
        icon: ShoppingCart,
        items: [
          { title: 'Compras Faturadas', url: '/compras/faturadas', icon: Receipt, module: 'compras_faturadas' },
          { title: 'Compras a Vista', url: '/compras/avista', icon: ShoppingCart, module: 'compras_avista' },
          { title: 'Espelho Geral', url: '/compras/espelho', icon: Eye, module: 'espelho_geral' },
          { title: 'Programacao Semanal', url: '/compras/programacao-semanal', icon: CalendarDays, module: 'programacao_semanal' },
          { title: 'Espelho Semanal', url: '/compras/espelho-semanal', icon: BarChart3, module: 'espelho_semanal' },
        ],
      },
    ],
  });

  groups.push({
    label: 'Gestao de Ativos',
    icon: Car,
    defaultOpen: false,
    items: [
      { title: 'Dashboard', url: '/combustivel/dashboard', icon: Fuel, module: 'combustivel_dashboard' },
      { title: 'Abastecimentos', url: '/combustivel/abastecimentos', icon: Droplets, module: 'abastecimentos' },
      { title: 'Revisoes', url: '/combustivel/revisoes', icon: Wrench, module: 'revisoes_combustivel' },
      { title: 'Veiculos/Maquinas', url: '/veiculos', icon: Car, module: 'veiculos_maquinas' },
      { title: 'Postos de Combustivel', url: '/postos-combustivel', icon: MapPinned, module: 'postos_combustivel' },
      { title: 'Tipos de Combustivel', url: '/tipos-combustivel', icon: Droplets, module: 'tipos_combustivel' },
    ],
  });

  groups.push({
    label: 'Cadastros',
    icon: Building2,
    defaultOpen: false,
    items: [
      { title: 'Empresas', url: '/empresas', icon: Factory, module: 'empresas' },
      { title: 'Fornecedores', url: '/fornecedores', icon: Truck, module: 'fornecedores' },
      { title: 'Obras', url: '/obras', icon: Building2, module: 'obras' },
      { title: 'Responsaveis', url: '/responsaveis', icon: UserCheck, module: 'responsaveis' },
    ],
  });

  function renderMenuItem(item: MenuItem, indent = false) {
    const hasAccess = !item.module || canAccess(item.module);
    const locked = item.module && !hasAccess && !permLoading;

    if (locked) {
      return (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton
            className={`cursor-not-allowed rounded-lg px-3 py-1.5 text-white/35 opacity-45 ${indent ? 'pl-8' : ''}`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="text-[13px]">{item.title}</span>
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
            className={`rounded-lg px-3 py-1.5 text-[13px] text-white/75 transition-all duration-150 hover:bg-white/8 hover:text-white ${indent ? 'pl-8' : ''}`}
            activeClassName="bg-blue-500/90 text-white font-semibold shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  function renderSubGroup(sub: SubGroup) {
    const isOpen = openSubGroups[sub.label] ?? false;

    if (collapsed) {
      return (
        <div key={sub.label}>
          <SidebarMenu className="space-y-0.5">
            {sub.items.map((item) => renderMenuItem(item))}
          </SidebarMenu>
        </div>
      );
    }

    return (
      <div key={sub.label} className="mt-0.5">
        <button
          onClick={() => toggleSubGroup(sub.label)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white/85"
        >
          <sub.icon className="h-4 w-4 shrink-0" />
          <span>{sub.label}</span>
          {isOpen ? (
            <ChevronDown className="ml-auto h-3 w-3 text-white/40" />
          ) : (
            <ChevronRight className="ml-auto h-3 w-3 text-white/40" />
          )}
        </button>
        {isOpen && (
          <SidebarMenu className="mt-0.5 space-y-0.5 border-l border-white/10 ml-5">
            {sub.items.map((item) => renderMenuItem(item, true))}
          </SidebarMenu>
        )}
      </div>
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
          <div className="border-b border-white/10 bg-[#0f1a2d] px-4 pt-5 pb-4">
            <div className="mb-2">
              <MdsLogo
                lettersClassName="text-3xl font-black uppercase tracking-[0.05em] text-white"
                textClassName="text-sm font-semibold uppercase tracking-[0.35em] text-blue-200 -mt-1 translate-y-2"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm text-white/75">{profile?.display_name}</p>
              <span className="inline-flex rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/90">
                {userRole === 'admin'
                  ? 'Administracao'
                  : userRole === 'conferente'
                  ? 'Conferente'
                  : 'Operador'}
              </span>
            </div>
          </div>
        )}

        <SidebarGroup className="px-2 py-2">
          {groups.map((group) => (
            <div key={group.label} className="mb-1">
              {collapsed ? (
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-0.5">
                    {group.items?.map((item) => renderMenuItem(item))}
                    {group.subGroups?.map((sub) => (
                      <div key={sub.label}>
                        {sub.items.map((item) => renderMenuItem(item))}
                      </div>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              ) : (
                <Collapsible defaultOpen={group.defaultOpen}>
                  <CollapsibleTrigger className="flex w-full items-center gap-2 px-2 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50 transition-colors hover:text-white/80">
                    {group.icon && <group.icon className="h-3.5 w-3.5" />}
                    <span>{group.label}</span>
                    <ChevronDown className="ml-auto h-3 w-3" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      {group.items && (
                        <SidebarMenu className="space-y-0.5">
                          {group.items.map((item) => renderMenuItem(item))}
                        </SidebarMenu>
                      )}
                      {group.subGroups?.map(renderSubGroup)}
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          ))}
        </SidebarGroup>

        <div className="mt-auto border-t border-white/10 p-2">
          <Button
            variant="ghost"
            className="w-full justify-start rounded-lg text-white/72 hover:bg-white/8 hover:text-white"
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
