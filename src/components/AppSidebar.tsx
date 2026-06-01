import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { NavLink } from '@/components/NavLink';
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Building2,
  CalendarDays,
  Car,
  ChevronDown,
  ChevronLeft,
  CircleDollarSign,
  Cog,
  Droplets,
  Eye,
  Factory,
  Flame,
  FileBarChart,
  Fuel,
  History,
  Landmark,
  LayoutDashboard,
  Lock,
  MapPin,
  MapPinned,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Tags,
  Truck,
  UserCheck,
  Users,
  Wrench,
  Users as AdminIcon,
} from 'lucide-react';
import { ModuleKey } from '@/lib/modulePermissions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  module?: ModuleKey;
  children?: MenuItem[];
}

interface MenuGroup {
  key: string;
  label: string;
  icon: any;
  items: MenuItem[];
}

export function AppSidebar() {
  const { userRole } = useAuth();
  const { canAccess, loading: permLoading } = useModulePermissions();
  const isAdmin = userRole === 'admin';
  const location = useLocation();
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});

  const groups: MenuGroup[] = [];

  if (isAdmin) {
    groups.push({
      key: 'admin',
      label: 'Administração',
      icon: AdminIcon,
      items: [{ title: 'Painel Executivo', url: '/painel-executivo', icon: LayoutDashboard }],
    });
  }

  groups.push({
    key: 'financeiro',
    label: 'Financeiro',
    icon: CircleDollarSign,
    items: [
      { title: 'Dashboard', url: '/contas-pagar/dashboard', icon: LayoutDashboard, module: 'contas_pagar' },
      { title: 'Contas a Pagar', url: '/contas-pagar', icon: Package, module: 'contas_pagar' },
      { title: 'Controle de Caixa', url: '/controle-caixa', icon: Landmark, module: 'controle_caixa' },
      {
        title: 'Cadastros',
        url: '/financeiro/cadastros',
        icon: Cog,
        children: [
          { title: 'Categorias', url: '/categorias-financeiras', icon: Tags, module: 'categorias_financeiras' },
          { title: 'Tags', url: '/financeiro/tags', icon: Tags, module: 'financeiro_tags' },
        ],
      },
    ],
  });

  groups.push({
    key: 'compras',
    label: 'Compras',
    icon: Package,
    items: [
      { title: 'Compras Faturadas', url: '/compras/faturadas', icon: Receipt, module: 'compras_faturadas' },
      { title: 'Compras à Vista', url: '/compras/avista', icon: ShoppingCart, module: 'compras_avista' },
      { title: 'Programação Semanal', url: '/compras/programacao-semanal', icon: CalendarDays, module: 'programacao_semanal' },
      {
        title: 'Relatórios',
        url: '/compras/relatorios',
        icon: FileBarChart,
        children: [
          { title: 'Espelho Geral', url: '/compras/espelho', icon: Eye, module: 'espelho_geral' },
          { title: 'Espelho Semanal', url: '/compras/espelho-semanal', icon: BarChart3, module: 'espelho_semanal' },
        ],
      },
    ],
  });

  groups.push({
    key: 'ativos',
    label: 'Gestão de Ativos',
    icon: Truck,
    items: [
      { title: 'Dashboard', url: '/combustivel/dashboard', icon: Fuel, module: 'combustivel_dashboard' },
      { title: 'Abastecimentos', url: '/combustivel/abastecimentos', icon: Droplets, module: 'abastecimentos' },
      { title: 'Revisões', url: '/combustivel/revisoes', icon: Wrench, module: 'revisoes_combustivel' },
      { title: 'Equipamentos', url: '/equipamentos', icon: Archive, module: 'equipamentos' },
      { title: 'Serviços de Máquinas', url: '/servicos-maquinas', icon: Wrench, module: 'servicos_maquinas' },
      {
        title: 'Cadastros',
        url: '/ativos/cadastros',
        icon: Cog,
        children: [
          { title: 'Veículos/Máquinas', url: '/veiculos', icon: Car, module: 'veiculos_maquinas' },
          { title: 'Postos de Combustível', url: '/postos-combustivel', icon: MapPinned, module: 'postos_combustivel' },
          { title: 'Componentes / Peças', url: '/componentes-maquinas', icon: Cog, module: 'componentes_maquinas' },
        ],
      },
    ],
  });

  if (isAdmin) {
    groups.push({
      key: 'seguranca',
      label: 'Segurança',
      icon: Lock,
      items: [
        { title: 'Usuários', url: '/usuarios', icon: Users },
        { title: 'Auditoria', url: '/auditoria', icon: History },
        { title: 'Config. Relatório', url: '/config-relatorio', icon: Settings },
      ],
    });
  }

  groups.push({
    key: 'cadastros',
    label: 'Cadastros',
    icon: Cog,
    items: [
      { title: 'Empresas', url: '/empresas', icon: Factory, module: 'empresas' },
      { title: 'Fornecedores', url: '/fornecedores', icon: Truck, module: 'fornecedores' },
      { title: 'Obras', url: '/obras', icon: Building2, module: 'obras' },
      { title: 'Responsáveis', url: '/responsaveis', icon: UserCheck, module: 'responsaveis' },
      { title: 'Setores', url: '/setores', icon: MapPin, module: 'setores' },
    ],
  });

  // Detect which group is active based on current route
  const currentGroupKey = groups.find((g) =>
    g.items.some((item) =>
      item.children
        ? item.children.some((child) => location.pathname.startsWith(child.url))
        : location.pathname.startsWith(item.url)
    )
  )?.key;

  function handleGroupClick(key: string) {
    setActiveGroup((prev) => (prev === key ? null : key));
  }

  function renderMenuItem(item: MenuItem) {
    if (item.children?.length) {
      const visibleChildren = item.children.filter((child) => !child.module || canAccess(child.module) || permLoading);
      const isOpen = openSubmenus[item.url] ?? false;
      const hasActiveChild = item.children.some(
        (child) => location.pathname === child.url || location.pathname.startsWith(child.url + '/')
      );

      if (visibleChildren.length === 0) return null;

      return (
        <li key={item.url}>
          <button
            type="button"
            onClick={() => setOpenSubmenus((prev) => ({ ...prev, [item.url]: !isOpen }))}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-all duration-150 hover:bg-sidebar hover:text-sidebar-accent-foreground',
              hasActiveChild && 'bg-sidebar text-sidebar-accent-foreground font-semibold'
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{item.title}</span>
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 text-sidebar-muted transition-transform', isOpen && 'rotate-180')}
            />
          </button>

          {isOpen && (
            <ul className="ml-5 mt-1 space-y-0.5 border-l border-sidebar-border/80 pl-3">
              {item.children.map(renderMenuItem)}
            </ul>
          )}
        </li>
      );
    }

    const hasAccess = !item.module || canAccess(item.module);
    const locked = item.module && !hasAccess && !permLoading;

    if (locked) {
      return (
        <li key={item.url}>
          <div className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-muted/70">
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="text-sm">{item.title}</span>
            <Lock className="ml-auto h-3.5 w-3.5" />
          </div>
        </li>
      );
    }

    const isActive = location.pathname === item.url || location.pathname.startsWith(item.url + '/');

    return (
      <li key={item.url}>
        <NavLink
          to={item.url}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            isActive && 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm'
          )}
          activeClassName=""
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span>{item.title}</span>
        </NavLink>
      </li>
    );
  }

  const openGroup = groups.find((g) => g.key === activeGroup);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="sticky top-0 flex h-screen shrink-0">
        {/* Icon strip */}
        <div className="flex w-[60px] flex-col items-center border-r border-sidebar-border bg-sidebar py-4">
          {/* Logo */}
          <div className="mb-6 flex h-10 w-10 items-center justify-center">
            <span className="text-lg font-black text-sidebar-accent-foreground tracking-wider">M</span>
          </div>

          {/* Group icons */}
          <nav className="flex flex-1 flex-col items-center gap-1">
            {groups.map((group) => {
              const isGroupActive = currentGroupKey === group.key;
              const isOpen = activeGroup === group.key;

              return (
                <Tooltip key={group.key}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleGroupClick(group.key)}
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150',
                        isOpen
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                          : isGroupActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      )}
                    >
                      <group.icon className="h-5 w-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-sidebar text-sidebar-foreground border-sidebar-border">
                    {group.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        </div>

        {/* Expandable subitems panel */}
        <div
          className={cn(
            'flex flex-col overflow-hidden bg-sidebar-accent transition-all duration-250 ease-in-out',
            openGroup ? 'w-[220px] border-r border-sidebar-border' : 'w-0'
          )}
        >
          {openGroup && (
            <div className="flex h-full w-[220px] flex-col">
              {/* Panel header */}
              <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-4">
                <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-sidebar-muted">
                  {openGroup.label}
                </h2>
                <button
                  onClick={() => setActiveGroup(null)}
                  className="rounded p-1 text-sidebar-muted hover:bg-sidebar hover:text-sidebar-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>

              {/* Items */}
              <ul className="flex-1 space-y-0.5 overflow-auto px-2 py-3">
                {openGroup.items.map(renderMenuItem)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
