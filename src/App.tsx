import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Clock } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useBeforeUnloadDraftGuard } from "@/lib/draftGuard";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import AppLayout from "@/components/AppLayout";
import type { ModuleKey } from "@/lib/modulePermissions";
import { Lock } from "lucide-react";
import { MaintenanceNotificationProvider } from "@/lib/maintenanceNotifications";
import { routeLoaders } from "@/lib/routePrefetch";

// Lazy-loaded pages — usam o MESMO loader do prefetch para reaproveitar o chunk em cache
const Index = lazy(routeLoaders["/"] as any);
const Auth = lazy(routeLoaders["/auth"] as any);
const AuditLog = lazy(routeLoaders["/auditoria"] as any);
const UserManagement = lazy(routeLoaders["/usuarios"] as any);
const ComprasAvistaPage = lazy(routeLoaders["/compras/avista"] as any);
const ComprasFaturadasPage = lazy(routeLoaders["/compras/faturadas"] as any);
const EspelhoGeralPage = lazy(routeLoaders["/compras/espelho"] as any);
const ProgramacaoSemanalPage = lazy(routeLoaders["/compras/programacao-semanal"] as any);
const EspelhoSemanalPage = lazy(routeLoaders["/compras/espelho-semanal"] as any);
const ConfigRelatorioPage = lazy(routeLoaders["/config-relatorio"] as any);
const FornecedoresPage = lazy(routeLoaders["/fornecedores"] as any);
const ObrasPage = lazy(routeLoaders["/obras"] as any);
const ResponsaveisPage = lazy(routeLoaders["/responsaveis"] as any);
const VeiculosMaquinasPage = lazy(routeLoaders["/veiculos"] as any);
const EquipamentosPage = lazy(routeLoaders["/equipamentos"] as any);
const SetoresPage = lazy(routeLoaders["/setores"] as any);
const PostosCombustivelPage = lazy(routeLoaders["/postos-combustivel"] as any);
const TiposCombustivelPage = lazy(routeLoaders["/tipos-combustivel"] as any);
const AbastecimentosPage = lazy(routeLoaders["/combustivel/abastecimentos"] as any);
const DashboardCombustivelPage = lazy(routeLoaders["/combustivel/dashboard"] as any);
const RevisoesCombustivelPage = lazy(routeLoaders["/combustivel/revisoes"] as any);
const EmpresasPage = lazy(routeLoaders["/empresas"] as any);
const CategoriasFinanceirasPage = lazy(routeLoaders["/categorias-financeiras"] as any);
const PainelExecutivoPage = lazy(routeLoaders["/painel-executivo"] as any);
const FaturadosParcelasPage = lazy(routeLoaders["/financeiro/parcelas-faturadas"] as any);
const ContasPagarPage = lazy(routeLoaders["/contas-pagar"] as any);
const ServicosMaquinasPage = lazy(routeLoaders["/servicos-maquinas"] as any);
const ComponentesMaquinasPage = lazy(routeLoaders["/componentes-maquinas"] as any);
const NotFound = lazy(() => import("./pages/NotFound"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min default
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function DraftGuards() {
  useBeforeUnloadDraftGuard();
  return null;
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>Carregando...</p>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-muted-foreground">Carregando módulo...</p>
    </div>
  );
}

function PendingApprovalScreen() {
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
      <Clock className="h-14 w-14 text-muted-foreground" />
      <h2 className="text-xl font-bold">Aguardando aprovação</h2>
      <p className="max-w-md text-center text-muted-foreground">
        Seu cadastro foi realizado com sucesso. Um administrador precisa liberar seu acesso antes que você possa utilizar o sistema.
      </p>
      <button onClick={signOut} className="mt-4 text-sm text-primary underline hover:no-underline">Sair</button>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isPending } = useAuth();

  if (!user && loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" />;
  if (isPending) return <PendingApprovalScreen />;

  return <AppLayout>{children}</AppLayout>;
}

function HomeRoute() {
  const { user, loading, userRole } = useAuth();
  const { canAccess, loading: permLoading } = useModulePermissions();

  if (!user && loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" />;
  if (permLoading) return <LoadingScreen />;

  if (userRole === "admin") return <Navigate to="/painel-executivo" replace />;

  const firstAccessibleRoute: Array<{ module: ModuleKey; path: string }> = [
    { module: "compras_faturadas", path: "/compras/faturadas" },
    { module: "compras_avista", path: "/compras/avista" },
    { module: "espelho_geral", path: "/compras/espelho" },
    { module: "programacao_semanal", path: "/compras/programacao-semanal" },
    { module: "espelho_semanal", path: "/compras/espelho-semanal" },
    { module: "combustivel_dashboard", path: "/combustivel/dashboard" },
    { module: "abastecimentos", path: "/combustivel/abastecimentos" },
    { module: "revisoes_combustivel", path: "/combustivel/revisoes" },
    { module: "empresas", path: "/empresas" },
    { module: "categorias_financeiras", path: "/categorias-financeiras" },
    { module: "equipamentos", path: "/equipamentos" },
    { module: "setores", path: "/setores" },
    { module: "fornecedores", path: "/fornecedores" },
    { module: "obras", path: "/obras" },
    { module: "responsaveis", path: "/responsaveis" },
    { module: "veiculos_maquinas", path: "/veiculos" },
    { module: "postos_combustivel", path: "/postos-combustivel" },
    { module: "tipos_combustivel", path: "/tipos-combustivel" },
    { module: "controle_caixa", path: "/controle-caixa" },
  ];

  const target = firstAccessibleRoute.find((entry) => canAccess(entry.module));
  if (target) return <Navigate to={target.path} replace />;

  return (
    <AppLayout>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-bold">Sem modulo liberado</h2>
        <p className="text-muted-foreground">Seu usuário ainda não tem acesso a nenhum módulo.</p>
      </div>
    </AppLayout>
  );
}

function ModuleRoute({ children, module }: { children: React.ReactNode; module: ModuleKey }) {
  const { user, loading } = useAuth();
  const { canAccess, loading: permLoading } = useModulePermissions();

  if (!user && loading) return <LoadingScreen />;
  if (permLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" />;

  if (!canAccess(module)) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <Lock className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-bold">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar este módulo.
          </p>
        </div>
      </AppLayout>
    );
  }

  return <AppLayout>{children}</AppLayout>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, userRole } = useAuth();

  if (!user && loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" />;
  if (userRole !== "admin") return <Navigate to="/" />;

  return <AppLayout>{children}</AppLayout>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (!user && loading) return null;
  if (user) return <Navigate to="/" />;

  return <>{children}</>;
}

const App = () => (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DraftGuards />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <MaintenanceNotificationProvider>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                <Route path="/" element={<HomeRoute />} />
                <Route path="/contas-pagar" element={<ModuleRoute module="contas_pagar"><ContasPagarPage /></ModuleRoute>} />
                <Route path="/controle-caixa" element={<ProtectedRoute><Index /></ProtectedRoute>} />

                <Route
                  path="/compras/faturadas"
                  element={<ModuleRoute module="compras_faturadas"><ComprasFaturadasPage /></ModuleRoute>}
                />
                <Route
                  path="/compras/avista"
                  element={<ModuleRoute module="compras_avista"><ComprasAvistaPage /></ModuleRoute>}
                />
                <Route
                  path="/compras/espelho"
                  element={<ModuleRoute module="espelho_geral"><EspelhoGeralPage /></ModuleRoute>}
                />
                <Route
                  path="/compras/programacao-semanal"
                  element={<ModuleRoute module="programacao_semanal"><ProgramacaoSemanalPage /></ModuleRoute>}
                />
                <Route
                  path="/compras/espelho-semanal"
                  element={<ModuleRoute module="espelho_semanal"><EspelhoSemanalPage /></ModuleRoute>}
                />
                <Route
                  path="/financeiro/parcelas-faturadas"
                  element={<ModuleRoute module="parcelas_faturadas"><FaturadosParcelasPage /></ModuleRoute>}
                />

                <Route path="/empresas" element={<ModuleRoute module="empresas"><EmpresasPage /></ModuleRoute>} />
                <Route path="/categorias-financeiras" element={<ModuleRoute module="categorias_financeiras"><CategoriasFinanceirasPage /></ModuleRoute>} />
                <Route path="/fornecedores" element={<ModuleRoute module="fornecedores"><FornecedoresPage /></ModuleRoute>} />
                <Route path="/obras" element={<ModuleRoute module="obras"><ObrasPage /></ModuleRoute>} />
                <Route path="/responsaveis" element={<ModuleRoute module="responsaveis"><ResponsaveisPage /></ModuleRoute>} />
                <Route path="/veiculos" element={<ModuleRoute module="veiculos_maquinas"><VeiculosMaquinasPage /></ModuleRoute>} />
                <Route path="/equipamentos" element={<ModuleRoute module="equipamentos"><EquipamentosPage /></ModuleRoute>} />
                <Route path="/setores" element={<ModuleRoute module="setores"><SetoresPage /></ModuleRoute>} />
                <Route path="/servicos" element={<ModuleRoute module="servicos_maquinas"><ServicosMaquinasPage /></ModuleRoute>} />
                <Route path="/componentes" element={<ModuleRoute module="componentes_maquinas"><ComponentesMaquinasPage /></ModuleRoute>} />
                <Route
                  path="/postos-combustivel"
                  element={<ModuleRoute module="postos_combustivel"><PostosCombustivelPage /></ModuleRoute>}
                />
                <Route
                  path="/tipos-combustivel"
                  element={<ModuleRoute module="tipos_combustivel"><TiposCombustivelPage /></ModuleRoute>}
                />

                <Route
                  path="/combustivel/abastecimentos"
                  element={<ModuleRoute module="abastecimentos"><AbastecimentosPage /></ModuleRoute>}
                />
                <Route
                  path="/combustivel/revisoes"
                  element={<ModuleRoute module="revisoes_combustivel"><RevisoesCombustivelPage /></ModuleRoute>}
                />
                <Route
                  path="/combustivel/dashboard"
                  element={<ModuleRoute module="combustivel_dashboard"><DashboardCombustivelPage /></ModuleRoute>}
                />
                                <Route
                  path="/servicos-maquinas"
                  element={<ModuleRoute module="servicos_maquinas"><ServicosMaquinasPage /></ModuleRoute>}
                />
                <Route
                  path="/componentes-maquinas"
                  element={<ModuleRoute module="componentes_maquinas"><ComponentesMaquinasPage /></ModuleRoute>}
                />

                <Route path="/painel-executivo" element={<AdminRoute><PainelExecutivoPage /></AdminRoute>} />
                <Route path="/usuarios" element={<AdminRoute><UserManagement /></AdminRoute>} />
                <Route path="/auditoria" element={<AdminRoute><AuditLog /></AdminRoute>} />
                <Route path="/config-relatorio" element={<AdminRoute><ConfigRelatorioPage /></AdminRoute>} />

                <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </MaintenanceNotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
);

export default App;
