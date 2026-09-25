export type ProviderName =
  | 'GREENHOUSE' | 'LEVER' | 'ASHBY' | 'WORKABLE' | 'SMARTRECRUITERS'
  | 'RECRUITEE' | 'CUSTOM' | 'AGGREGATOR' | 'UNKNOWN';

export interface NormalizedQuestion {
  providerFieldId?: string | null;
  label: string;
  fieldType: string; // text | textarea | select | multiselect | boolean | file
  required: boolean;
  options?: string[] | null;
  /** Input placeholder when present (e.g. MM/DD/YYYY date fields). */
  placeholder?: string | null;
}

const HOST_PROVIDER: [RegExp, ProviderName][] = [
  [/(^|\.)greenhouse\.io$/i, 'GREENHOUSE'],
  [/(^|\.)boards\.greenhouse\.io$/i, 'GREENHOUSE'],
  [/(^|\.)job-boards\.greenhouse\.io$/i, 'GREENHOUSE'],
  [/(^|\.)lever\.co$/i, 'LEVER'],
  [/(^|\.)ashbyhq\.com$/i, 'ASHBY'],
  [/(^|\.)workable\.com$/i, 'WORKABLE'],
  [/(^|\.)smartrecruiters\.com$/i, 'SMARTRECRUITERS'],
  [/(^|\.)recruitee\.com$/i, 'RECRUITEE'],
  [/(^|\.)(jobicy|remotive|arbeitnow)\.com$/i, 'AGGREGATOR'],
];

/** Detect the ATS/provider from a URL's host. */
export function detectProvider(url: string): ProviderName {
  let host: string;
  try { host = new URL(url).hostname; } catch { return 'UNKNOWN'; }
  for (const [re, name] of HOST_PROVIDER) if (re.test(host)) return name;
  return 'CUSTOM'; // a real, non-aggregator host we don't have an integration for
}

/** Whether we can inspect this provider's form structure safely/publicly. */
export function isStructuredProvider(p: ProviderName): boolean {
  return p === 'GREENHOUSE' || p === 'WORKABLE';
}

/** Parse Greenhouse board + job id from any of its public URL shapes. */
export function parseGreenhouse(url: string): { board: string; jobId: string } | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  // Embedded: boards.greenhouse.io/embed/job_app?for=<board>&token=<id>
  const forBoard = u.searchParams.get('for');
  const token = u.searchParams.get('token') ?? u.searchParams.get('gh_jid');
  if (forBoard && token) return { board: forBoard, jobId: token };
  // Path: /{board}/jobs/{id}
  const m = u.pathname.match(/\/([^/]+)\/jobs\/(\d+)/);
  if (m) return { board: m[1]!, jobId: m[2]! };
  return null;
}

const GH_TYPE: Record<string, string> = {
  input_text: 'text',
  short_text: 'text',
  textarea: 'textarea',
  long_text: 'textarea',
  multi_value_single_select: 'select',
  single_select: 'select',
  multi_value_multi_select: 'multiselect',
  multi_select: 'multiselect',
  input_file: 'file',
  attachment: 'file',
  boolean: 'boolean',
  yes_no: 'boolean',
};

interface GhField { name?: string; type?: string; values?: { label?: string; value?: unknown }[] }
interface GhQuestion { label?: string; required?: boolean; fields?: GhField[] }

/** Normalize the Greenhouse `?questions=true` payload into provider questions. */
export function parseGreenhouseQuestions(job: { questions?: GhQuestion[] }): NormalizedQuestion[] {
  const out: NormalizedQuestion[] = [];
  for (const q of job.questions ?? []) {
    const f = q.fields?.[0];
    const options = (f?.values ?? [])
      .map((v) => (v.label ?? String(v.value ?? '')).trim())
      .filter((s) => s.length > 0);
    out.push({
      providerFieldId: f?.name ?? null,
      label: (q.label ?? f?.name ?? 'Question').trim(),
      fieldType: GH_TYPE[f?.type ?? ''] ?? 'text',
      required: Boolean(q.required),
      options: options.length ? options : null,
    });
  }
  return out;
}
