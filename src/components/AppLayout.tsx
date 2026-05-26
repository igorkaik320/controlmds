import { Suspense, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { NotificationMenu } from '@/components/notifications/NotificationMenu';
import { PageSkeleton } from '@/components/PageSkeleton';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import { prefetchAllRoutesOnIdle } from '@/lib/routePrefetch';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  useInactivityLogout();

  // Pré-carrega todas as páginas em segundo plano após o app abrir.
  // Na 2ª navegação em diante, abre instantâneo (sem "Carregando módulo...").
  useEffect(() => {
    prefetchAllRoutesOnIdle();
  }, []);


  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center justify-between border-b border-border/70 px-6 py-4">
          <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            MDS GESTÃO
          </div>
          <div className="flex items-center gap-2">
            <NotificationMenu />
          </div>
        </header>
        <main className="flex-1 min-w-0 overflow-auto p-4 md:p-6">
          <Suspense fallback={<PageSkeleton />}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

