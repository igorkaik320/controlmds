import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { toast } from '@/components/ui/use-toast';

const INACTIVITY_MS = 15 * 60 * 1000; // 15 minutos
const WARN_BEFORE_MS = 60 * 1000; // avisa 1 min antes
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];

/**
 * Desloga o usuário automaticamente após 15 minutos sem interação.
 * Mostra aviso 1 minuto antes do logout.
 */
export function useInactivityLogout() {
  const { user, signOut } = useAuth();
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;

    const clearTimers = () => {
      if (warnTimer.current) clearTimeout(warnTimer.current);
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
    };

    const resetTimers = () => {
      clearTimers();
      warnTimer.current = setTimeout(() => {
        toast({
          title: 'Sessão prestes a expirar',
          description: 'Você será desconectado em 1 minuto por inatividade.',
          variant: 'destructive',
        });
      }, INACTIVITY_MS - WARN_BEFORE_MS);

      logoutTimer.current = setTimeout(async () => {
        toast({
          title: 'Sessão encerrada',
          description: 'Você foi desconectado por inatividade.',
        });
        await signOut();
      }, INACTIVITY_MS);
    };

    // Throttle pequeno para não disparar reset em cada pixel do mouse
    let lastReset = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastReset < 1000) return;
      lastReset = now;
      resetTimers();
    };

    resetTimers();
    EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));

    return () => {
      clearTimers();
      EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
    };
  }, [user, signOut]);
}
