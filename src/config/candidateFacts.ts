import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Typed view of config/candidate-facts.json — the AUTHORITATIVE compact
 * representation of the candidate's verified facts, derived from the approved
 * profile. The fit analyzer uses ONLY this; it never receives the raw Markdown
 * profile files, and it must never claim anything not present here.
 */
export interface CoreTechnology {
  name: string;
  years: number;
}

export interface CandidateFacts {
  profileVersion: string;
  targetTitles: string[];
  totalYearsExperience: number;
  totalExperienceHuman: string;
  coreTechnologies: CoreTechnology[];
  professionalTechnologies: string[];
  limitedExperience: string[];
  noExperience: string[];
  domainStrengths: string[];
  education: { universityDegree: boolean; highest: string; additional: string };
  availability: string;
}

const DEFAULT_PATH = path.resolve('config/candidate-facts.json');

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Invalid candidate-facts.json: ${msg}`);
}

export function loadCandidateFacts(configPath: string = DEFAULT_PATH): CandidateFacts {
  const raw = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  const meta = raw['_meta'] as { profileVersion?: string } | undefined;
  const profileVersion = meta?.profileVersion;
  assert(typeof profileVersion === 'string', '_meta.profileVersion');
  assert(Array.isArray(raw['coreTechnologies']), 'coreTechnologies');
  assert(Array.isArray(raw['professionalTechnologies']), 'professionalTechnologies');
  assert(Array.isArray(raw['noExperience']), 'noExperience');
  assert(typeof raw['totalYearsExperience'] === 'number', 'totalYearsExperience');

  return {
    profileVersion,
    targetTitles: raw['targetTitles'] as string[],
    totalYearsExperience: raw['totalYearsExperience'] as number,
    totalExperienceHuman: raw['totalExperienceHuman'] as string,
    coreTechnologies: raw['coreTechnologies'] as CoreTechnology[],
    professionalTechnologies: raw['professionalTechnologies'] as string[],
    limitedExperience: (raw['limitedExperience'] as string[]) ?? [],
    noExperience: raw['noExperience'] as string[],
    domainStrengths: (raw['domainStrengths'] as string[]) ?? [],
    education: raw['education'] as CandidateFacts['education'],
    availability: raw['availability'] as string,
  };
}
