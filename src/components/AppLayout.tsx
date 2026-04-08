import { AppSidebar } from '@/components/AppSidebar';
import { NotificationMenu } from '@/components/notifications/NotificationMenu';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border/70 px-6 py-4">
          <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            MDS GESTÃO
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationMenu />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
