const STORAGE_KEY = 'wowfit_app_onboarding_completed';

function readMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/** Онбординг привязан к user id — сохраняется после выхода на том же устройстве. */
export function isAppOnboardingCompleted(userId: number): boolean {
  return Boolean(readMap()[String(userId)]);
}

export function setAppOnboardingCompleted(userId: number): void {
  const map = readMap();
  map[String(userId)] = true;
  writeMap(map);
}
