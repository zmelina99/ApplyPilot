import type { QuestionCategory } from './classify.js';
import type { NormalizedQuestion } from './providers.js';

export interface CategorizedQuestion extends NormalizedQuestion {
  category: QuestionCategory;
}

/**
 * The candidate's standard application questions. Attached as a preparation aid when
 * the employer's real form cannot be safely inspected (unsupported provider), so the
 * user has verified answers ready to reuse when applying manually. These are the
 * candidate's canonical answers — not a claim about the specific employer's form.
 */
export function standardQuestions(): CategorizedQuestion[] {
  const q = (
    category: QuestionCategory,
    label: string,
    fieldType: string,
    required: boolean,
    options?: string[],
  ): CategorizedQuestion => ({ category, label, fieldType, required, options: options ?? null });

  return [
    q('NAME', 'Full name', 'text', true),
    q('EMAIL', 'Email address', 'text', true),
    q('PHONE', 'Phone number', 'text', true),
    q('LOCATION', 'Current location', 'text', false),
    q('LINKEDIN', 'LinkedIn URL', 'text', false),
    q('GITHUB', 'GitHub URL', 'text', false),
    q('PORTFOLIO', 'Portfolio / website', 'text', false),
    q('RESUME', 'Resume / CV', 'file', true),
    q('YEARS_EXPERIENCE', 'Years of professional software engineering experience', 'number', true),
    q('WORK_AUTHORIZATION', "Are you legally authorized to work in this role's country?", 'boolean', true),
    q('SPONSORSHIP', 'Will you now or in the future require visa sponsorship?', 'boolean', true),
    q('SALARY_EXPECTATION', 'Salary expectation', 'text', false),
    q('AVAILABILITY', 'Availability / earliest start date', 'text', true),
    q('EDUCATION', 'Highest level of education', 'text', false),
    q('LANGUAGE', 'Languages', 'text', false),
    q('RELOCATION', 'Are you open to relocation?', 'text', false),
    q('EEO', 'Voluntary self-identification (EEO)', 'select', false, ['Prefer not to say']),
  ];
}
