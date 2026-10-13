import type { Mood } from './sprites';

/**
 * Mood follows the day: asleep until the first task is done, awake and
 * sitting once the day has started, standing past half, flexing at 100%.
 */
export function moodFor(ratio: number, hasTasks: boolean): Mood {
  if (!hasTasks || ratio <= 0) return 'sueno';
  if (ratio < 0.5) return 'calma';
  if (ratio < 1) return 'foco';
  return 'fuerza';
}
