import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <SidebarTrigger className="mb-2 md:hidden" />
        {children}
      </main>
    </SidebarProvider>
  );
}
