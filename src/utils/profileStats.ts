import type { ApiMeResponse } from '../types/api.types.ts';
import { pluralizeRuWithCount } from './russianPlural.ts';

export interface VolumeStat {
  total: number;
  label: string;
}

export interface PlankDurationParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function findVolume(volume: ApiMeResponse['volume'], matchers: string[]): number {
  const entry = volume.find((item) =>
    matchers.some((matcher) => item.exercise.toLowerCase().includes(matcher)),
  );
  return entry?.total ?? 0;
}

export function getSquatsVolume(volume: ApiMeResponse['volume']): VolumeStat {
  return {
    total: findVolume(volume, ['присед', 'squat']),
    label: 'раза',
  };
}

export function getPushupsVolume(volume: ApiMeResponse['volume']): VolumeStat {
  return {
    total: findVolume(volume, ['отжим', 'push']),
    label: 'раза',
  };
}

export function getPlankDuration(volume: ApiMeResponse['volume']): PlankDurationParts {
  const totalSeconds = findVolume(volume, ['планк', 'plank']);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function formatRepsCount(count: number): string {
  return pluralizeRuWithCount(count, ['раз', 'раза', 'раз']);
}
