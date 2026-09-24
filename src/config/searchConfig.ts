import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Typed view of config/search-profile.json — the AUTHORITATIVE machine-readable
 * search configuration for the deterministic eligibility engine.
 *
 * Source of truth: `config/search-profile.json`, which is derived from the
 * human-readable APPROVED rules in `profile/search-rules.md`. The engine consumes
 * this file, never the Markdown. Candidate rules are NOT duplicated in source code.
 */
export interface SearchConfig {
  role: {
    frontendKeywords: string[];
    adjacentTitleKeywords: string[];
    outOfScopeTitleKeywords: string[];
    managementTitleKeywords: string[];
    leadAllowedKeywords: string[];
    juniorTitleKeywords: string[];
    reviewSeniorityKeywords: string[];
    excludeSeniorityKeywords: string[];
  };
  freshness: { maxAgeDays: number; priorityHours: number };
  location: {
    onsiteAllowedCities: string[];
    switzerlandTokens: string[];
    internationalRemoteSignals: string[];
    europeRemoteSignals: string[];
    europeCountryTokens: string[];
    europeCityTokens: string[];
    argentinaTokens: string[];
    ukTokens: string[];
    outsideResidencySignals: string[];
    northAmericaTokens: string[];
  };
  salary: {
    comparableCurrencies: string[];
    floors: Record<string, number>;
    targets: Record<string, number>;
    swissCurrency: string;
  };
  seniority: { candidateYears: number };
}

const DEFAULT_CONFIG_PATH = path.resolve('config/search-profile.json');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid search-profile.json: ${message}`);
}

/** Load and validate the search configuration. Fails loudly on a malformed file. */
export function loadSearchConfig(configPath: string = DEFAULT_CONFIG_PATH): SearchConfig {
  const raw = JSON.parse(readFileSync(configPath, 'utf8')) as SearchConfig;

  assert(raw.role && Array.isArray(raw.role.frontendKeywords), 'role.frontendKeywords');
  assert(Array.isArray(raw.role.outOfScopeTitleKeywords), 'role.outOfScopeTitleKeywords');
  assert(Array.isArray(raw.role.juniorTitleKeywords), 'role.juniorTitleKeywords');
  assert(typeof raw.freshness?.maxAgeDays === 'number', 'freshness.maxAgeDays');
  assert(typeof raw.freshness?.priorityHours === 'number', 'freshness.priorityHours');
  assert(raw.location && Array.isArray(raw.location.switzerlandTokens), 'location.switzerlandTokens');
  assert(raw.salary && typeof raw.salary.floors === 'object', 'salary.floors');
  assert(Array.isArray(raw.salary.comparableCurrencies), 'salary.comparableCurrencies');
  assert(typeof raw.seniority?.candidateYears === 'number', 'seniority.candidateYears');

  return raw;
}
