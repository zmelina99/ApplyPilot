import type { ReactNode } from 'react';
import type { ApplicationStatus, EligibilityStatus, FitStatus, Salary } from './types';

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`badge b-${tone}`}><span className="dot" />{children}</span>;
}

const ELIG: Record<string, { tone: string; label: string }> = {
  ELIGIBLE: { tone: 'green', label: 'Eligible' },
  AMBIGUOUS: { tone: 'amber', label: 'Needs review' },
  INELIGIBLE: { tone: 'red', label: 'Rejected' },
  PENDING: { tone: 'gray', label: 'Pending' },
};
export function EligibilityBadge({ status }: { status: EligibilityStatus | null }) {
  const e = ELIG[status ?? 'PENDING'] ?? ELIG['PENDING']!;
  return <Badge tone={e.tone}>{e.label}</Badge>;
}

const FIT_TONE: Record<string, string> = { STRONG: 'green', GOOD: 'blue', BORDERLINE: 'amber', POOR: 'red', MODERATE: 'blue', WEAK: 'amber' };
export function FitBadge({ status, score }: { status: FitStatus | null; score: number | null }) {
  if (score == null || !status || status === 'PENDING') return <span className="muted">Not analyzed</span>;
  return <span><span className="fit-num">{score}</span> <Badge tone={FIT_TONE[status] ?? 'gray'}>{status}</Badge></span>;
}

const APP_TONE: Record<string, string> = {
  APPLIED: 'green', READY_FOR_APPROVAL: 'violet', NEEDS_USER_INPUT: 'amber', MANUAL_REVIEW: 'amber',
  LOGIN_REQUIRED: 'amber', CAPTCHA: 'amber', AUTOMATION_FAILED: 'red', APPLYING: 'blue', QUEUED: 'gray',
};
export function AppStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge tone={APP_TONE[status] ?? 'gray'}>{status.replace(/_/g, ' ')}</Badge>;
}

const UNC_LABEL: Record<string, string> = {
  INTERNATIONAL_HIRING_AMBIGUOUS: 'Intl hiring unclear',
  REMOTE_POLICY_AMBIGUOUS: 'Remote policy unclear',
  LOCATION_AMBIGUOUS: 'Location unclear',
  ROLE_SCOPE_AMBIGUOUS: 'Role scope unclear',
  SALARY_COMPARISON_AMBIGUOUS: 'Salary unclear',
};
export function uncertaintyLabel(code: string): string {
  return UNC_LABEL[code] ?? code.replace(/_/g, ' ').toLowerCase();
}

export function fmtSalary(s: Salary): string {
  if (!s.min && !s.max) return '—';
  const k = (v: string | null) => (v ? `${Math.round(Number(v) / 1000)}k` : '?');
  const cur = s.currency ? `${s.currency} ` : '';
  const range = s.max ? `${k(s.min)}–${k(s.max)}` : k(s.min);
  return `${cur}${range}`;
}

export function fmtWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1d';
  if (days < 30) return `${days}d`;
  return d.toISOString().slice(0, 10);
}
export function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : '—';
}
export function remoteLabel(r: string): string {
  return r === 'UNKNOWN' ? 'Remote?' : r.charAt(0) + r.slice(1).toLowerCase();
}
