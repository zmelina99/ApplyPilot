// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { DashboardData, JobDetail as JobDetailT, AppListItem } from './types';

vi.mock('./api', () => ({
  api: {
    dashboard: vi.fn(), job: vi.fn(), jobs: vi.fn(), sources: vi.fn(),
    applications: vi.fn(), application: vi.fn(), reviews: vi.fn(),
  },
}));
import { api } from './api';
import { Dashboard } from './pages/Dashboard';
import { JobDetail } from './pages/JobDetail';
import { Applications } from './pages/Applications';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function dash(over: Partial<DashboardData['counts']> = {}): DashboardData {
  return {
    counts: { jobsDiscovered: 219, eligible: 17, needsReview: 71, rejected: 131, fitAnalyzed: 0, strongMatches: 0, awaitingAnalysis: 88, applicationsTotal: 0, appsByStatus: {}, ...over },
    bestMatches: [], recentDiscoveries: [], needsAttention: { reviews: [], applications: [] },
    meta: { llmConfigured: false, hasUser: true },
  };
}

beforeEach(() => vi.clearAllMocks());

describe('Dashboard', () => {
  it('renders real aggregate counts from the API', async () => {
    mockApi['dashboard']!.mockResolvedValue(dash());
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(await screen.findByText('219')).toBeInTheDocument();
    expect(screen.getByText('Jobs discovered')).toBeInTheDocument();
    expect(screen.getByText('Eligible')).toBeInTheDocument();
  });

  it('shows the awaiting-analysis message instead of fake scores when nothing is analyzed', async () => {
    mockApi['dashboard']!.mockResolvedValue(dash());
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(await screen.findByText(/88 jobs are awaiting semantic fit analysis/i)).toBeInTheDocument();
  });
});

describe('JobDetail', () => {
  const baseJob: JobDetailT = {
    id: 'j1', company: 'Canonical', title: 'Web Frontend Engineer', location: 'Anywhere',
    remoteType: 'REMOTE', employmentType: 'PERMANENT',
    salary: { min: null, max: null, currency: null, period: null },
    datePosted: new Date().toISOString(), firstDiscoveredAt: null, lastSeenAt: null,
    canonicalUrl: 'https://example.com/job', descriptionText: 'Build UIs with React.',
    sources: [{ sourceName: 'jobicy', sourceJobId: '1', sourceUrl: 'https://jobicy/1', discoveredAt: null }],
    eligibility: { status: 'ELIGIBLE', reason: 'Passes all deterministic hard constraints.', reasons: [] },
    fit: null, applicationStatus: null, applicationId: null,
  };

  function renderJob(job: JobDetailT) {
    mockApi['job']!.mockResolvedValue(job);
    render(
      <MemoryRouter initialEntries={['/jobs/j1']}>
        <Routes><Route path="/jobs/:id" element={<JobDetail />} /></Routes>
      </MemoryRouter>,
    );
  }

  it('separates eligibility from fit and shows no fake score when unanalyzed', async () => {
    renderJob(baseJob);
    expect(await screen.findByText('Web Frontend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
    expect(screen.getByText('Not analyzed.')).toBeInTheDocument();
    // No invented fit score: the fit-score hero element is absent entirely.
    expect(document.querySelector('.fit-score')).toBeNull();
  });

  it('shows the fit breakdown when analyzed', async () => {
    renderJob({
      ...baseJob,
      fit: {
        score: 91, status: 'STRONG', confidence: 'HIGH', summary: 'Strong frontend match.',
        components: {
          role_alignment: { score: 92, reasoning: 'Frontend responsibilities.' },
          technical_match: { score: 90, reasoning: 'React/TS.' },
          experience_match: { score: 88, reasoning: '4+ years.' },
          responsibility_match: { score: 94, reasoning: 'UI ownership.' },
        },
        matching_requirements: ['React', 'TypeScript'], missing_requirements: [],
        preferred_skill_gaps: ['GraphQL'], hard_requirement_concerns: [], uncertainties: ['Intl hiring unclear'],
        model: 'claude-opus-5', analyzedAt: new Date().toISOString(),
      },
    });
    expect(await screen.findByText('Strong frontend match.')).toBeInTheDocument();
    expect(document.querySelector('.fit-score')?.textContent).toBe('91');
    expect(screen.getByText('Why it matches')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
  });
});

describe('Applications', () => {
  it('shows an empty state when there are no applications', async () => {
    mockApi['applications']!.mockResolvedValue([] as AppListItem[]);
    render(<MemoryRouter><Applications /></MemoryRouter>);
    expect(await screen.findByText(/Applications you prepare will appear here/i)).toBeInTheDocument();
  });
});
