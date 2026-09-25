import {
  detectProvider, parseGreenhouse, parseGreenhouseQuestions,
  type NormalizedQuestion, type ProviderName,
} from './providers.js';

export interface FetchResult { status: number; finalUrl: string; text: string }
export type Fetcher = (url: string) => Promise<FetchResult>;

const UA = 'ApplyPilot/0.2 (personal job-search; read-only; +https://github.com/zmelina99/ApplyPilot)';

/** Read-only HTTP GET that follows redirects. Never POSTs, never sends candidate data. */
export const httpFetcher: Fetcher = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'text/html,application/json' },
      signal: controller.signal,
    });
    return { status: res.status, finalUrl: res.url, text: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

/** Extract the "apply for this position" outbound href from an aggregator page. */
function extractApplyHref(html: string): string | null {
  const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const text = m[2]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (/apply for this|apply now|apply here|apply on/.test(text)) {
      const href = m[1]!;
      if (/^https?:\/\//i.test(href) && !/#/.test(href.slice(0, 1))) return href;
    }
  }
  return null;
}

export interface ResolveResult {
  applyUrl: string;
  provider: ProviderName;
  gated: boolean; // true when the real destination is hidden behind JS on an aggregator
  note?: string;
}

/**
 * Resolve a job's real application destination (read-only). Aggregator pages that
 * gate the apply link behind JS (e.g. Jobicy) return gated=true with the aggregator
 * page as the apply URL. Remotive/Arbeitnow expose an outbound apply link we follow.
 */
export async function resolveApplyUrl(
  canonicalUrl: string,
  sourceName: string,
  fetcher: Fetcher,
): Promise<ResolveResult> {
  const src = sourceName.toLowerCase();
  if (src === 'jobicy') {
    // Jobicy renders the apply destination client-side; not resolvable read-only.
    return { applyUrl: canonicalUrl, provider: 'AGGREGATOR', gated: true, note: 'Apply link is JS-rendered on Jobicy; apply on the page.' };
  }
  if (src === 'remotive' || src === 'arbeitnow') {
    try {
      const page = await fetcher(canonicalUrl);
      const href = extractApplyHref(page.text);
      if (!href) return { applyUrl: canonicalUrl, provider: 'AGGREGATOR', gated: true, note: 'No outbound apply link found.' };
      const dest = await fetcher(href); // follow redirect trackers (e.g. vonq) to the real ATS
      const finalUrl = dest.finalUrl || href;
      return { applyUrl: finalUrl, provider: detectProvider(finalUrl), gated: false };
    } catch (err) {
      return { applyUrl: canonicalUrl, provider: 'AGGREGATOR', gated: true, note: `Resolve failed: ${err instanceof Error ? err.message : err}` };
    }
  }
  // Unknown source: treat canonical URL directly.
  return { applyUrl: canonicalUrl, provider: detectProvider(canonicalUrl), gated: false };
}

export interface InspectResult {
  provider: ProviderName;
  applyUrl: string;
  supported: boolean;
  loginRequired: boolean;
  captcha: boolean;
  questions: NormalizedQuestion[];
  note: string | null;
}

/** Inspect a resolved destination. Only Greenhouse is inspected structurally (public
 * questions API); everything else is left unsupported (form not auto-understood). */
export async function inspectDestination(resolved: ResolveResult, fetcher: Fetcher): Promise<InspectResult> {
  const base: InspectResult = {
    provider: resolved.provider, applyUrl: resolved.applyUrl, supported: false,
    loginRequired: false, captcha: false, questions: [], note: resolved.note ?? null,
  };
  if (resolved.provider !== 'GREENHOUSE') return base;

  const gh = parseGreenhouse(resolved.applyUrl);
  if (!gh) return { ...base, note: 'Greenhouse URL could not be parsed.' };
  try {
    const api = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(gh.board)}/jobs/${encodeURIComponent(gh.jobId)}?questions=true`;
    const res = await fetcher(api);
    if (res.status === 401 || res.status === 403) return { ...base, loginRequired: true, note: 'Greenhouse job requires authentication.' };
    if (res.status !== 200) return { ...base, note: `Greenhouse API returned ${res.status}.` };
    const json = JSON.parse(res.text) as { questions?: unknown };
    const questions = parseGreenhouseQuestions(json as never);
    return { ...base, supported: true, questions, note: null };
  } catch (err) {
    return { ...base, note: `Greenhouse inspect failed: ${err instanceof Error ? err.message : err}` };
  }
}
