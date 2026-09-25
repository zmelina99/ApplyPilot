import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../hooks';
import { Loading, ErrorState, Panel, Empty } from '../components';
import { AppStatusBadge, Badge, FitBadge, fmtWhen } from '../ui';
import type { AppDetail, PreparedQuestionView } from '../types';

const ANSWER_TONE: Record<string, string> = {
  READY: 'green', NEEDS_INPUT: 'amber', NEEDS_GENERATION: 'violet', OPTIONAL_BLANK: 'gray', UNSUPPORTED: 'red',
};
const ANSWER_LABEL: Record<string, string> = {
  READY: 'Ready', NEEDS_INPUT: 'Needs input', NEEDS_GENERATION: 'Needs generation', OPTIONAL_BLANK: 'Optional — blank', UNSUPPORTED: 'Unsupported',
};

function QuestionRow({ appId, q, onSaved }: { appId: string; q: PreparedQuestionView; onSaved: (d: AppDetail) => void }) {
  const editable = q.answer.status === 'NEEDS_INPUT' || q.answer.status === 'NEEDS_GENERATION';
  const [val, setVal] = useState('');
  const [reusable, setReusable] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!val.trim()) return;
    setBusy(true);
    try { onSaved(await api.answer(appId, q.questionId, val.trim(), reusable)); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <div className="cell-title">{q.label} {q.required ? <span className="muted" style={{ fontWeight: 400 }}>· required</span> : <span className="muted" style={{ fontWeight: 400 }}>· optional</span>}</div>
          <div className="cell-sub">{q.category} · {q.fieldType}{q.sourceKind === 'STANDARD' ? ' · standard' : ''}</div>
        </div>
        <Badge tone={ANSWER_TONE[q.answer.status] ?? 'gray'}>{ANSWER_LABEL[q.answer.status] ?? q.answer.status}</Badge>
      </div>
      {q.answer.value != null && (
        <div style={{ marginTop: 6, fontSize: 13.5 }}>
          <span className="muted">Proposed: </span>{q.answer.value}
          <span className="cell-sub"> · {q.answer.source.toLowerCase()}</span>
          {q.answer.approved && <span className="badge b-green" style={{ marginLeft: 6 }}><span className="dot" />approved</span>}
        </div>
      )}
      {q.answer.status === 'NEEDS_GENERATION' && (
        <div className="cell-sub" style={{ marginTop: 4 }}>Free-text — no answer is generated without an LLM key. Write your own below.</div>
      )}
      {editable && (
        <div className="toolbar" style={{ marginTop: 8, marginBottom: 0 }}>
          <input className="input search" placeholder="Your answer…" value={val} onChange={(e) => setVal(e.target.value)} aria-label={`Answer for ${q.label}`} />
          <label className="cell-sub" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={reusable} onChange={(e) => setReusable(e.target.checked)} /> Save as reusable approved answer
          </label>
          <div className="spacer" />
          <button className="btn primary" disabled={busy || !val.trim()} onClick={save}>Save</button>
        </div>
      )}
    </div>
  );
}

export function ApplicationDetail() {
  const { id } = useParams();
  const { data: initial, loading, error } = useAsync(() => api.application(id!), [id]);
  const [override, setOverride] = useState<AppDetail | null>(null);
  const [approving, setApproving] = useState(false);
  const app = override ?? initial;

  if (loading && !app) return <div className="content"><Loading /></div>;
  if (error) return <div className="content"><ErrorState message={error} /></div>;
  if (!app) return null;

  const required = app.questions.filter((q) => q.required);
  const requiredReady = required.filter((q) => q.answer.status === 'READY').length;
  const needsGen = app.questions.filter((q) => q.answer.status === 'NEEDS_GENERATION').length;

  async function approve() {
    setApproving(true);
    try { setOverride(await api.approve(app!.id)); } finally { setApproving(false); }
  }

  return (
    <div className="content" style={{ paddingTop: 24 }}>
      <Link to="/applications" className="ext" style={{ fontSize: 13 }}>← Applications</Link>
      <div className="detail-head" style={{ marginTop: 12 }}>
        <div>
          <h1>{app.title ?? '—'}</h1>
          <div className="meta">
            <strong>{app.company ?? '—'}</strong> · <AppStatusBadge status={app.status} /> · <FitBadge status={app.fit.status} score={app.fit.score} />
            {app.provider && <Badge tone="gray">{app.provider}</Badge>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {app.applyUrl && <a className="btn" href={app.applyUrl} target="_blank" rel="noreferrer">Open application ↗</a>}
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <Panel title="Questions & Answers" hint={app.formUnderstood ? `${app.provider} form` : 'Standard answers (form not auto-inspected)'}>
            <div style={{ padding: '4px 14px 12px' }}>
              {app.questions.length === 0 ? <Empty big="No questions prepared." /> :
                app.questions.map((q) => <QuestionRow key={q.questionId} appId={app.id} q={q} onSaved={setOverride} />)}
            </div>
          </Panel>

          <Panel title="Application history" hint="append-only event log">
            <div style={{ padding: '14px 16px' }}>
              <div className="timeline">
                {app.events.map((e) => (
                  <div className="tl-item" key={e.id}>
                    <div className="tl-type">{e.eventType.replace(/_/g, ' ')}{e.fromStatus || e.toStatus ? ` · ${e.fromStatus ?? '·'} → ${e.toStatus ?? '·'}` : ''}</div>
                    <div className="tl-meta">{new Date(e.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        <div>
          <Panel title="Preparation">
            <div style={{ padding: '10px 12px' }}>
              <div className="kv"><span className="k">Status</span><AppStatusBadge status={app.status} /></div>
              <div className="kv"><span className="k">Provider</span><span>{app.provider ?? '—'}{app.formUnderstood ? ' (auto-inspected)' : ' (manual)'}</span></div>
              <div className="kv"><span className="k">Resume</span>{app.resumeStatus === 'READY' ? <span className="badge b-green"><span className="dot" />Ready</span> : <span className="badge b-amber"><span className="dot" />Missing / select</span>}</div>
              <div className="kv"><span className="k">Required answered</span><span className="num">{requiredReady} / {required.length}</span></div>
              {needsGen > 0 && <div className="kv"><span className="k">Free-text to write</span><span className="num">{needsGen}</span></div>}
              {app.preparationNote && <div className="cell-sub" style={{ marginTop: 8 }}>{app.preparationNote}</div>}
              {app.applyUrl && <div className="cell-sub" style={{ marginTop: 8, wordBreak: 'break-all' }}>Apply at: <a className="ext" href={app.applyUrl} target="_blank" rel="noreferrer">{app.applyUrl}</a></div>}
            </div>
          </Panel>

          <Panel title="Approve">
            <div style={{ padding: '10px 12px' }}>
              <p className="cell-sub" style={{ marginBottom: 10 }}>
                Approving marks this prepared application as reviewed. <strong>It does not submit anything</strong> — no data is sent to the employer in this phase.
              </p>
              <button className="btn primary" disabled={app.status !== 'READY_FOR_APPROVAL' || approving} onClick={approve}>
                {app.status === 'READY_FOR_APPROVAL' ? 'Approve preparation' : 'Not ready to approve'}
              </button>
            </div>
          </Panel>

          <Panel title="Job">
            <div style={{ padding: '12px 14px' }}>
              <Link to={`/jobs/${app.jobId}`} className="ext">View job in ApplyPilot →</Link>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
