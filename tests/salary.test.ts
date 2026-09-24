import { describe, it, expect } from 'vitest';
import { parseSalary } from '../src/analysis/salaryParser.js';

describe('deterministic salary parser', () => {
  it('parses a EUR annual range', () => {
    expect(parseSalary('Salary: €60,000–€80,000 per year')).toEqual({
      min: 60000, max: 80000, currency: 'EUR', period: 'YEAR',
    });
  });
  it('parses EUR with k notation, single value', () => {
    expect(parseSalary('We offer EUR 65k')).toEqual({ min: 65000, max: null, currency: 'EUR', period: 'YEAR' });
  });
  it('parses CHF k-notation range', () => {
    expect(parseSalary('Compensation CHF 90k–110k')).toEqual({ min: 90000, max: 110000, currency: 'CHF', period: 'YEAR' });
  });
  it('parses a USD annual range', () => {
    expect(parseSalary('$100k–$130k annually')).toEqual({ min: 100000, max: 130000, currency: 'USD', period: 'YEAR' });
  });
  it('parses GBP with explicit /year', () => {
    expect(parseSalary('£70,000/year')).toEqual({ min: 70000, max: null, currency: 'GBP', period: 'YEAR' });
  });
  it('ignores amounts with no currency (ambiguous)', () => {
    expect(parseSalary('Range: 60,000 - 80,000 depending on experience')).toBeNull();
  });
  it('does not treat OTE as base salary', () => {
    expect(parseSalary('$120,000 OTE')).toBeNull();
  });
  it('ignores equity percentages', () => {
    expect(parseSalary('Generous 0.5% equity package')).toBeNull();
  });
  it('does not convert an hourly rate to annual', () => {
    expect(parseSalary('$50 per hour')).toBeNull();
  });
  it('does not convert a monthly rate', () => {
    expect(parseSalary('CHF 8000 per month')).toBeNull();
  });
  it('parses base salary even when equity is mentioned separately', () => {
    expect(parseSalary('Base salary €70,000 per year plus meaningful equity')).toEqual({
      min: 70000, max: null, currency: 'EUR', period: 'YEAR',
    });
  });
  it('returns null for missing salary', () => {
    expect(parseSalary('Great remote role. Apply now!')).toBeNull();
    expect(parseSalary(null)).toBeNull();
  });
});
