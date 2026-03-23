import { useEffect } from 'react';

const DRAFT_PREFIX = 'form-draft-';
const DIALOG_SUFFIX = '-showDialog';
const WARNING_MESSAGE =
  'Existe um cadastro em andamento. Se sair desta tela, os dados nao salvos poderao ser perdidos. Deseja continuar?';

export function hasOpenDraftDialog() {
  if (typeof window === 'undefined') return false;

  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key || !key.startsWith(DRAFT_PREFIX) || !key.endsWith(DIALOG_SUFFIX)) continue;

    try {
      if (JSON.parse(sessionStorage.getItem(key) || 'false') === true) {
        return true;
      }
    } catch {
      // Ignore malformed storage entries.
    }
  }

  return false;
}

export function confirmDraftDiscard() {
  if (!hasOpenDraftDialog()) return true;
  return window.confirm(WARNING_MESSAGE);
}

export function useBeforeUnloadDraftGuard() {
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasOpenDraftDialog()) return;

      event.preventDefault();
      event.returnValue = WARNING_MESSAGE;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
}
