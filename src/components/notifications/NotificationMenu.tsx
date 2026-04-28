import { AlertTriangle, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMaintenanceNotifications } from "@/lib/maintenanceNotifications";

const formatLocalDate = (value: string | null | undefined) => {
  if (!value || typeof value !== 'string') return new Date().toLocaleDateString("pt-BR");
  try {
    const onlyDate = value.split("T")[0];
    return new Date(`${onlyDate}T00:00:00`).toLocaleDateString("pt-BR");
  } catch {
    return new Date().toLocaleDateString("pt-BR");
  }
};

export function NotificationMenu() {
  const {
    visibleNotifications,
    hasVisibleNotifications,
    miniPanelOpen,
    setMiniPanelOpen,
    handleDismissToday,
    openNotificationDialog,
  } = useMaintenanceNotifications();

  return (
    <Popover open={miniPanelOpen} onOpenChange={setMiniPanelOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative px-3">
          <Bell className="h-4 w-4" />
          <span className="ml-2 text-sm font-medium">Notificações</span>
          {hasVisibleNotifications && (
            <Badge variant="secondary" className="absolute -top-1 -right-1 text-[10px]">
              {visibleNotifications.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] space-y-3">
        {visibleNotifications.length === 0 ? (
          <div className="rounded-md border border-dashed border-muted p-3 text-center text-sm text-muted-foreground">
            Nenhuma manutenção próxima encontrada.
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {visibleNotifications.map((notification) => (
              <div key={notification.id} className="rounded-lg border border-muted/50 bg-background p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{notification.equipamento_nome}</p>
                    <p className="text-xs text-muted-foreground">{notification.setor_nome || "Setor não informado"}</p>
                    <p className="text-xs text-muted-foreground">
                      Próxima: {formatLocalDate(notification.proxima_manutencao)}
                    </p>
                    {notification.fornecedor_nome && (
                      <p className="text-xs text-muted-foreground">Fornecedor: {notification.fornecedor_nome}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {notification.diasDiff} dia{notification.diasDiff === 1 ? "" : "s"}
                    </Badge>
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={handleDismissToday} className="uppercase tracking-wide">
            Não mostrar hoje
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              openNotificationDialog();
              setMiniPanelOpen(false);
            }}
          >
            Ver pop-up
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
