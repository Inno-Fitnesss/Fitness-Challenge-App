/**
 * localStorage wrapper that never throws.
 *
 * iOS Safari with "Block All Cookies" enabled (Settings → Safari), some private
 * / lockdown configurations, and quota-exceeded states throw a SecurityError on
 * ANY localStorage access — including a plain read. An unguarded read at startup
 * (AuthContext.checkAuth) rejected before `setIsLoading(false)` ran, leaving the
 * whole app stuck on the loading spinner. Routing every access through this
 * wrapper degrades to an in-memory store so the app still boots and a session
 * works for the lifetime of the tab.
 */
const memoryStore = new Map<string, string>();

let persistentUsable: boolean | null = null;

function canUsePersistent(): boolean {
  if (persistentUsable !== null) return persistentUsable;
  try {
    const probe = '__wowfit_storage_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    persistentUsable = true;
  } catch {
    persistentUsable = false;
  }
  return persistentUsable;
}

export const safeStorage = {
  getItem(key: string): string | null {
    if (canUsePersistent()) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        // Fall back to the in-memory copy below.
      }
    }
    return memoryStore.has(key) ? memoryStore.get(key)! : null;
  },

  setItem(key: string, value: string): void {
    // Always keep an in-memory copy so reads stay consistent even if the
    // persistent write throws (blocked storage, quota).
    memoryStore.set(key, value);
    if (canUsePersistent()) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Memory copy is the source of truth for this tab.
      }
    }
  },

  removeItem(key: string): void {
    memoryStore.delete(key);
    if (canUsePersistent()) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Nothing else to do.
      }
    }
  },
};
