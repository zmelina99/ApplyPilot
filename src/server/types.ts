/**
 * API response shapes for the web UI. These mirror the backend enums/state machine —
 * the UI renders the actual status strings from the database rather than redefining
 * divergent versions.
 */
import type { ApplicationStatus } from '../domain/applicationStateMachine.js';

export type EligibilityStatus = 'PENDING' | 'ELIGIBLE' | 'INELIGIBLE' | 'AMBIGUOUS';
export type FitStatus = 'PENDING' | 'STRONG' | 'GOOD' | 'BORDERLINE' | 'POOR' | 'MODERATE' | 'WEAK';

export interface JobListItem {
  id: string;
  company: string | null;
  title: string | null;
  location: string | null;
  remoteType: string;
  salary: { min: string | null; max: string | null; currency: string | null; period: string | null };
  datePosted: string | null;
  firstDiscoveredAt: string | null;
  sources: string[];
  eligibilityStatus: EligibilityStatus | null;
  eligibilityReason: string | null;
  fitScore: number | null;
  fitStatus: FitStatus | null;
  priority: boolean;
  uncertainties: string[];
  applicationStatus: ApplicationStatus | null;
}

export interface FitComponentView { score: number; reasoning: string }
export interface JobFit {
  score: number;
  status: FitStatus;
  confidence: string;
  summary: string;
  components: {
    role_alignment: FitComponentView;
    technical_match: FitComponentView;
    experience_match: FitComponentView;
    responsibility_match: FitComponentView;
  };
  matching_requirements: string[];
  missing_requirements: string[];
  preferred_skill_gaps: string[];
  hard_requirement_concerns: string[];
  uncertainties: string[];
  model: string | null;
  analyzedAt: string | null;
}

export interface JobDetail {
  id: string;
  company: string | null;
  title: string | null;
  location: string | null;
  remoteType: string;
  employmentType: string | null;
  salary: JobListItem['salary'];
  datePosted: string | null;
  firstDiscoveredAt: string | null;
  lastSeenAt: string | null;
  canonicalUrl: string;
  descriptionText: string;
  sources: { sourceName: string; sourceJobId: string | null; sourceUrl: string; discoveredAt: string | null }[];
  eligibility: { status: EligibilityStatus | null; reason: string | null; reasons: { code: string; kind: string; message: string }[] };
  fit: JobFit | null;
  applicationStatus: ApplicationStatus | null;
  applicationId: string | null;
}

export interface AppListItem {
  id: string;
  jobId: string;
  company: string | null;
  title: string | null;
  status: ApplicationStatus;
  fitScore: number | null;
  fitStatus: FitStatus | null;
  swiss: boolean;
  needsAttention: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppEventView {
  id: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface AppDetail {
  id: string;
  jobId: string;
  company: string | null;
  title: string | null;
  status: ApplicationStatus;
  attemptCount: number;
  requiresUserInput: boolean;
  userInputReason: string | null;
  failureCategory: string | null;
  failureDetails: string | null;
  currentStep: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  canonicalUrl: string;
  fit: { score: number | null; status: FitStatus | null };
  events: AppEventView[];
}

export interface ReviewView {
  id: string;
  reviewType: string;
  status: string;
  reason: string | null;
  jobId: string | null;
  jobTitle: string | null;
  company: string | null;
  applicationId: string | null;
  createdAt: string;
  note: string | null;
}

export interface DashboardData {
  counts: {
    jobsDiscovered: number;
    eligible: number;
    needsReview: number;
    rejected: number;
    fitAnalyzed: number;
    strongMatches: number;
    awaitingAnalysis: number;
    applicationsTotal: number;
    appsByStatus: Record<string, number>;
  };
  bestMatches: JobListItem[];
  recentDiscoveries: JobListItem[];
  needsAttention: { reviews: ReviewView[]; applications: AppListItem[] };
  meta: { llmConfigured: boolean; hasUser: boolean };
}
