import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../hooks';
import { PageHeader, Loading, ErrorState, Empty, Panel } from '../components';
import { Badge } from '../ui';

export function Review() {
  const { data, loading, error, reload } = useAsync(() => api.reviews(), []);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, kind: 'resolve' | 'reject') {
    setBusy(id);
    try {
      if (kind === 'resolve') await api.resolveReview(id, notes[id]);
      else await api.rejectReview(id, notes[id]);
      reload();
    } finally { setBusy(null); }
  }

  return (
    <>
      <PageHeader title="Review" sub="Items that genuinely need a human decision before ApplyPilot can continue." />
      <div className="content grid" style={{ gap: 16 }}>
        <div className="callout">
          <span className="strong">Blocking reviews</span> require your decision. Non-blocking geographic/hiring{' '}
          <span className="strong">uncertainties</span> are not shown here — they live on each job’s detail page and never stop a job from being considered.
        </div>

        {loading && <Loading />}
        {error && <ErrorState message={error} />}
        {data && (data.length === 0 ? (
          <section className="panel"><Empty big="Nothing needs your attention.">No blocking reviews right now.</Empty></section>
        ) : (
          data.map((r) => (
            <Panel key={r.id} title={r.reviewType.replace(/_/g, ' ')} hint={<Badge tone="violet">Blocking</Badge>}>
              <div style={{ padding: '12px 14px' }}>
                {r.jobId && <div className="cell-title">{r.jobTitle ?? 'Job'} <span className="cell-sub">· {r.company ?? ''}</span></div>}
                {r.reason && <p style={{ color: 'var(--text-2)', fontSize: 13.5, margin: '8px 0' }}>{r.reason}</p>}
                {r.jobId && <Link className="ext" to={`/jobs/${r.jobId}`}>View job →</Link>}
                <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
                  <input className="input search" placeholder="Optional note…" value={notes[r.id] ?? ''}
                         onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} aria-label="Review note" />
                  <div className="spacer" />
                  <button className="btn primary" disabled={busy === r.id} onClick={() => act(r.id, 'resolve')}>Resolve</button>
                  <button className="btn danger" disabled={busy === r.id} onClick={() => act(r.id, 'reject')}>Reject</button>
                </div>
              </div>
            </Panel>
          ))
        ))}
      </div>
    </>
  );
}
