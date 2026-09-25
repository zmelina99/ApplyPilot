import type { NormalizedQuestion } from './providers.js';

/** Raw field extracted read-only from a Workable apply page (browser context). */
export interface WorkableRawField {
  providerFieldId: string;
  label: string;
  fieldType: string;
  required: boolean;
  placeholder: string;
  options: string[] | null;
}

export interface WorkableInspectResult {
  supported: boolean;
  loginRequired: boolean;
  captcha: boolean;
  questions: NormalizedQuestion[];
  note: string | null;
}

/** Normalize extracted Workable DOM fields into provider questions (pure; testable). */
export function normalizeWorkableFields(raw: WorkableRawField[]): NormalizedQuestion[] {
  const seen = new Set<string>();
  const out: NormalizedQuestion[] = [];
  for (const f of raw) {
    const id = f.providerFieldId.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    let label = f.label.replace(/^\*\s*\n?/, '').replace(/\s+/g, ' ').trim();
    if (id === 'resume') label = 'Resume';
    label = label || id;
    out.push({
      providerFieldId: id,
      label,
      fieldType: f.fieldType,
      required: f.required,
      options: f.options?.length ? f.options : null,
      placeholder: f.placeholder || null,
    });
  }
  return out;
}

const UA =
  'ApplyPilot/0.2 (personal job-search; read-only inspection; +https://github.com/zmelina99/ApplyPilot)';

/**
 * Read-only Playwright inspection of a public Workable apply form. Navigates and
 * extracts field metadata only — never fills, uploads, or submits candidate data.
 */
export async function inspectWorkableApplyForm(applyUrl: string): Promise<WorkableInspectResult> {
  const fail = (note: string, extra: Partial<WorkableInspectResult> = {}): WorkableInspectResult =>
    ({ supported: false, loginRequired: false, captcha: false, questions: [], note, ...extra });

  let browser: import('playwright').Browser | null = null;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ userAgent: UA });
    const page = await ctx.newPage();
    await page.goto(applyUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(3000);

    await page.getByRole('button', { name: /accept all/i }).click({ timeout: 3000 }).catch(() => {});

    const gate = await page.evaluate(() => {
      const text = document.body?.innerText ?? '';
      return {
        loginRequired: /sign in to apply|log in to apply|create an account to apply/i.test(text),
        captcha: /captcha|recaptcha|hcaptcha|verify you are human/i.test(text),
      };
    });
    if (gate.loginRequired) return fail('Workable apply form requires sign-in.', { loginRequired: true });
    if (gate.captcha) return fail('Workable apply form shows a CAPTCHA.', { captcha: true });

    const raw = await page.evaluate(() => {
      const results: {
        providerFieldId: string;
        label: string;
        fieldType: string;
        required: boolean;
        placeholder: string;
        options: string[] | null;
      }[] = [];

      const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
      for (const input of inputs) {
        const el = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;

        const dataUi = el.getAttribute('data-ui') || el.closest('[data-ui]')?.getAttribute('data-ui') || '';
        const providerFieldId = dataUi || el.name || el.id || '';
        if (!providerFieldId) continue;

        let labelText = '';
        let container: Element | null = el.closest('div');
        for (let i = 0; i < 10 && container; i++) {
          for (const child of container.children) {
            if (child.contains(el)) continue;
            const t = (child as HTMLElement).innerText?.trim();
            if (t && t.length >= 2 && t.length <= 600) { labelText = t; break; }
          }
          if (labelText) break;
          const prev = container.previousElementSibling;
          if (prev?.textContent?.trim() && prev.textContent.trim().length >= 2) {
            labelText = prev.textContent.trim();
            break;
          }
          container = container.parentElement;
        }
        if (/^choose file|drag and drop/i.test(labelText)) {
          let walk: Element | null = el.parentElement;
          for (let i = 0; i < 12 && walk; i++) {
            const t = (walk as HTMLElement).innerText?.trim();
            if (t && t.length > 20 && t.length <= 600) {
              const line = t.split('\n').map((s) => s.trim()).find((s) => s.length > 10 && !/choose file|drag and drop/i.test(s));
              if (line) { labelText = line; break; }
            }
            walk = walk.parentElement;
          }
        }

        let fieldType = 'text';
        if (el.tagName === 'TEXTAREA') fieldType = 'textarea';
        else if (el.tagName === 'SELECT') fieldType = 'select';
        else if ((el as HTMLInputElement).type === 'file') fieldType = 'file';
        else if ((el as HTMLInputElement).type === 'email') fieldType = 'email';

        let options: string[] | null = null;
        if (el.tagName === 'SELECT') {
          options = [...(el as HTMLSelectElement).options].map((o) => o.text.trim()).filter(Boolean);
        }

        results.push({
          providerFieldId,
          label: labelText,
          fieldType,
          required: el.required || el.getAttribute('aria-required') === 'true',
          placeholder: (el as HTMLInputElement).placeholder || '',
          options,
        });
      }
      return results;
    });

    const questions = normalizeWorkableFields(raw);
    if (!questions.length) return fail('No Workable form fields found.');
    return { supported: true, loginRequired: false, captcha: false, questions, note: null };
  } catch (err) {
    return fail(`Workable inspect failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await browser?.close().catch(() => {});
  }
}
