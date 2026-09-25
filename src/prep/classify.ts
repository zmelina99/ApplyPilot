import type { questionCategoryEnum } from '../db/schema/enums.js';

export type QuestionCategory = (typeof questionCategoryEnum.enumValues)[number];

/** Technologies we can recognize when a "years of X" question names one. */
const TECH_TOKENS = [
  'react', 'typescript', 'javascript', 'next.js', 'nextjs', 'html', 'css', 'scss',
  'redux', 'vite', 'webpack', 'node', 'node.js', 'express', 'sequelize', 'postgres',
  'postgresql', 'firebase', 'supabase', 'storybook', 'figma', 'ionic', 'capacitor',
  'd3', 'recharts', 'visx', 'jest', 'cypress', 'docker', 'python', 'vue', 'angular',
  'svelte', 'tailwind', 'graphql', 'playwright', 'vitest', 'aws', 'azure',
];

/** Deterministically classify a form question by its label. UNKNOWN is a valid result. */
export function classifyQuestion(labelRaw: string, fieldType = 'text'): QuestionCategory {
  const l = labelRaw.toLowerCase().trim();
  const has = (re: RegExp) => re.test(l);

  if (has(/\b(gender|race|ethnic|hispanic|latino|veteran|disability|eeo|self.?identif|sexual orientation|pronoun)\b/)) return 'EEO';
  if (has(/first name|last name|full name|your name|legal name|^name$/)) return 'NAME';
  if (has(/e-?mail/)) return 'EMAIL';
  if (has(/phone|mobile|telephone/)) return 'PHONE';
  if (has(/linkedin/)) return 'LINKEDIN';
  if (has(/github|gitlab/)) return 'GITHUB';
  if (has(/portfolio|personal (web)?site|website|your url/)) return 'PORTFOLIO';
  if (has(/resume|résumé|\bcv\b|curriculum/)) return 'RESUME';
  if (has(/cover letter/)) return 'COVER_LETTER';
  if (has(/sponsor/)) return 'SPONSORSHIP';
  if (has(/authoriz|authoris|right to work|legally (able|entitled)|work permit|visa status/)) return 'WORK_AUTHORIZATION';
  if (has(/salary|compensation|expected pay|rate expectation|desired (pay|salary)/)) return 'SALARY_EXPECTATION';
  if (has(/relocat/)) return 'RELOCATION';
  if (has(/hours? per week|hours?\/week|weekly hours|commit.*per week|hours could you commit/)) return 'AVAILABILITY';
  if (has(/notice period|start date|available|availability|when can you|when could you begin/)) return 'AVAILABILITY';
  if (has(/degree|education|university|bachelor|master|diploma|school/)) return 'EDUCATION';
  if (has(/language/)) return 'LANGUAGE';
  if (has(/country.*residence|territory of residence|residence.*country/)) return 'LOCATION';
  if (has(/current (city|location)|where are you (based|located)|city|country|location/)) return 'LOCATION';

  if (has(/\byears?\b/) || (has(/how (many|long)/) && has(/experien/))) {
    return namedTech(l) ? 'TECH_YEARS' : 'YEARS_EXPERIENCE';
  }
  if (namedTech(l) && has(/experience|proficien|familiar|worked with|used/)) return 'TECH_YEARS';

  if (has(/why (do you |are you )?(want|interested|applying|choose)|why (this )?(company|role|us|position)|what (interests|excites)|tell us about|about yourself|motivat/)) return 'WHY_COMPANY';

  if (fieldType === 'textarea' || has(/describe|explain|tell us|share|elaborate/)) return 'FREE_TEXT';
  return 'UNKNOWN';
}

/** The technology named in a label, if any (for TECH_YEARS answering). */
export function namedTech(labelLower: string): string | null {
  for (const t of TECH_TOKENS) {
    // word-ish boundary; allow '.'/'#' in tech names
    const re = new RegExp(`(^|[^a-z])${t.replace(/[.]/g, '\\.')}([^a-z]|$)`, 'i');
    if (re.test(labelLower)) return t;
  }
  return null;
}
