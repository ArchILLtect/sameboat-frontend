export type AppEventType =
  | 'auth:login'
  | 'auth:logout'
  | 'auth:refresh'
  | 'health:success'
  | 'health:fail'
  | 'health:pause'
  | 'health:resume';

export type AppEvent = { type: AppEventType; payload?: unknown; ts: number };

type Handler = (e: AppEvent) => void;

const listeners = new Set<Handler>();

export function onEvent(h: Handler) {
  listeners.add(h);
  return () => listeners.delete(h);
}

export function emit(type: AppEventType, payload?: unknown) {
  const evt: AppEvent = { type, payload, ts: Date.now() };
  for (const l of listeners) l(evt);
  if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_EVENTS) {
    console.debug('[event]', evt);
  }
}
