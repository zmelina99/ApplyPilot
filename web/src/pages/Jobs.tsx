import { useMemo, useState } from 'react';
import { api } from '../api';
import { useAsync } from '../hooks';
import { PageHeader, Loading, ErrorState, Empty } from '../components';
import { JobTable } from '../JobTable';

const PAGE = 50;

export function Jobs() {
  const [eligibility, setEligibility] = useState('');
  const [fit, setFit] = useState('');
  const [source, setSource] = useState('');
  const [freshness, setFreshness] = useState('');
  const [appStatus, setAppStatus] = useState('');
  const [sort, setSort] = useState('fit');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  const params = useMemo(() => {
    const p: Record<string, string> = { sort, limit: String(PAGE), offset: String(page * PAGE) };
    if (eligibility) p['eligibility'] = eligibility;
    if (fit) p['fit'] = fit;
    if (source) p['source'] = source;
    if (freshness) p['freshness'] = freshness;
    if (appStatus) p['appStatus'] = appStatus;
    if (q.trim()) p['q'] = q.trim();
    return p;
  }, [eligibility, fit, source, freshness, appStatus, sort, q, page]);

  const { data, loading, error } = useAsync(() => api.jobs(params), [params]);
  const sources = useAsync(() => api.sources(), []);

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(0); };

  return (
    <>
      <PageHeader title="Jobs" sub="Real postings from ApplyPilot's sources. Rejected jobs are hidden by default." />
      <div className="content">
        <div className="toolbar">
          <input className="input search" placeholder="Search company or title…" value={q}
                 onChange={(e) => resetPage(setQ)(e.target.value)} aria-label="Search jobs" />
          <select className="select" value={eligibility} onChange={(e) => resetPage(setEligibility)(e.target.value)} aria-label="Eligibility filter">
            <option value="">Eligibility: not rejected</option>
            <option value="ELIGIBLE">Eligible</option>
            <option value="AMBIGUOUS">Needs review</option>
            <option value="INELIGIBLE">Rejected</option>
          </select>
          <select className="select" value={fit} onChange={(e) => resetPage(setFit)(e.target.value)} aria-label="Fit filter">
            <option value="">Fit: any</option>
            <option value="STRONG">Strong</option>
            <option value="GOOD">Good</option>
            <option value="BORDERLINE">Borderline</option>
            <option value="POOR">Poor</option>
            <option value="NOT_ANALYZED">Not analyzed</option>
          </select>
          <select className="select" value={source} onChange={(e) => resetPage(setSource)(e.target.value)} aria-label="Source filter">
            <option value="">Source: all</option>
            {(sources.data ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="select" value={freshness} onChange={(e) => resetPage(setFreshness)(e.target.value)} aria-label="Freshness filter">
            <option value="">Any age</option>
            <option value="72h">≤ 72h</option>
            <option value="14d">≤ 14d</option>
          </select>
          <select className="select" value={appStatus} onChange={(e) => resetPage(setAppStatus)(e.target.value)} aria-label="Application status filter">
            <option value="">App status: any</option>
            {['QUEUED','APPLYING','READY_FOR_APPROVAL','NEEDS_USER_INPUT','MANUAL_REVIEW','APPLIED'].map((s) => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
          </select>
          <div className="spacer" />
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            <option value="fit">Sort: fit score</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="company">Company</option>
          </select>
        </div>

        <section className="panel">
          {loading && <Loading />}
          {error && <ErrorState message={error} />}
          {data && (data.items.length > 0 ? (
            <>
              <JobTable items={data.items} />
              <div className="toolbar" style={{ padding: '10px 12px', margin: 0, borderTop: '1px solid var(--border)' }}>
                <span className="muted">{data.total} job{data.total === 1 ? '' : 's'} · page {page + 1}</span>
                <div className="spacer" />
                <button className="btn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</button>
                <button className="btn" disabled={(page + 1) * PAGE >= data.total} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </>
          ) : (
            <Empty big="No jobs match these filters.">Try clearing filters or running <code>npm run discover</code>.</Empty>
          ))}
        </section>
      </div>
    </>
  );
}
