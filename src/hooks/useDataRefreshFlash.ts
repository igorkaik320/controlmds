import { useCallback, useRef } from 'react';

/**
 * Aplica um pulso visual no container (classe `animate-data-refresh` em index.css).
 * Use `flashAfterUpdate` após atualizar estado para o React pintar antes da animação.
 */
export function useDataRefreshFlash() {
  const contentRef = useRef<HTMLDivElement>(null);

  const flash = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    el.classList.remove('animate-data-refresh');
    void el.offsetWidth;
    el.classList.add('animate-data-refresh');
  }, []);

  const flashAfterUpdate = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flash();
      });
    });
  }, [flash]);

  return { contentRef, flash, flashAfterUpdate };
}
