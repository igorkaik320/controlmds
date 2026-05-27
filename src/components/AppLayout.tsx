import { Suspense, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { NotificationMenu } from '@/components/notifications/NotificationMenu';
import { PageSkeleton } from '@/components/PageSkeleton';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import { prefetchAllRoutesOnIdle } from '@/lib/routePrefetch';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { LogOut, PanelLeft } from 'lucide-react';

function getPageHeader(pathname: string) {
  if (
    pathname.includes('contas-pagar') ||
    pathname.includes('faturados-parcelas') ||
    pathname.includes('compras-faturadas') ||
    pathname.includes('compras-avista')
  ) {
    return {
      title: 'Financeiro',
      subtitle: 'Contas a receber, contas a pagar e caixa',
    };
  }

  return {
    title: 'MDS Gestão',
    subtitle: 'Controle operacional e financeiro',
  };
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  useInactivityLogout();
  const location = useLocation();
  const { profile, user, signOut } = useAuth();
  const pageHeader = getPageHeader(location.pathname);
  const userInitial = (profile?.display_name || user?.email || 'U').trim().charAt(0).toUpperCase();

  useEffect(() => {
    prefetchAllRoutesOnIdle();
  }, []);

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] items-center justify-between border-b border-border/70 bg-card px-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground">
              <PanelLeft className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold leading-5 tracking-tight">{pageHeader.title}</h1>
              <p className="truncate text-xs text-muted-foreground">{pageHeader.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationMenu compact />
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {userInitial}
            </div>
            <Button variant="outline" size="sm" onClick={signOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-auto p-4 md:p-6">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
