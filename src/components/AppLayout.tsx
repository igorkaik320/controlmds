import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />

      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-3 flex items-center">
          <SidebarTrigger className="rounded-md border bg-background shadow-sm" />
        </div>

        {children}
      </main>
    </SidebarProvider>
  );
}
