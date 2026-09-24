/**
 * Minimal HTTP JSON client for source adapters. Sets a clear, honest User-Agent and
 * a timeout. It performs NO anti-bot evasion, cookie games, or auth bypass — if a
 * source needs those, we do not use it.
 */
const USER_AGENT =
  'ApplyPilot/0.2 (personal job-search agent; +https://github.com/zmelina99/ApplyPilot)';

export async function fetchJson<T>(
  url: string,
  { timeoutMs = 25_000 }: { timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
