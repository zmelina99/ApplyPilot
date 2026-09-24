import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../hooks';
import { Loading, ErrorState, Panel, Empty } from '../components';
import { AppStatusBadge, FitBadge, fmtWhen } from '../ui';

const ACTION = ['READY_FOR_APPROVAL', 'NEEDS_USER_INPUT', 'MANUAL_REVIEW', 'LOGIN_REQUIRED', 'CAPTCHA', 'AUTOMATION_FAILED'];

export function ApplicationDetail() {
  const { id } = useParams();
  const { data: app, loading, error } = useAsync(() => api.application(id!), [id]);

  if (loading) return <div className="content"><Loading /></div>;
  if (error) return <div className="content"><ErrorState message={error} /></div>;
  if (!app) return null;
  const needsAttention = ACTION.includes(app.status);

  return (
    <div className="content" style={{ paddingTop: 24 }}>
      <Link to="/applications" className="ext" style={{ fontSize: 13 }}>← Applications</Link>
      <div className="detail-head" style={{ marginTop: 12 }}>
        <div>
          <h1>{app.title ?? '—'}</h1>
          <div className="meta"><strong>{app.company ?? '—'}</strong> · <AppStatusBadge status={app.status} /> · <FitBadge status={app.fit.status} score={app.fit.score} /></div>
        </div>
        <a className="btn" href={app.canonicalUrl} target="_blank" rel="noreferrer">Open job posting ↗</a>
      </div>

      <div className="detail-grid">
        <div>
          <Panel title="Current status">
            <div style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><AppStatusBadge status={app.status} /><span className="cell-sub">attempt {app.attemptCount}</span></div>
              {needsAttention && (
                <div className="callout" style={{ marginTop: 12 }}>
                  <span className="strong">Needs your attention.</span>{' '}
                  {app.userInputReason || app.failureDetails || (app.status === 'READY_FOR_APPROVAL' ? 'Prepared and waiting for your approval before submission.' : `Waiting: ${app.status.replace(/_/g, ' ').toLowerCase()}.`)}
                </div>
              )}
              {app.currentStep && <div className="kv" style={{ marginTop: 10 }}><span className="k">Current step</span><span>{app.currentStep}</span></div>}
              {app.failureCategory && <div className="kv"><span className="k">Failure</span><span>{app.failureCategory}: {app.failureDetails}</span></div>}
              {app.submittedAt && <div className="kv"><span className="k">Submitted</span><span>{fmtWhen(app.submittedAt)}</span></div>}
            </div>
          </Panel>

          <Panel title="Application history" hint="append-only event log">
            <div style={{ padding: '14px 16px' }}>
              {app.events.length === 0 ? <Empty big="No events yet." /> : (
                <div className="timeline">
                  {app.events.map((e) => (
                    <div className="tl-item" key={e.id}>
                      <div className="tl-type">{e.eventType.replace(/_/g, ' ')}{e.fromStatus || e.toStatus ? ` · ${e.fromStatus ?? '·'} → ${e.toStatus ?? '·'}` : ''}</div>
                      <div className="tl-meta">{new Date(e.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div>
          <Panel title="Job">
            <div style={{ padding: '12px 14px' }}>
              <Link to={`/jobs/${app.jobId}`} className="ext">View job in ApplyPilot →</Link>
            </div>
          </Panel>

          <Panel title="Application materials" hint="Phase 2D">
            <div style={{ padding: '12px 14px' }}>
              <p className="cell-sub" style={{ marginBottom: 10 }}>These will be prepared here — grounded only in verified facts — in Phase 2D. Nothing is generated yet.</p>
              {['Resume', 'Form answers', 'Generated free-text responses', 'Cover letter', 'Unresolved questions'].map((label) => (
                <div key={label} className="kv"><span className="k">{label}</span><span className="muted">Not prepared yet</span></div>
              ))}
              <button className="btn" disabled title="Coming in Phase 2D" style={{ marginTop: 10 }}>Prepare application — Phase 2D</button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
