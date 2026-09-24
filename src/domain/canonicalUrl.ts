/**
 * Deterministic canonical-URL normalization used to give a global job posting a
 * stable identity for exact-match dedup. This is NOT fuzzy company/title matching —
 * that belongs to later ingestion work. It only cleans up trivially-equivalent URL
 * forms.
 *
 * Rules: lowercase scheme + host, drop default ports, drop fragment, strip common
 * tracking query params (utm_*, gclid, fbclid, ref), sort remaining params, and
 * remove a trailing slash on the path.
 */
const TRACKING_PARAMS = new Set([
  'gclid',
  'fbclid',
  'ref',
  'ref_src',
  'source',
  'mc_cid',
  'mc_eid',
]);

export function normalizeCanonicalUrl(input: string): string {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    // Not a parseable URL — return the trimmed original rather than inventing one.
    return trimmed;
  }

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = '';

  if (
    (url.protocol === 'http:' && url.port === '80') ||
    (url.protocol === 'https:' && url.port === '443')
  ) {
    url.port = '';
  }

  const kept: [string, string][] = [];
  for (const [key, value] of url.searchParams.entries()) {
    const lower = key.toLowerCase();
    if (lower.startsWith('utm_') || TRACKING_PARAMS.has(lower)) continue;
    kept.push([key, value]);
  }
  kept.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  url.search = '';
  for (const [key, value] of kept) url.searchParams.append(key, value);

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}
