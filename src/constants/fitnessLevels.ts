export const FITNESS_LEVEL_OPTIONS = [
  { value: 'beginner', label: 'начинающий' },
  { value: 'intermediate', label: 'продолжающий' },
  { value: 'advanced', label: 'продвинутый' },
  { value: 'professional', label: 'профессионал' },
] as const;

export type FitnessLevel = (typeof FITNESS_LEVEL_OPTIONS)[number]['value'];

export function fitnessLevelLabel(level?: string | null): string {
  if (!level) return '—';
  return FITNESS_LEVEL_OPTIONS.find((option) => option.value === level)?.label ?? '—';
}
