import { useEffect, useState } from 'react';
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
import logoImg from '@/assets/logo-controlmds.png';
import {
  Landmark,
  ShoppingCart,
  Receipt,
  Eye,
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
  showCollapsed?: boolean;
}

interface MenuGroup {
  id: string;
  label: string;
  items: MenuItem[];
  defaultOpen?: boolean;
}

const GROUP_STORAGE_KEY = 'controlmds-sidebar-groups';

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { userRole, profile, signOut } = useAuth();
  const { canAccess, loading: permLoading } = useModulePermissions();
  const isAdmin = userRole === 'admin';

  const groups: MenuGroup[] = [
    {
      id: 'administracao',
      label: 'Administração',
      defaultOpen: true,
      items: [
        { title: 'Usuários', url: '/usuarios', icon: Users, module: 'usuarios' },
        { title: 'Auditoria', url: '/auditoria', icon: History, module: 'auditoria' },
      ],
    },
    {
      id: 'financeiro',
      label: 'Financeiro',
      defaultOpen: true,
      items: [
        { title: 'Controle de Caixa', url: '/', icon: Landmark, module: 'controle_caixa' },
      ],
    },
    {
      id: 'compras',
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
      id: 'combustivel',
      label: 'Controle de Combustível',
      defaultOpen: false,
      items: [
        { title: 'Dashboard', url: '/combustivel/dashboard', icon: Fuel, module: 'combustivel_dashboard' },
        { title: 'Abastecimentos', url: '/combustivel/abastecimentos', icon: Droplets, module: 'abastecimentos' },
      ],
    },
    {
      id: 'cadastros',
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
    },
  ];

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((group) => [group.id, group.defaultOpen ?? false]))
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(GROUP_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Record<string, boolean>;
      setOpenGroups((current) => ({ ...current, ...parsed }));
    } catch {
      // ignore invalid persisted state
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(openGroups));
  }, [openGroups]);

  function setGroupOpen(groupId: string, nextOpen: boolean) {
    setOpenGroups((current) => ({ ...current, [groupId]: nextOpen }));
  }

  function renderMenuItem(item: MenuItem) {
    const hasAccess = !item.module || canAccess(item.module);
    const locked = item.module && !hasAccess && !permLoading;

    if (locked) {
      return (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton
            title={item.title}
            className="cursor-not-allowed rounded-xl px-3 py-2 text-white/35 opacity-45"
          >
            <item.icon className="h-4 w-4 shrink-0" />
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
        <SidebarMenuButton asChild title={item.title}>
          <NavLink
            to={item.url}
            className="rounded-xl px-3 py-2 text-[14px] text-white/78 transition-all duration-200 hover:bg-white/8 hover:text-white"
            activeClassName="bg-blue-500 text-white font-semibold shadow-[0_6px_18px_rgba(59,130,246,0.35)]"
          >
            <item.icon className="h-4 w-4 shrink-0" />
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
    <Sidebar collapsible="icon" className="border-r border-slate-700/40 bg-[#233247]">
      <SidebarContent className="bg-[#233247]">
        {!collapsed && (
          <div className="border-b border-white/10 bg-[#1d2a3c] px-4 py-5">
            <div className="space-y-1">
              <img src={logoImg} alt="ControlMDS" className="h-8 object-contain mb-1" />
              <p className="text-sm text-white/75">{profile?.display_name}</p>
              <div className="pt-1">
                <span className="inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90">
                  {isAdmin ? 'Administrador' : userRole === 'conferente' ? 'Conferente' : 'Operador'}
                </span>
              </div>
            </div>
          </div>
        )}

        <SidebarGroup className="px-3 py-3">
          {groups.map((group) => (
            <div key={group.id} className="mb-3">
              {collapsed ? (
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-1">
                    {group.items.map(renderMenuItem)}
                  </SidebarMenu>
                </SidebarGroupContent>
              ) : (
                <Collapsible
                  open={openGroups[group.id] ?? !!group.defaultOpen}
                  onOpenChange={(nextOpen) => setGroupOpen(group.id, nextOpen)}
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55 transition-colors hover:text-white/85">
                    <span>{group.label}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        openGroups[group.id] ? 'rotate-180' : ''
                      }`}
                    />
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
            title="Sair"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {!collapsed && 'Sair'}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
