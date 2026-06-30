const STORAGE_KEY = 'wowfit_exercise_onboarding_dismissed';

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

export function isExerciseOnboardingDismissed(exerciseKey: string): boolean {
  return Boolean(readMap()[exerciseKey]);
}

export function setExerciseOnboardingDismissed(
  exerciseKey: string,
  dismissed: boolean,
): void {
  const map = readMap();
  if (dismissed) {
    map[exerciseKey] = true;
  } else {
    delete map[exerciseKey];
  }
  writeMap(map);
}
