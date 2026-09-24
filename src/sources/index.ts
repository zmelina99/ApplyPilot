import type { JobSourceAdapter } from './types.js';
import { RemotiveAdapter } from './remotive.js';
import { ArbeitnowAdapter } from './arbeitnow.js';
import { JobicyAdapter } from './jobicy.js';

export * from './types.js';

/**
 * The enabled source adapters for this MVP. Add/remove adapters here — the pipeline
 * and CLI depend only on the JobSourceAdapter interface, never on a specific board.
 */
export function enabledAdapters(): JobSourceAdapter[] {
  return [new RemotiveAdapter(), new ArbeitnowAdapter(), new JobicyAdapter()];
}
