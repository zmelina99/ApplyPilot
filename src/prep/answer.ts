import type { CandidateFacts } from '../config/candidateFacts.js';
import type { CandidateIdentity } from '../config/candidateIdentity.js';
import type { SearchConfig } from '../config/searchConfig.js';
import type { QuestionCategory } from './classify.js';
import { namedTech } from './classify.js';

export type AnswerSource = 'PROFILE' | 'APPROVED_ANSWER' | 'DETERMINISTIC_RULE' | 'GENERATED' | 'USER' | 'UNKNOWN';
export type AnswerStatus = 'READY' | 'NEEDS_INPUT' | 'NEEDS_GENERATION' | 'OPTIONAL_BLANK' | 'UNSUPPORTED';

export interface PrepQuestion {
  label: string;
  category: QuestionCategory;
  fieldType: string;
  required: boolean;
  options?: string[] | null;
}

export interface AnswerContext {
  facts: CandidateFacts;
  identity: CandidateIdentity;
  salary: SearchConfig['salary'];
  swissRole: boolean;
  resumeAvailable: boolean;
  /** Reusable saved answers, keyed by `${category}` or `${category}:${techOrLabel}`. */
  saved: Map<string, string>;
}

export interface ProposedAnswer {
  value: string | null;
  source: AnswerSource;
  confidence: 'high' | 'medium' | 'low';
  status: AnswerStatus;
}

const ready = (value: string, source: AnswerSource, confidence: 'high' | 'medium' | 'low' = 'high'): ProposedAnswer =>
  ({ value, source, confidence, status: 'READY' });
const needsInput = (): ProposedAnswer => ({ value: null, source: 'UNKNOWN', confidence: 'low', status: 'NEEDS_INPUT' });
const needsGen = (): ProposedAnswer => ({ value: null, source: 'UNKNOWN', confidence: 'low', status: 'NEEDS_GENERATION' });
const optionalBlank = (): ProposedAnswer => ({ value: null, source: 'DETERMINISTIC_RULE', confidence: 'high', status: 'OPTIONAL_BLANK' });

const CORE = new Set(['react', 'typescript', 'javascript', 'next.js', 'nextjs', 'html', 'css']);
const GENERAL_EXP = /(software|engineering|development|programming|coding|professional|industry|frontend|front-end|web|full.?stack|fullstack|overall|total|work)/;

/**
 * Propose an answer for one question using ONLY approved candidate facts. Never
 * invents skills, years, authorization, or experience. Unknown → NEEDS_INPUT (never a
 * guess); free-text without an LLM → NEEDS_GENERATION.
 */
export function answerQuestion(q: PrepQuestion, ctx: AnswerContext): ProposedAnswer {
  // Reusable, user-approved answers win first.
  const savedKey = q.category === 'TECH_YEARS' ? `TECH_YEARS:${namedTech(q.label.toLowerCase()) ?? q.label.toLowerCase()}` : q.category;
  const saved = ctx.saved.get(savedKey);
  if (saved != null) return { value: saved, source: 'APPROVED_ANSWER', confidence: 'high', status: 'READY' };

  const { facts, identity } = ctx;
  switch (q.category) {
    case 'NAME': return identity.fullName ? ready(identity.fullName, 'PROFILE') : needsInput();
    case 'EMAIL': return identity.email ? ready(identity.email, 'PROFILE') : needsInput();
    case 'PHONE': return identity.phone ? ready(identity.phone, 'PROFILE') : needsInput();
    case 'LINKEDIN': return identity.linkedinUrl ? ready(identity.linkedinUrl, 'PROFILE') : needsInput();
    case 'GITHUB': return identity.githubUrl ? ready(identity.githubUrl, 'PROFILE') : needsInput();
    case 'PORTFOLIO': return identity.portfolioUrl ? ready(identity.portfolioUrl, 'PROFILE') : needsInput();
    case 'LOCATION': return identity.location ? ready(identity.location, 'PROFILE') : needsInput();

    case 'RESUME': return ctx.resumeAvailable ? ready('Attach default resume', 'PROFILE') : needsInput();

    case 'YEARS_EXPERIENCE':
      // Only answer for GENERAL software experience — never stretch to a specific domain.
      return GENERAL_EXP.test(q.label.toLowerCase())
        ? ready(String(facts.totalYearsExperience), 'DETERMINISTIC_RULE')
        : needsInput();

    case 'TECH_YEARS': {
      const tech = namedTech(q.label.toLowerCase());
      if (!tech) return needsInput();
      const t = tech.replace('.js', '').toLowerCase();
      if (CORE.has(tech) || CORE.has(t) || tech === 'html' || tech === 'css') {
        return ready(String(facts.totalYearsExperience), 'DETERMINISTIC_RULE');
      }
      if (facts.noExperience.some((n) => n.toLowerCase() === tech || n.toLowerCase() === t)) {
        return ready('0', 'DETERMINISTIC_RULE'); // truthfully no experience
      }
      // Professionally used but no approved numeric years → cannot invent a number.
      return needsInput();
    }

    case 'WORK_AUTHORIZATION':
    case 'SPONSORSHIP':
      // Truthful, safe default: the human answers these per-role. Never inferred.
      return needsInput();

    case 'AVAILABILITY':
      if (q.fieldType === 'date') return needsInput();
      return ready(cap(facts.availability), 'DETERMINISTIC_RULE');

    case 'RELOCATION':
      return facts.relocation ? ready(facts.relocation, 'PROFILE') : needsInput();

    case 'SALARY_EXPECTATION':
      return answerSalary(q, ctx);

    case 'EDUCATION':
      if (q.options && q.options.length) {
        const hs = q.options.find((o) => /high school|secondary|diploma/i.test(o));
        return hs ? ready(hs, 'PROFILE') : needsInput();
      }
      return ready(`${facts.education.highest} (also: ${facts.education.additional})`, 'PROFILE');

    case 'LANGUAGE':
      if (q.options && q.options.length) return needsInput();
      return facts.languages.length
        ? ready(facts.languages.map((l) => `${l.name} (${l.level})`).join(', '), 'PROFILE')
        : needsInput();

    case 'EEO': {
      const decline = (q.options ?? []).find((o) => /decline|prefer not|not to say|do not wish|not to answer/i.test(o));
      if (decline) return ready(decline, 'DETERMINISTIC_RULE');
      return q.required ? needsInput() : optionalBlank();
    }

    case 'COVER_LETTER':
    case 'WHY_COMPANY':
    case 'FREE_TEXT':
      return needsGen();

    case 'UNKNOWN':
    default:
      return q.required ? needsInput() : optionalBlank();
  }
}

function answerSalary(q: PrepQuestion, ctx: AnswerContext): ProposedAnswer {
  if (!q.required) return optionalBlank();
  const numeric = /number|integer|currency|decimal|money/.test(q.fieldType);
  if (numeric) {
    const target = ctx.swissRole ? ctx.salary.targets['CHF'] : ctx.salary.targets['EUR'];
    if (target == null) return needsInput();
    return ready(String(target), 'DETERMINISTIC_RULE', 'medium');
  }
  return ready(
    'Negotiable based on the scope of the role, total compensation, and employment arrangement.',
    'APPROVED_ANSWER', 'high',
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
