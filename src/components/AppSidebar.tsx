import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useModulePermissions } from '@/hooks/useModulePermissions';
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
  CalendarDays,
  BarChart3,
  CircleDollarSign,
  FileBarChart,
  Flame,
  UserCheck,
  Fuel,
  Car,
  Droplets,
  Factory,
  MapPinned,
  Wrench,
  Cog,
  Package,
  ChevronLeft,
  Warehouse,
  Users as AdminIcon,
} from 'lucide-react';
import { ModuleKey } from '@/lib/modulePermissions';
import { confirmDraftDiscard } from '@/lib/draftGuard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  module?: ModuleKey;
}

interface MenuGroup {
  key: string;
  label: string;
  icon: any;
  items: MenuItem[];
}

export function AppSidebar() {
  const { userRole, profile, signOut } = useAuth();
  const { canAccess, loading: permLoading } = useModulePermissions();
  const isAdmin = userRole === 'admin';
  const location = useLocation();
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const groups: MenuGroup[] = [];

  if (isAdmin) {
    groups.push({
      key: 'admin',
      label: 'Administração',
      icon: AdminIcon,
      items: [
        { title: 'Painel Executivo', url: '/painel-executivo', icon: LayoutDashboard },
        { title: 'Usuários', url: '/usuarios', icon: Users },
        { title: 'Auditoria', url: '/auditoria', icon: History },
        { title: 'Config. Relatório', url: '/config-relatorio', icon: Settings },
      ],
    });
  }

  groups.push({
    key: 'financeiro',
    label: 'Financeiro',
    icon: CircleDollarSign,
    items: [
      { title: 'Controle de Caixa', url: '/controle-caixa', icon: Landmark, module: 'controle_caixa' },
    ],
  });

  groups.push({
    key: 'suprimentos',
    label: 'Suprimentos',
    icon: Package,
    items: [
      { title: 'Compras Faturadas', url: '/compras/faturadas', icon: Receipt, module: 'compras_faturadas' },
      { title: 'Compras à Vista', url: '/compras/avista', icon: ShoppingCart, module: 'compras_avista' },
      { title: 'Espelho Geral', url: '/compras/espelho', icon: Eye, module: 'espelho_geral' },
      { title: 'Programação Semanal', url: '/compras/programacao-semanal', icon: CalendarDays, module: 'programacao_semanal' },
      { title: 'Espelho Semanal', url: '/compras/espelho-semanal', icon: BarChart3, module: 'espelho_semanal' },
      { title: 'Parcelas Faturadas', url: '/compras/parcelas-faturadas', icon: FileBarChart, module: 'parcelas_faturadas' },
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
      { title: 'Veículos/Máquinas', url: '/veiculos', icon: Car, module: 'veiculos_maquinas' },
      { title: 'Postos de Combustível', url: '/postos-combustivel', icon: MapPinned, module: 'postos_combustivel' },
      { title: 'Tipos de Combustível', url: '/tipos-combustivel', icon: Flame, module: 'tipos_combustivel' },
    ],
  });

  groups.push({
    key: 'cadastros',
    label: 'Cadastros',
    icon: Cog,
    items: [
      { title: 'Empresas', url: '/empresas', icon: Factory, module: 'empresas' },
      { title: 'Fornecedores', url: '/fornecedores', icon: Truck, module: 'fornecedores' },
      { title: 'Obras', url: '/obras', icon: Building2, module: 'obras' },
      { title: 'Responsáveis', url: '/responsaveis', icon: UserCheck, module: 'responsaveis' },
    ],
  });

  // Detect which group is active based on current route
  const currentGroupKey = groups.find((g) =>
    g.items.some((item) => location.pathname.startsWith(item.url))
  )?.key;

  function handleGroupClick(key: string) {
    setActiveGroup((prev) => (prev === key ? null : key));
  }

  function renderMenuItem(item: MenuItem) {
    const hasAccess = !item.module || canAccess(item.module);
    const locked = item.module && !hasAccess && !permLoading;

    if (locked) {
      return (
        <li key={item.url}>
          <div className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-white/30">
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
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/75 transition-all duration-150 hover:bg-white/10 hover:text-white',
            isActive && 'bg-blue-500/90 text-white font-semibold shadow-[0_4px_14px_rgba(59,130,246,0.35)]'
          )}
          activeClassName=""
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span>{item.title}</span>
        </NavLink>
      </li>
    );
  }

  async function handleSignOut() {
    if (!confirmDraftDiscard()) return;
    await signOut();
  }

  const openGroup = groups.find((g) => g.key === activeGroup);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="sticky top-0 flex h-screen shrink-0">
        {/* Icon strip */}
        <div className="flex w-[60px] flex-col items-center border-r border-white/10 bg-[#0f1a2d] py-4">
          {/* Logo */}
          <div className="mb-6 flex h-10 w-10 items-center justify-center">
            <span className="text-lg font-black text-white tracking-wider">M</span>
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
                          ? 'bg-blue-500 text-white shadow-[0_4px_14px_rgba(59,130,246,0.4)]'
                          : isGroupActive
                          ? 'bg-white/15 text-white'
                          : 'text-white/50 hover:bg-white/8 hover:text-white/80'
                      )}
                    >
                      <group.icon className="h-5 w-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-slate-800 text-white border-slate-700">
                    {group.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {/* Sign out */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleSignOut}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white/50 transition-all hover:bg-white/8 hover:text-white/80"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-slate-800 text-white border-slate-700">
              Sair
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Expandable subitems panel */}
        <div
          className={cn(
            'flex flex-col overflow-hidden bg-[#233247] transition-all duration-250 ease-in-out',
            openGroup ? 'w-[220px] border-r border-white/10' : 'w-0'
          )}
        >
          {openGroup && (
            <div className="flex h-full w-[220px] flex-col">
              {/* Panel header */}
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/60">
                  {openGroup.label}
                </h2>
                <button
                  onClick={() => setActiveGroup(null)}
                  className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/70"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>

              {/* User info */}
              <div className="border-b border-white/10 px-4 py-3">
                <p className="truncate text-sm text-white/75">{profile?.display_name}</p>
                <span className="mt-1 inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/80">
                  {userRole === 'admin'
                    ? 'Administração'
                    : userRole === 'conferente'
                    ? 'Conferente'
                    : 'Operador'}
                </span>
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
