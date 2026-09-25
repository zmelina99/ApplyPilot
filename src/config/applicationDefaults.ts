import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Typed view of config/application-defaults.json — APPROVED deterministic answers
 * for application forms. Work authorization is intentionally absent; it is never
 * inferred from application country or residence defaults.
 */
export interface ApplicationDefaults {
  profileVersion: string;
  availability: string;
  weeklyHours: number;
  applicationCountry: { swissJob: string; default: string };
  salary: { usdHourly: number };
  resume: { defaultFile: string | null };
}

const DEFAULT_PATH = path.resolve('config/application-defaults.json');

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Invalid application-defaults.json: ${msg}`);
}

export function loadApplicationDefaults(configPath: string = DEFAULT_PATH): ApplicationDefaults {
  const raw = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  const meta = raw['_meta'] as { profileVersion?: string } | undefined;
  assert(typeof meta?.profileVersion === 'string', '_meta.profileVersion');
  assert(typeof raw['availability'] === 'string', 'availability');
  assert(typeof raw['weeklyHours'] === 'number', 'weeklyHours');
  const country = raw['applicationCountry'] as Record<string, unknown>;
  assert(country && typeof country['swissJob'] === 'string' && typeof country['default'] === 'string', 'applicationCountry');
  const salary = raw['salary'] as Record<string, unknown>;
  assert(salary && typeof salary['usdHourly'] === 'number', 'salary.usdHourly');
  const resume = raw['resume'] as Record<string, unknown> | undefined;
  const defaultFile = resume?.['defaultFile'];
  assert(defaultFile === null || typeof defaultFile === 'string', 'resume.defaultFile');

  return {
    profileVersion: meta.profileVersion,
    availability: raw['availability'] as string,
    weeklyHours: raw['weeklyHours'] as number,
    applicationCountry: {
      swissJob: country['swissJob'] as string,
      default: country['default'] as string,
    },
    salary: { usdHourly: salary['usdHourly'] as number },
    resume: { defaultFile: defaultFile as string | null },
  };
}
