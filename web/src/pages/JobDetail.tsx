import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../hooks';
import { Loading, ErrorState, Panel } from '../components';
import { AppStatusBadge, Badge, EligibilityBadge, FitBadge, fmtDate, fmtSalary, remoteLabel, uncertaintyLabel } from '../ui';
import type { JobFit } from '../types';

function Component({ label, c }: { label: string; c: { score: number; reasoning: string } }) {
  return (
    <div className="comp">
      <div className="comp-top"><span>{label}</span><span className="num">{c.score}</span></div>
      <div className="bar"><span style={{ width: `${c.score}%` }} /></div>
      <div className="comp-reason">{c.reasoning}</div>
    </div>
  );
}

function FitPanel({ fit }: { fit: JobFit }) {
  return (
    <Panel title="Fit" hint={fit.model ? `${fit.model} · ${fmtDate(fit.analyzedAt)}` : undefined}>
      <div style={{ padding: '10px 12px' }}>
        <div className="fit-hero">
          <div className="fit-score">{fit.score}</div>
          <div>
            <FitBadge status={fit.status} score={fit.score} />
            <div className="cell-sub" style={{ marginTop: 4 }}>Confidence: {fit.confidence}</div>
          </div>
        </div>
        <div className="components" style={{ marginTop: 16 }}>
          <Component label="Role alignment" c={fit.components.role_alignment} />
          <Component label="Technical match" c={fit.components.technical_match} />
          <Component label="Experience / seniority" c={fit.components.experience_match} />
          <Component label="Responsibility alignment" c={fit.components.responsibility_match} />
        </div>
        <div className="section" style={{ marginTop: 16 }}>
          <div className="lbl">Summary</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-2)' }}>{fit.summary}</div>
        </div>
      </div>
    </Panel>
  );
}

function Lines({ items, mk, cls }: { items: string[]; mk: string; cls: string }) {
  return <>{items.map((t, i) => <div className="list-line" key={i}><span className={`mk ${cls}`}>{mk}</span><span>{t}</span></div>)}</>;
}

export function JobDetail() {
  const { id } = useParams();
  const { data: job, loading, error } = useAsync(() => api.job(id!), [id]);

  if (loading) return <div className="content"><Loading /></div>;
  if (error) return <div className="content"><ErrorState message={error} /></div>;
  if (!job) return null;
  const fit = job.fit;

  return (
    <div className="content" style={{ paddingTop: 24 }}>
      <Link to="/jobs" className="ext" style={{ fontSize: 13 }}>← Jobs</Link>
      <div className="detail-head" style={{ marginTop: 12 }}>
        <div>
          <h1>{job.title ?? '—'}</h1>
          <div className="meta">
            <strong>{job.company ?? '—'}</strong>
            <span>· {job.location ?? '—'}</span>
            <Badge tone="gray">{remoteLabel(job.remoteType)}</Badge>
            {job.employmentType && <Badge tone="gray">{job.employmentType}</Badge>}
            <span>· Posted {fmtDate(job.datePosted)}</span>
            <span>· {fmtSalary(job.salary)}</span>
            {job.sources.map((s) => <Badge key={s.sourceName} tone="gray">{s.sourceName}</Badge>)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <a className="btn" href={job.canonicalUrl} target="_blank" rel="noreferrer">Open job posting ↗</a>
          <button className="btn" disabled title="Coming in Phase 2D">Prepare application</button>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          {fit ? <FitPanel fit={fit} /> : (
            <Panel title="Fit">
              <div className="callout" style={{ margin: 8 }}>
                <span className="strong">Not analyzed.</span> Fit analysis hasn’t been run for this job yet.
                Run <code>npm run analyze</code> (needs <code>ANTHROPIC_API_KEY</code>) to score it.
              </div>
            </Panel>
          )}

          {fit && (
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
              <Panel title="Why it matches">
                <div style={{ padding: '8px 12px' }}>
                  {fit.matching_requirements.length ? <Lines items={fit.matching_requirements} mk="✓" cls="mk-ok" /> : <span className="muted">No specific matches listed.</span>}
                </div>
              </Panel>
              <Panel title="Gaps">
                <div style={{ padding: '8px 12px' }}>
                  {fit.missing_requirements.length === 0 && fit.preferred_skill_gaps.length === 0 && <span className="muted">None.</span>}
                  <Lines items={fit.missing_requirements.map((g) => `${g} (required)`)} mk="✗" cls="mk-req" />
                  <Lines items={fit.preferred_skill_gaps.map((g) => `${g} (preferred)`)} mk="△" cls="mk-gap" />
                </div>
              </Panel>
              <Panel title="Concerns">
                <div style={{ padding: '8px 12px' }}>
                  {fit.hard_requirement_concerns.length ? <Lines items={fit.hard_requirement_concerns} mk="!" cls="mk-con" /> : <span className="muted">None.</span>}
                </div>
              </Panel>
              <Panel title="Uncertainties" hint="Not a rejection">
                <div style={{ padding: '8px 12px' }}>
                  {fit.uncertainties.length ? <Lines items={fit.uncertainties} mk="?" cls="mk-unc" /> : <span className="muted">None.</span>}
                </div>
              </Panel>
            </div>
          )}

          <Panel title="Job description">
            <div className="desc" style={{ padding: '10px 14px' }}>{job.descriptionText || 'No description captured.'}</div>
          </Panel>
        </div>

        <div>
          <Panel title="Eligibility" hint="Deterministic · separate from fit">
            <div style={{ padding: '10px 12px' }}>
              <EligibilityBadge status={job.eligibility.status} />
              <p className="cell-sub" style={{ marginTop: 8 }}>Whether there’s a clear reason not to apply — independent of how well you fit.</p>
              {job.eligibility.reasons.length > 0 ? (
                <div style={{ marginTop: 6 }}>
                  {job.eligibility.reasons.map((r, i) => (
                    <div className="list-line" key={i}>
                      <span className={`mk ${r.kind === 'hard' ? 'mk-req' : 'mk-unc'}`}>{r.kind === 'hard' ? '✗' : '?'}</span>
                      <span>{r.message}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="cell-sub" style={{ marginTop: 6 }}>Passes all deterministic hard constraints.</p>}
              {job.eligibility.status === 'AMBIGUOUS' && (
                <div className="callout" style={{ marginTop: 10 }}>Geographic/hiring uncertainty is recorded here, not treated as a rejection.</div>
              )}
            </div>
          </Panel>

          <Panel title="Application">
            <div style={{ padding: '10px 12px' }}>
              {job.applicationStatus
                ? <Link to={`/applications/${job.applicationId}`}><AppStatusBadge status={job.applicationStatus} /></Link>
                : <span className="muted">No application yet.</span>}
              <div style={{ marginTop: 10 }}>
                <button className="btn" disabled title="Coming in Phase 2D">Prepare application — Phase 2D</button>
              </div>
            </div>
          </Panel>

          <Panel title="Sources">
            <div style={{ padding: '10px 12px' }}>
              {job.sources.map((s) => (
                <div key={s.sourceUrl} className="kv">
                  <span className="k">{s.sourceName}</span>
                  <a className="ext" href={s.sourceUrl} target="_blank" rel="noreferrer">{s.sourceJobId ?? 'link'} ↗</a>
                </div>
              ))}
              <div className="kv"><span className="k">Canonical</span><a className="ext" href={job.canonicalUrl} target="_blank" rel="noreferrer">open ↗</a></div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
