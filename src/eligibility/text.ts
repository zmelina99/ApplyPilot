/** Strip HTML to plain lowercased text for deterministic keyword matching. Caps
 * length so very long descriptions don't dominate work. No semantic analysis. */
export function htmlToText(html: string | null | undefined, maxLen = 4000): string {
  if (!html) return '';
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return text.slice(0, maxLen);
}

/** True if `haystack` contains any of the (already-lowercased) needles as a substring. */
export function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => n && haystack.includes(n));
}

/** The first needle found in the haystack, or null. */
export function firstMatch(haystack: string, needles: string[]): string | null {
  for (const n of needles) if (n && haystack.includes(n)) return n;
  return null;
}
