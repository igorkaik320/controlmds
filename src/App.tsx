import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuditLog from "./pages/AuditLog";
import UserManagement from "./pages/UserManagement";
import ComprasAvistaPage from "./pages/ComprasAvistaPage";
import ComprasFaturadasPage from "./pages/ComprasFaturadasPage";
import EspelhoGeralPage from "./pages/EspelhoGeralPage";
import ProgramacaoSemanalPage from "./pages/ProgramacaoSemanalPage";
import EspelhoSemanalPage from "./pages/EspelhoSemanalPage";
import ConfigRelatorioPage from "./pages/ConfigRelatorioPage";
import FornecedoresPage from "./pages/FornecedoresPage";
import ObrasPage from "./pages/ObrasPage";
import ResponsaveisPage from "./pages/ResponsaveisPage";
import VeiculosMaquinasPage from "./pages/VeiculosMaquinasPage";
import TiposCombustivelPage from "./pages/TiposCombustivelPage";
import AbastecimentosPage from "./pages/AbastecimentosPage";
import DashboardCombustivelPage from "./pages/DashboardCombustivelPage";
import EmpresasPage from "./pages/EmpresasPage";
import NotFound from "./pages/NotFound";
import type { ModuleKey } from "@/lib/modulePermissions";
import { Lock } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;
  if (!user) return <Navigate to="/auth" />;
  return <AppLayout>{children}</AppLayout>;
}

function ModuleRoute({ children, module }: { children: React.ReactNode; module: ModuleKey }) {
  const { user, loading } = useAuth();
  const { canAccess, loading: permLoading } = useModulePermissions();
  if (loading || permLoading) return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;
  if (!user) return <Navigate to="/auth" />;
  if (!canAccess(module)) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Lock className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-bold">Acesso Restrito</h2>
          <p className="text-muted-foreground">Você não tem permissão para acessar este módulo.</p>
        </div>
      </AppLayout>
    );
  }
  return <AppLayout>{children}</AppLayout>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, userRole } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><p>Carregando...</p></div>;
  if (!user) return <Navigate to="/auth" />;
  if (userRole !== 'admin') return <Navigate to="/" />;
  return <AppLayout>{children}</AppLayout>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/compras/faturadas" element={<ModuleRoute module="compras_faturadas"><ComprasFaturadasPage /></ModuleRoute>} />
            <Route path="/compras/avista" element={<ModuleRoute module="compras_avista"><ComprasAvistaPage /></ModuleRoute>} />
            <Route path="/compras/espelho" element={<ModuleRoute module="espelho_geral"><EspelhoGeralPage /></ModuleRoute>} />
            <Route path="/compras/programacao-semanal" element={<ModuleRoute module="programacao_semanal"><ProgramacaoSemanalPage /></ModuleRoute>} />
            <Route path="/compras/espelho-semanal" element={<ModuleRoute module="espelho_semanal"><EspelhoSemanalPage /></ModuleRoute>} />
            <Route path="/fornecedores" element={<ModuleRoute module="fornecedores"><FornecedoresPage /></ModuleRoute>} />
            <Route path="/obras" element={<ModuleRoute module="obras"><ObrasPage /></ModuleRoute>} />
            <Route path="/responsaveis" element={<ModuleRoute module="responsaveis"><ResponsaveisPage /></ModuleRoute>} />
            <Route path="/veiculos" element={<ModuleRoute module="veiculos_maquinas"><VeiculosMaquinasPage /></ModuleRoute>} />
            <Route path="/tipos-combustivel" element={<ModuleRoute module="tipos_combustivel"><TiposCombustivelPage /></ModuleRoute>} />
            <Route path="/combustivel/abastecimentos" element={<ModuleRoute module="abastecimentos"><AbastecimentosPage /></ModuleRoute>} />
            <Route path="/combustivel/dashboard" element={<ModuleRoute module="combustivel_dashboard"><DashboardCombustivelPage /></ModuleRoute>} />
            <Route path="/usuarios" element={<AdminRoute><UserManagement /></AdminRoute>} />
            <Route path="/auditoria" element={<AdminRoute><AuditLog /></AdminRoute>} />
            <Route path="/config-relatorio" element={<AdminRoute><ConfigRelatorioPage /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
