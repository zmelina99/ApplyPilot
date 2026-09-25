import { describe, it, expect } from 'vitest';
import { classifyQuestion } from '../src/prep/classify.js';
import { detectProvider, parseGreenhouse, parseGreenhouseQuestions } from '../src/prep/providers.js';
import { answerQuestion, type AnswerContext, type PrepQuestion } from '../src/prep/answer.js';
import { standardQuestions } from '../src/prep/standardQuestions.js';
import { loadApplicationDefaults } from '../src/config/applicationDefaults.js';
import { loadCandidateFacts } from '../src/config/candidateFacts.js';
import { loadSearchConfig } from '../src/config/searchConfig.js';
import { formatConcreteStartDate } from '../src/prep/dates.js';
const facts = loadCandidateFacts();
const salary = loadSearchConfig().salary;
const applicationDefaults = loadApplicationDefaults();

function ctx(over: Partial<AnswerContext> = {}): AnswerContext {
  return {
    facts, salary, applicationDefaults,
    identity: { fullName: 'Test User', email: 't@example.com', phone: null, location: 'Valencia, Spain', linkedinUrl: null, githubUrl: null, portfolioUrl: 'https://example.com' },
    swissRole: false, resumeAvailable: true, saved: new Map(),
    ...over,
  };
}
const ask = (label: string, extra: Partial<PrepQuestion> = {}) =>
  answerQuestion({ label, category: classifyQuestion(label, extra.fieldType), fieldType: 'text', required: true, options: null, ...extra }, ctx({ ...(extra.options ? {} : {}) }));

describe('question classification', () => {
  it('classifies common questions', () => {
    expect(classifyQuestion('First name')).toBe('NAME');
    expect(classifyQuestion('Email address')).toBe('EMAIL');
    expect(classifyQuestion('LinkedIn profile')).toBe('LINKEDIN');
    expect(classifyQuestion('Are you legally authorized to work in the US?')).toBe('WORK_AUTHORIZATION');
    expect(classifyQuestion('Will you require sponsorship?')).toBe('SPONSORSHIP');
    expect(classifyQuestion('Desired salary')).toBe('SALARY_EXPECTATION');
    expect(classifyQuestion('How many years of React experience do you have?')).toBe('TECH_YEARS');
    expect(classifyQuestion('Years of professional software experience')).toBe('YEARS_EXPERIENCE');
    expect(classifyQuestion('Why do you want to work here?')).toBe('WHY_COMPANY');
    expect(classifyQuestion('Gender')).toBe('EEO');
    expect(classifyQuestion('Country (or territory) of residence')).toBe('LOCATION');
    expect(classifyQuestion('On average, how many hours could you commit per week?')).toBe('AVAILABILITY');
    expect(classifyQuestion('Something unusual and specific')).toBe('UNKNOWN');
  });
});

describe('provider detection & Greenhouse parsing', () => {
  it('detects providers by host', () => {
    expect(detectProvider('https://boards.greenhouse.io/acme/jobs/123')).toBe('GREENHOUSE');
    expect(detectProvider('https://jobs.lever.co/acme/abc')).toBe('LEVER');
    expect(detectProvider('https://jobicy.com/jobs/1')).toBe('AGGREGATOR');
    expect(detectProvider('https://apply.workable.com/x/j/Y')).toBe('WORKABLE');
    expect(detectProvider('https://careers.acme.com/apply')).toBe('CUSTOM');
  });
  it('parses greenhouse url shapes', () => {
    expect(parseGreenhouse('https://boards.greenhouse.io/acme/jobs/123')).toEqual({ board: 'acme', jobId: '123' });
    expect(parseGreenhouse('https://boards.greenhouse.io/embed/job_app?for=acme&token=456')).toEqual({ board: 'acme', jobId: '456' });
  });
  it('normalizes greenhouse questions', () => {
    const qs = parseGreenhouseQuestions({
      questions: [
        { label: 'First Name', required: true, fields: [{ name: 'first_name', type: 'input_text' }] },
        { label: 'Resume', required: true, fields: [{ name: 'resume', type: 'input_file' }] },
        { label: 'Preferred office', required: false, fields: [{ name: 'office', type: 'multi_value_single_select', values: [{ label: 'Remote', value: 1 }, { label: 'NYC', value: 2 }] }] },
      ],
    });
    expect(qs).toHaveLength(3);
    expect(qs[1]!.fieldType).toBe('file');
    expect(qs[2]!.fieldType).toBe('select');
    expect(qs[2]!.options).toEqual(['Remote', 'NYC']);
  });
});

describe('deterministic answering — truthfulness', () => {
  it('answers general experience with 4 but never stretches to a specific domain', () => {
    expect(ask('Years of professional software engineering experience')).toMatchObject({ value: '4', status: 'READY' });
    expect(ask('How many years building enterprise integrations?')).toMatchObject({ status: 'NEEDS_INPUT' });
  });
  it('answers core tech years, refuses to invent unproven years, marks no-experience truthfully', () => {
    expect(ask('Years of React experience')).toMatchObject({ value: '4', status: 'READY' });
    expect(ask('Years of Redux experience')).toMatchObject({ status: 'NEEDS_INPUT' }); // professional, no approved number
    expect(ask('Years of Vue experience')).toMatchObject({ value: '0', status: 'READY' }); // no experience → truthful 0
    expect(ask('Years of AWS experience')).toMatchObject({ value: '0', status: 'READY' });
  });
  it('never guesses work authorization or sponsorship', () => {
    expect(ask('Are you authorized to work in the United States?')).toMatchObject({ status: 'NEEDS_INPUT' });
    expect(ask('Will you now or in the future require sponsorship?')).toMatchObject({ status: 'NEEDS_INPUT' });
  });
  it('applies the salary policy', () => {
    expect(ask('Salary expectation', { required: false })).toMatchObject({ status: 'OPTIONAL_BLANK' });
    expect(ask('Expected salary', { required: true, fieldType: 'number' })).toMatchObject({ value: '60000', status: 'READY' });
    expect(answerQuestion({ label: 'Expected salary', category: 'SALARY_EXPECTATION', fieldType: 'number', required: true, options: null }, ctx({ swissRole: true }))).toMatchObject({ value: '100000' });
    expect(ask('What is your salary expectation?', { required: true })).toMatchObject({ status: 'READY', source: 'APPROVED_ANSWER' });
    expect(ask('How much compensation (in USD) would you expect per hour of labor?')).toMatchObject({ value: '35', status: 'READY' });
  });
  it('uses approved application defaults for country, hours, and runtime start dates', () => {
    expect(ask('Country (or territory) of residence')).toMatchObject({ value: 'Spain', status: 'READY' });
    expect(answerQuestion(
      { label: 'Country (or territory) of residence', category: 'LOCATION', fieldType: 'text', required: true, options: null },
      ctx({ swissRole: true }),
    )).toMatchObject({ value: 'Switzerland', status: 'READY' });
    expect(ask('On average, how many hours could you commit to Kobo per week?')).toMatchObject({ value: '40', status: 'READY' });
    const ref = new Date(2026, 8, 25);
    expect(answerQuestion(
      { label: 'When could you begin working with us?', category: 'AVAILABILITY', fieldType: 'text', required: true, options: null, placeholder: 'MM/DD/YYYY' },
      ctx({ referenceDate: ref }),
    )).toMatchObject({ value: formatConcreteStartDate(ref, 'MM/DD/YYYY'), status: 'READY' });
    expect(ask('Earliest start date / availability')).toMatchObject({ value: 'Immediate', status: 'READY' });
  });
  it('handles EEO with and without a decline option', () => {
    expect(ask('Gender', { required: true, options: ['Male', 'Female', 'Prefer not to say'] })).toMatchObject({ value: 'Prefer not to say', status: 'READY' });
    expect(ask('Gender', { required: true, options: ['Male', 'Female'] })).toMatchObject({ status: 'NEEDS_INPUT' });
    expect(ask('Gender', { required: false, options: ['Male', 'Female'] })).toMatchObject({ status: 'OPTIONAL_BLANK' });
  });
  it('marks free-text as NEEDS_GENERATION (no LLM)', () => {
    expect(ask('Why do you want to work here?')).toMatchObject({ status: 'NEEDS_GENERATION' });
    expect(ask('Tell us about a relevant project.', { fieldType: 'textarea' })).toMatchObject({ status: 'NEEDS_GENERATION' });
  });
  it('handles unknown required vs optional', () => {
    expect(ask('Some unusual company-specific field', { required: true })).toMatchObject({ status: 'NEEDS_INPUT' });
    expect(ask('Some unusual company-specific field', { required: false })).toMatchObject({ status: 'OPTIONAL_BLANK' });
  });
  it('uses profile identity + deterministic facts', () => {
    expect(ask('Full name')).toMatchObject({ value: 'Test User', source: 'PROFILE', status: 'READY' });
    expect(ask('Phone number')).toMatchObject({ status: 'NEEDS_INPUT' }); // identity.phone null
    expect(ask('Earliest start date / availability')).toMatchObject({ value: 'Immediate', status: 'READY' });
    expect(ask('Resume / CV', { fieldType: 'file' })).toMatchObject({ status: 'READY' });
    expect(answerQuestion({ label: 'Resume', category: 'RESUME', fieldType: 'file', required: true, options: null }, ctx({ resumeAvailable: false }))).toMatchObject({ status: 'NEEDS_INPUT' });
  });
  it('prefers a saved reusable answer', () => {
    const c = ctx({ saved: new Map([['WORK_AUTHORIZATION', 'Yes, authorized in the EU']]) });
    expect(answerQuestion({ label: 'Work authorization', category: 'WORK_AUTHORIZATION', fieldType: 'text', required: true, options: null }, c))
      .toMatchObject({ value: 'Yes, authorized in the EU', source: 'APPROVED_ANSWER', status: 'READY' });
  });
});

describe('standard question set', () => {
  it('covers the core categories', () => {
    const cats = standardQuestions().map((q) => q.category);
    for (const c of ['NAME', 'EMAIL', 'RESUME', 'WORK_AUTHORIZATION', 'SALARY_EXPECTATION', 'EEO']) expect(cats).toContain(c);
  });
});
