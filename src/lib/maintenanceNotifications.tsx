import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AvisoFinanceiroNotificacao, fetchAvisosFinanceirosUsuario } from "@/lib/avisosService";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const parseDateOnly = (value: string | null | undefined) => {
  if (!value || typeof value !== "string") return new Date();
  try {
    const onlyDate = value.split("T")[0];
    return new Date(`${onlyDate}T00:00:00`);
  } catch {
    return new Date();
  }
};

const formatLocalDate = (value: string) => parseDateOnly(value).toLocaleDateString("pt-BR");

interface ManutencaoRecord {
  id: string;
  equipamento_id: string;
  equipamento_nome: string;
  setor_id: string;
  setor_nome: string;
  fornecedor_id?: string;
  fornecedor_nome?: string;
  data: string;
  valor: number;
  proxima_manutencao: string;
  avisar_dias_antes: number;
  ativo: boolean;
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
}

interface MaintenanceNotificationItem extends ManutencaoRecord {
  kind: "manutencao";
  diasDiff: number;
}

interface FinancialNotificationItem extends AvisoFinanceiroNotificacao {
  kind: "financeiro";
}

type AppNotificationItem = MaintenanceNotificationItem | FinancialNotificationItem;

interface MaintenanceNotificationContextValue {
  visibleNotifications: AppNotificationItem[];
  hasVisibleNotifications: boolean;
  dialogOpen: boolean;
  openNotificationDialog: () => void;
  closeNotificationDialog: () => void;
  handleDismissToday: () => void;
  refreshNotifications: () => Promise<void>;
  miniPanelOpen: boolean;
  setMiniPanelOpen: (open: boolean) => void;
}

const MaintenanceNotificationContext = createContext<MaintenanceNotificationContextValue | undefined>(undefined);

function buildUpcomingNotifications(data: ManutencaoRecord[]): MaintenanceNotificationItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return data.reduce<MaintenanceNotificationItem[]>((acc, item) => {
    if (!item.ativo) return acc;
    const dataProxima = parseDateOnly(item.proxima_manutencao);
    const diff = Math.ceil((dataProxima.getTime() - today.getTime()) / MS_PER_DAY);
    if (diff >= 0 && diff <= item.avisar_dias_antes) {
      acc.push({ ...item, kind: "manutencao", diasDiff: diff });
    }
    return acc;
  }, []);
}

export function useMaintenanceNotifications() {
  const context = useContext(MaintenanceNotificationContext);
  if (!context) {
    throw new Error("useMaintenanceNotifications must be used within MaintenanceNotificationProvider");
  }
  return context;
}

export function MaintenanceNotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [miniPanelOpen, setMiniPanelOpen] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("manutencao-dismissed") ?? "{}");
    } catch {
      return {};
    }
  });
  const [todayKey, setTodayKey] = useState(() => new Date().toISOString().slice(0, 10));
  const autoShownRef = useRef(false);

  const refreshNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }

    try {
      const { data, error } = await supabase.from("manutencoes").select("*").order("created_at", { ascending: false });
      if (error) throw error;

      const manutencoes = buildUpcomingNotifications((data as ManutencaoRecord[] | null) ?? []);
      const financeiro = await fetchAvisosFinanceirosUsuario(user.id).catch((error) => {
        if (error instanceof Error) toast.error(error.message);
        return [];
      });

      setNotifications([
        ...financeiro.map((item): FinancialNotificationItem => ({ ...item, kind: "financeiro" })),
        ...manutencoes,
      ]);
    } catch (error) {
      if (error instanceof Error) toast.error(error.message);
    }
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTodayKey(new Date().toISOString().slice(0, 10));
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("manutencao-dismissed", JSON.stringify(dismissedNotifications));
  }, [dismissedNotifications]);

  useEffect(() => {
    if (!user) return;
    void refreshNotifications();
    const interval = setInterval(() => {
      void refreshNotifications();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshNotifications, user]);

  const visibleNotifications = useMemo(() => {
    return notifications.filter((notification) => dismissedNotifications[notification.id] !== todayKey);
  }, [notifications, dismissedNotifications, todayKey]);

  const hasVisibleNotifications = visibleNotifications.length > 0;

  useEffect(() => {
    if (hasVisibleNotifications && !autoShownRef.current) {
      setDialogOpen(true);
      autoShownRef.current = true;
    }
  }, [hasVisibleNotifications]);

  function handleDismissToday() {
    if (visibleNotifications.length === 0) return;
    setDismissedNotifications((prev) => {
      const next = { ...prev };
      visibleNotifications.forEach((notification) => {
        next[notification.id] = todayKey;
      });
      return next;
    });
    setDialogOpen(false);
    setMiniPanelOpen(false);
  }

  function openFinancialNotification(notification: FinancialNotificationItem, openReport = false) {
    navigate("/contas-pagar", {
      state: {
        dashboardFilter: { type: "status", value: "", label: "Aviso financeiro" },
        filters: {
          dateFrom: notification.dateFrom,
          dateTo: notification.dateTo,
          statuses: notification.statuses,
        },
        openReport,
      },
    });
    setDialogOpen(false);
    setMiniPanelOpen(false);
  }

  const contextValue: MaintenanceNotificationContextValue = {
    visibleNotifications,
    hasVisibleNotifications,
    dialogOpen,
    openNotificationDialog: () => setDialogOpen(true),
    closeNotificationDialog: () => setDialogOpen(false),
    handleDismissToday,
    refreshNotifications,
    miniPanelOpen,
    setMiniPanelOpen,
  };

  return (
    <MaintenanceNotificationContext.Provider value={contextValue}>
      {children}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Notificações
            </DialogTitle>
          </DialogHeader>

          {visibleNotifications.length > 0 && (
            <div className="flex items-center justify-between space-x-4 pb-2">
              <p className="text-sm text-muted-foreground">
                {visibleNotifications.length} aviso{visibleNotifications.length === 1 ? "" : "s"} ativo(s)
              </p>
              <Button variant="ghost" size="sm" className="uppercase tracking-wide" onClick={handleDismissToday}>
                Não mostrar mais hoje
              </Button>
            </div>
          )}

          <div className="space-y-3">
            {visibleNotifications.length === 0 ? (
              <div className="rounded-md border border-dashed border-muted p-4 text-center text-sm text-muted-foreground">
                Nenhum aviso encontrado.
              </div>
            ) : (
              visibleNotifications.map((notification) => (
                <div key={notification.id} className="rounded-lg border border-muted/50 bg-background p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      {notification.kind === "financeiro" ? (
                        <>
                          <p className="text-base font-semibold">{notification.titulo}</p>
                          <p className="text-sm text-muted-foreground">{notification.descricao}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-base font-semibold">{notification.equipamento_nome}</p>
                          <p className="text-sm text-muted-foreground">{notification.setor_nome || "Setor não informado"}</p>
                          <p className="text-sm text-muted-foreground">
                            Próxima: {formatLocalDate(notification.proxima_manutencao)}
                          </p>
                          {notification.fornecedor_nome && (
                            <p className="text-sm text-muted-foreground">Fornecedor: {notification.fornecedor_nome}</p>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="secondary">
                        {notification.kind === "financeiro"
                          ? "Financeiro"
                          : `${notification.diasDiff} dia${notification.diasDiff === 1 ? "" : "s"}`}
                      </Badge>
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    </div>
                  </div>
                  {notification.kind === "financeiro" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {notification.mostrarLinkConsulta && (
                        <Button size="sm" onClick={() => openFinancialNotification(notification)}>
                          Ver parcelas
                        </Button>
                      )}
                      {notification.mostrarLinkRelatorio && (
                        <Button size="sm" variant="outline" onClick={() => openFinancialNotification(notification, true)}>
                          Relatório
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MaintenanceNotificationContext.Provider>
  );
}
