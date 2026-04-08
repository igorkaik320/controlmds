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
  UserCheck,
  Fuel,
  Car,
  Droplets,
  Factory,
  MapPinned,
  Wrench,
  ClipboardList,
  Cog,
  Package,
  ChevronLeft,
  Building,
  Wrench as Tools,
  Users as AdminIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModuleKey } from '@/lib/modulePermissions';
import { confirmDraftDiscard } from '@/lib/draftGuard';
import { MdsLogo } from './MdsLogo';
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
  const { userRole, signOut } = useAuth();
  const { canAccess, loading: permLoading } = useModulePermissions();
  const [open, setOpen] = useState(true);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const location = useLocation();

  const groups: MenuGroup[] = [
    {
      key: 'admin',
      label: 'Administração',
      icon: AdminIcon,
      items: [
        { title: 'Painel Executivo', url: '/painel-executivo', icon: LayoutDashboard },
        { title: 'Usuários', url: '/usuarios', icon: Users },
        { title: 'Auditoria', url: '/auditoria', icon: History },
        { title: 'Config. Relatório', url: '/config-relatorio', icon: Settings },
      ],
    },
        {
          key: 'cadastros',
          label: 'Cadastros',
          icon: Wrench,
          items: [
            { title: 'Empresas', url: '/empresas', icon: Factory, module: 'empresas' },
            { title: 'Fornecedores', url: '/fornecedores', icon: Truck, module: 'fornecedores' },
            { title: 'Obras', url: '/obras', icon: Building2, module: 'obras' },
            { title: 'Responsáveis', url: '/responsaveis', icon: UserCheck, module: 'responsaveis' },
            { title: 'Veículos/Máquinas', url: '/veiculos', icon: Car, module: 'veiculos_maquinas' },
            { title: 'Equipamentos', url: '/equipamentos', icon: Tools, module: 'equipamentos' },
            { title: 'Setores', url: '/setores', icon: Building, module: 'setores' },
            { title: 'Postos de Combustível', url: '/postos-combustivel', icon: MapPinned, module: 'postos_combustivel' },
            { title: 'Tipos de Combustível', url: '/tipos-combustivel', icon: Droplets, module: 'tipos_combustivel' },
          ],
        },
        {
          key: 'ativos',
          label: 'Gestão de Ativos',
          icon: Truck,
          items: [
            { title: 'Dashboard', url: '/combustivel/dashboard', icon: Fuel, module: 'combustivel_dashboard' },
            { title: 'Abastecimentos', url: '/combustivel/abastecimentos', icon: Droplets, module: 'abastecimentos' },
            { title: 'Revisões', url: '/combustivel/revisoes', icon: Wrench, module: 'revisoes_combustivel' },
            { title: 'Manutenção', url: '/manutencao/equipamentos', icon: Tools, module: 'manutencao_equipamentos' },
          ],
        },
    {
      key: 'financeiro',
      label: 'Financeiro',
      icon: Landmark,
      items: [
        { title: 'Compras Faturadas', url: '/compras/faturadas', icon: ShoppingCart, module: 'compras_faturadas' },
        { title: 'Compras à Vista', url: '/compras/avista', icon: Receipt, module: 'compras_avista' },
        { title: 'Espelho Geral', url: '/compras/espelho', icon: Eye, module: 'espelho_geral' },
        { title: 'Programação Semanal', url: '/compras/programacao-semanal', icon: CalendarDays, module: 'programacao_semanal' },
        { title: 'Espelho Semanal', url: '/compras/espelho-semanal', icon: BarChart3, module: 'espelho_semanal' },
      ],
    },
    {
      key: 'caixa',
      label: 'Caixa',
      icon: Package,
      items: [
        { title: 'Controle de Caixa', url: '/controle-caixa', icon: Package, module: 'controle_caixa' },
      ],
    },
  ];

  const filteredGroups = groups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // Se não tiver module, sempre mostra
      if (!item.module) return true;
      // Se tiver module, verifica permissão
      return canAccess(item.module as ModuleKey);
    })
  }));

  function handleSignOut() {
    if (confirmDraftDiscard()) {
      signOut();
    }
  }

  return (
    <TooltipProvider>
      <div className={cn(
        "flex flex-col h-full bg-card border-r transition-all duration-300",
        open ? "w-64" : "w-16"
      )}>
        <div className="p-4 border-b">
          <MdsLogo collapsed={!open} />
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {filteredGroups.map((group) => (
            <div key={group.key} className="mb-4">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full justify-start h-8 px-2",
                  !open && "justify-center"
                )}
                onClick={() => setActiveGroup(activeGroup === group.key ? null : group.key)}
              >
                <group.icon className="h-4 w-4" />
                {open && <span className="ml-2 text-sm">{group.label}</span>}
                <ChevronLeft
                  className={cn(
                    "ml-auto h-4 w-4 transition-transform",
                    activeGroup === group.key && "rotate-90"
                  )}
                />
              </Button>

              {activeGroup === group.key && (
                <div className="ml-4 mt-1 space-y-1">
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.url;
                    return (
                      <Tooltip key={item.url}>
                        <TooltipTrigger asChild>
                          <NavLink
                            to={item.url}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                              isActive ? "bg-accent text-accent-foreground" : "transparent"
                            )}
                          >
                            <item.icon className="h-4 w-4" />
                            <span className="truncate">{item.title}</span>
                          </NavLink>
                        </TooltipTrigger>
                        {!open && (
                          <TooltipContent side="right">
                            {item.title}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t mt-auto">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-full justify-start h-8 px-2",
              !open && "justify-center"
            )}
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            {open && <span className="ml-2 text-sm">Sair</span>}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
