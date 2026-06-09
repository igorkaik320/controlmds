type DataRefreshPayload = {
  source: string;
  reason?: string;
  at: number;
};

const CHANNEL_NAME = 'controlmds:data-refresh';
const STORAGE_KEY = 'controlmds:data-refresh-event';

export type DataRefreshHandler = (payload: DataRefreshPayload) => void;

export function publishDataRefresh(source: string, reason?: string) {
  const payload: DataRefreshPayload = { source, reason, at: Date.now() };

  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore private-mode or storage permission failures.
  }

  if ('BroadcastChannel' in window) {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(payload);
      channel.close();
    } catch {
      // Storage event above is enough as a fallback.
    }
  }
}

export function subscribeDataRefresh(handler: DataRefreshHandler) {
  if (typeof window === 'undefined') return () => {};

  let channel: BroadcastChannel | null = null;
  const seen = new Set<number>();

  const dispatch = (payload: DataRefreshPayload) => {
    if (!payload?.at || seen.has(payload.at)) return;
    seen.add(payload.at);
    handler(payload);
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      dispatch(JSON.parse(event.newValue));
    } catch {
      // Ignore malformed external storage values.
    }
  };

  window.addEventListener('storage', onStorage);

  if ('BroadcastChannel' in window) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => dispatch(event.data);
    } catch {
      channel = null;
    }
  }

  return () => {
    window.removeEventListener('storage', onStorage);
    channel?.close();
  };
}
