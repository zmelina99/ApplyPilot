/// <reference lib="dom" />
/**
 * Read-only browser resolution for aggregator pages (e.g. Jobicy) that render the
 * employer/ATS apply link client-side. It may navigate/follow the Apply link and
 * redirects, but NEVER logs in, creates accounts, fills forms, uploads files, solves
 * CAPTCHAs, or submits anything. If reaching the employer application would require
 * signing in, it stops and reports loginRequired.
 */
export interface BrowserResolution {
  finalUrl: string | null;
  loginRequired: boolean;
  note?: string;
}

export interface BrowserResolver {
  resolve(pageUrl: string): Promise<BrowserResolution>;
}

const UA =
  'ApplyPilot/0.2 (personal job-search; read-only navigation; +https://github.com/zmelina99/ApplyPilot)';

// Hosts we recognize as a real ATS / employer application (not the aggregator).
const ATS_SOURCE =
  '(greenhouse\\.io|lever\\.co|ashbyhq\\.com|workable\\.com|smartrecruiters\\.com|recruitee\\.com|breezy\\.hr|bamboohr\\.com|teamtailor\\.com|jobvite\\.com|icims\\.com|myworkdayjobs\\.com|workday)';

/** True when a URL's host is not the aggregator (i.e. a real external destination). */
function isExternal(url: string, aggregatorHost: string): boolean {
  try { return new URL(url).hostname.replace(/^www\./, '') !== aggregatorHost.replace(/^www\./, ''); }
  catch { return false; }
}

/**
 * Playwright-backed resolver. Playwright is imported lazily so unit tests (which use a
 * mock resolver) never load it, and the app runs without a browser unless resolution
 * is actually requested.
 */
export class PlaywrightBrowserResolver implements BrowserResolver {
  constructor(private readonly opts: { timeoutMs?: number } = {}) {}

  async resolve(pageUrl: string): Promise<BrowserResolution> {
    const timeout = this.opts.timeoutMs ?? 20_000;
    const aggregatorHost = (() => { try { return new URL(pageUrl).hostname; } catch { return ''; } })();
    let browser: import('playwright').Browser | null = null;
    try {
      const { chromium } = await import('playwright');
      browser = await chromium.launch({ headless: true });
      const ctx = await browser.newContext({ userAgent: UA });
      const page = await ctx.newPage();
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout });

      // 1) A statically/JS-rendered external apply link, if present.
      const href = await page.evaluate((atsSrc) => {
        const re = new RegExp(atsSrc, 'i');
        const anchors = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
        const applyEl = anchors.find((a) => /apply/i.test(a.textContent || '') && re.test(a.href) && !/jobicy/i.test(a.href));
        if (applyEl) return applyEl.href;
        const anyAts = anchors.find((a) => re.test(a.href) && !/jobicy/i.test(a.href));
        return anyAts ? anyAts.href : null;
      }, ATS_SOURCE);
      if (href && isExternal(href, aggregatorHost)) return { finalUrl: href, loginRequired: false };

      // 2) Follow the "Apply" control (navigation only) and see where it goes.
      const applyBtn = page.getByRole('button', { name: /apply now|apply for this/i }).first();
      const applyLink = page.getByRole('link', { name: /apply now|apply for this|apply here/i }).first();
      const control = (await applyBtn.count()) > 0 ? applyBtn : (await applyLink.count()) > 0 ? applyLink : null;
      if (!control) return { finalUrl: null, loginRequired: false, note: 'No apply control found.' };

      const popupP = ctx.waitForEvent('page', { timeout: 6000 }).catch(() => null);
      const navP = page
        .waitForURL((u) => isExternal(u.toString(), aggregatorHost), { timeout: 6000 })
        .then(() => page.url())
        .catch(() => null);
      await control.click({ timeout: 5000 }).catch(() => {});

      const popup = await popupP;
      if (popup) {
        await popup.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
        const pu = popup.url();
        if (isExternal(pu, aggregatorHost)) return { finalUrl: pu, loginRequired: false };
      }
      const navUrl = await navP;
      if (navUrl && isExternal(navUrl, aggregatorHost)) return { finalUrl: navUrl, loginRequired: false };

      // 3) No external destination — detect the sign-in gate (we NEVER sign in).
      const loginGate = await page.evaluate(() =>
        /sign in to continue|sign in or create a free account|before you apply|log ?in to apply|create a free account/i.test(document.body?.innerText || ''),
      );
      return {
        finalUrl: null,
        loginRequired: loginGate,
        note: loginGate ? 'Employer application is behind an aggregator sign-in wall (not bypassed).' : 'Apply destination not resolvable read-only.',
      };
    } catch (err) {
      return { finalUrl: null, loginRequired: false, note: `Browser resolve failed: ${err instanceof Error ? err.message : String(err)}` };
    } finally {
      await browser?.close().catch(() => {});
    }
  }
}
