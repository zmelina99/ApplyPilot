/** Format a concrete start date for application forms (never hardcode a calendar date). */
export function formatConcreteStartDate(date: Date, placeholder = ''): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  if (/YYYY-MM-DD|YYYY\/MM\/DD/.test(placeholder)) return `${y}-${m}-${d}`;
  if (/DD\/MM\/YYYY|DD\.MM\.YYYY/.test(placeholder)) return `${d}/${m}/${y}`;
  return `${m}/${d}/${y}`;
}

/** Whether a question expects a calendar date rather than the word "Immediate". */
export function expectsConcreteStartDate(label: string, fieldType: string, placeholder = ''): boolean {
  const l = label.toLowerCase();
  if (fieldType === 'date') return true;
  if (/MM\/DD\/YYYY|YYYY-MM-DD|DD\/MM\/YYYY/.test(placeholder)) return true;
  if (/when could you begin|when can you start|begin working with us/.test(l)) return true;
  if (/start date/.test(l) && !/availability/.test(l)) return true;
  return false;
}
