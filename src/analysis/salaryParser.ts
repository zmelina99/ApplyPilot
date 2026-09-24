/**
 * Conservative, deterministic salary parser. Extracts an ANNUAL salary only when
 * the amount, currency, and (annual) period are high-confidence. It never guesses a
 * currency, never converts between currencies, never converts an hourly/monthly/day
 * rate to annual, and never treats OTE or equity as base salary. Ambiguous input
 * returns null (salary stays unknown — which is NOT a negative signal downstream).
 */
export type ParsedCurrency = 'EUR' | 'CHF' | 'USD' | 'GBP';

export interface ParsedSalary {
  min: number | null;
  max: number | null;
  currency: ParsedCurrency;
  period: 'YEAR';
}

const SYMBOL_TO_CURRENCY: Record<string, ParsedCurrency> = {
  '€': 'EUR',
  eur: 'EUR',
  chf: 'CHF',
  $: 'USD',
  usd: 'USD',
  '£': 'GBP',
  gbp: 'GBP',
};

const ANNUAL_WORDS = /(per\s*year|per\s*annum|p\.?a\.?|annually|annual|a\s*year|\/\s*year|\/\s*yr|\/\s*annum|yearly)/i;
const NON_ANNUAL_WORDS = /(per\s*hour|\/\s*hour|hourly|\/\s*hr|per\s*month|\/\s*month|monthly|\/\s*mo|per\s*day|\/\s*day|daily|per\s*week|weekly)/i;
// A nearby word that indicates the figure really is compensation (not a budget,
// headcount, funding round, etc.). Required — with an annual period — to accept a
// figure parsed from free-text, so "€1000 learning budget" is never read as salary.
const SALARY_CONTEXT = /(salary|salaries|compensation|\bcomp\b|remuneration|\bpay\b|\bbase\b|package|we\s*offer|offering|you'?ll\s*earn|earn\s*up\s*to)/i;
// OTE / on-target / commission label the number as variable pay, not base salary.
// (Equity is a percentage and never matches a currency amount, so it need not appear
// here — a nearby "equity" describing a separate component must not void a base salary.)
const DISQUALIFY_WORDS = /(ote|on[-\s]?target|commission|bonus\s*only)/i;

const MIN_ANNUAL = 10_000; // below this, the figure is not a credible annual salary

function toNumber(raw: string, hasK: boolean): number | null {
  // Salaries are whole numbers; strip thousands separators (both "," and "." styles).
  const digits = raw.replace(/[.,]/g, '');
  const n = Number(digits);
  if (!Number.isFinite(n) || n === 0) return null;
  return hasK ? n * 1000 : n;
}

/**
 * A currency token, one or two amounts (range), each optionally with a `k` suffix.
 * Covers `€60,000–€80,000`, `EUR 65k`, `CHF 90k-110k`, `$100k–$130k`, `£70,000`.
 */
const MONEY_RE =
  /(€|£|\$|chf|eur|usd|gbp)\s?(\d[\d.,]*)\s?(k)?(?:\s?(?:-|–|—|to)\s?(?:€|£|\$|chf|eur|usd|gbp)?\s?(\d[\d.,]*)\s?(k)?)?/gi;

export function parseSalary(text: string | null | undefined): ParsedSalary | null {
  if (!text) return null;
  const hay = text.replace(/\s+/g, ' ');

  for (const m of hay.matchAll(MONEY_RE)) {
    const [full, sym, a1, k1, a2, k2] = m;
    const idx = m.index ?? 0;
    const context = hay.slice(Math.max(0, idx - 25), idx + full.length + 25);

    if (DISQUALIFY_WORDS.test(context)) continue; // OTE / equity / commission → skip
    if (NON_ANNUAL_WORDS.test(context)) continue; // hourly/monthly/etc → do not convert

    const currency = SYMBOL_TO_CURRENCY[(sym ?? '').toLowerCase()];
    if (!currency) continue;

    const min = toNumber(a1 ?? '', Boolean(k1));
    const max = a2 ? toNumber(a2, Boolean(k2)) : null;
    if (min == null) continue;

    // Must be a credible annual magnitude AND carry an annual-period or salary-context
    // signal. This rejects budgets/stipends/headcounts that merely have a currency.
    const top = max ?? min;
    if (top < MIN_ANNUAL) continue;
    const annualByWord = ANNUAL_WORDS.test(context);
    const salaryContext = SALARY_CONTEXT.test(context);
    if (!annualByWord && !salaryContext) continue;

    const lo = max != null ? Math.min(min, max) : min;
    const hi = max != null ? Math.max(min, max) : null;
    return { min: lo, max: hi, currency, period: 'YEAR' };
  }
  return null;
}
