import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../hooks';
import { PageHeader, Loading, ErrorState, Empty, Panel, Stat } from '../components';
import { JobMiniList } from '../JobTable';
import { AppStatusBadge } from '../ui';

export function Dashboard() {
  const { data, loading, error } = useAsync(() => api.dashboard(), []);
  const nav = useNavigate();

  return (
    <>
      <PageHeader title="Dashboard" sub="Overview of what ApplyPilot has found and what needs your attention." />
      <div className="content grid" style={{ gap: 20 }}>
        {loading && <Loading />}
        {error && <ErrorState message={error} />}
        {data && (
          <>
            {data.counts.jobsDiscovered === 0 ? (
              <Empty big="No jobs discovered yet.">Run <code>npm run discover</code> to fetch jobs, then refresh.</Empty>
            ) : (
              <>
                <div className="grid stat-grid">
                  <Stat k="Jobs discovered" v={data.counts.jobsDiscovered} />
                  <Stat k="Eligible" v={data.counts.eligible} tone="green" />
                  <Stat k="Needs review" v={data.counts.needsReview} tone="amber" />
                  <Stat k="Rejected" v={data.counts.rejected} tone="muted" />
                  <Stat k="Fit analyzed" v={data.counts.fitAnalyzed} />
                  <Stat k="Strong matches" v={data.counts.strongMatches} tone="accent" />
                  <Stat k="Applications" v={data.counts.applicationsTotal} />
                  <Stat k="Ready / needs input" v={(data.counts.appsByStatus['READY_FOR_APPROVAL'] ?? 0) + (data.counts.appsByStatus['NEEDS_USER_INPUT'] ?? 0)} tone="amber" />
                </div>

                <div className="grid cols-2">
                  <Panel title="Best matches" hint={data.counts.fitAnalyzed > 0 ? 'Highest fit scores' : undefined}>
                    {data.bestMatches.length > 0 ? (
                      <JobMiniList items={data.bestMatches} />
                    ) : (
                      <div className="callout">
                        <span className="strong">{data.counts.awaitingAnalysis} jobs are awaiting semantic fit analysis.</span>{' '}
                        {data.meta.llmConfigured
                          ? <>Run <code>npm run analyze</code> to rank them.</>
                          : <>Set <code>ANTHROPIC_API_KEY</code> and run <code>npm run analyze</code> to rank them. Until then, browse by deterministic eligibility.</>}
                      </div>
                    )}
                  </Panel>

                  <Panel title="Needs your attention">
                    {data.needsAttention.reviews.length === 0 && data.needsAttention.applications.length === 0 ? (
                      <Empty big="Nothing needs your attention." />
                    ) : (
                      <div>
                        {data.needsAttention.applications.map((a) => (
                          <div key={a.id} className="attn-row" onClick={() => nav(`/applications/${a.id}`)} style={{ cursor: 'pointer' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="cell-title">{a.title ?? '—'}</div>
                              <div className="cell-sub">{a.company ?? '—'}</div>
                            </div>
                            <AppStatusBadge status={a.status} />
                          </div>
                        ))}
                        {data.needsAttention.reviews.map((r) => (
                          <div key={r.id} className="attn-row" onClick={() => nav('/review')} style={{ cursor: 'pointer' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="cell-title">{r.jobTitle ?? r.reviewType.replace(/_/g, ' ')}</div>
                              <div className="cell-sub">{r.company ?? 'Review needed'}</div>
                            </div>
                            <span className="badge b-violet"><span className="dot" />Review</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Panel>
                </div>

                <Panel title="Recent discoveries" hint="Newest relevant jobs">
                  {data.recentDiscoveries.length > 0 ? <JobMiniList items={data.recentDiscoveries} /> : <Empty big="No recent jobs." />}
                </Panel>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
