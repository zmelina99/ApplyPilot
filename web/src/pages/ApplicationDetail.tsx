import { useEffect, useState } from 'react';
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

function formatAnswer(value: string | null): string {
  if (!value) return '';
  if (value === '[MANUAL_AT_APPLY_TIME]') return 'Manual — attach at apply time';
  const m = value.match(/^\[LOCAL_FILE:(.+)\]$/);
  if (m) return `Local file: ${m[1]}`;
  return value;
}

function TextAnswerEditor({ appId, q, onSaved }: { appId: string; q: PreparedQuestionView; onSaved: (d: AppDetail) => void }) {
  const editable = q.answer.status === 'NEEDS_INPUT' || q.answer.status === 'NEEDS_GENERATION' || q.answer.source === 'USER';
  const [val, setVal] = useState(q.answer.value ?? '');
  const [reusable, setReusable] = useState(false);
  const [busy, setBusy] = useState(false);
  const multiline = q.fieldType === 'textarea';

  useEffect(() => { setVal(q.answer.value ?? ''); }, [q.answer.value, q.questionId]);

  async function save() {
    if (!val.trim()) return;
    setBusy(true);
    try { onSaved(await api.answer(appId, { questionId: q.questionId, value: val.trim(), reusable })); }
    finally { setBusy(false); }
  }

  if (!editable) return null;

  return (
    <div style={{ marginTop: 8 }}>
      {q.answer.status === 'NEEDS_GENERATION' && (
        <div className="cell-sub" style={{ marginBottom: 6 }}>Write your own answer below (no auto-generation in this phase).</div>
      )}
      {multiline ? (
        <textarea
          className="input search"
          rows={6}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="Your answer…"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          aria-label={`Answer for ${q.label}`}
        />
      ) : (
        <input className="input search" placeholder="Your answer…" value={val} onChange={(e) => setVal(e.target.value)} aria-label={`Answer for ${q.label}`} />
      )}
      <div className="toolbar" style={{ marginTop: 8, marginBottom: 0 }}>
        {!multiline && (
          <label className="cell-sub" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={reusable} onChange={(e) => setReusable(e.target.checked)} /> Save as reusable approved answer
          </label>
        )}
        <div className="spacer" />
        <button className="btn primary" disabled={busy || !val.trim()} onClick={save}>Save answer</button>
      </div>
    </div>
  );
}

function FileAnswerEditor({ appId, q, localFiles, onSaved }: {
  appId: string; q: PreparedQuestionView; localFiles: string[]; onSaved: (d: AppDetail) => void;
}) {
  const editable = q.answer.status === 'NEEDS_INPUT' || q.answer.source === 'USER';
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const m = q.answer.value?.match(/^\[LOCAL_FILE:(.+)\]$/);
    setSelected(m?.[1] ?? '');
  }, [q.answer.value, q.questionId]);

  if (!editable) return null;

  async function saveFile() {
    if (!selected) return;
    setBusy(true);
    try { onSaved(await api.answer(appId, { questionId: q.questionId, localFile: selected })); }
    finally { setBusy(false); }
  }

  async function markManual() {
    setBusy(true);
    try { onSaved(await api.answer(appId, { questionId: q.questionId, manual: true })); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div className="cell-sub" style={{ marginBottom: 6 }}>
        Workable marks this upload required despite the optional wording. Pick an approved local file from <code>resumes/</code>, or mark it for manual handling when you apply.
      </div>
      <div className="toolbar" style={{ marginBottom: 0, flexWrap: 'wrap', gap: 8 }}>
        <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)} aria-label={`Local file for ${q.label}`}>
          <option value="">Select local file…</option>
          {localFiles.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <button className="btn primary" disabled={busy || !selected} onClick={saveFile}>Use local file</button>
        <button className="btn" disabled={busy} onClick={markManual}>Handle manually at apply time</button>
      </div>
      {localFiles.length === 0 && (
        <div className="cell-sub" style={{ marginTop: 6 }}>No files found in resumes/. Add one locally and refresh.</div>
      )}
    </div>
  );
}

function QuestionRow({ appId, q, localFiles, onSaved }: {
  appId: string; q: PreparedQuestionView; localFiles: string[]; onSaved: (d: AppDetail) => void;
}) {
  const isFile = q.fieldType === 'file' && q.providerFieldId !== 'resume';

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <div className="cell-title">{q.label} {q.required ? <span className="muted" style={{ fontWeight: 400 }}>· required</span> : <span className="muted" style={{ fontWeight: 400 }}>· optional</span>}</div>
          <div className="cell-sub">{q.category} · {q.fieldType}{q.sourceKind === 'STANDARD' ? ' · standard' : ''}{q.providerFieldId ? ` · ${q.providerFieldId}` : ''}</div>
        </div>
        <Badge tone={ANSWER_TONE[q.answer.status] ?? 'gray'}>{ANSWER_LABEL[q.answer.status] ?? q.answer.status}</Badge>
      </div>
      {q.answer.value != null && (
        <div style={{ marginTop: 6, fontSize: 13.5 }}>
          <span className="muted">{q.answer.source === 'USER' ? 'Your answer: ' : 'Proposed: '}</span>
          {isFile || q.answer.value.startsWith('[LOCAL_FILE:') || q.answer.value === '[MANUAL_AT_APPLY_TIME]'
            ? formatAnswer(q.answer.value)
            : q.answer.value.length > 500 ? `${q.answer.value.slice(0, 500)}…` : q.answer.value}
          <span className="cell-sub"> · {q.answer.source.toLowerCase()}</span>
          {q.answer.approved && <span className="badge b-green" style={{ marginLeft: 6 }}><span className="dot" />approved</span>}
        </div>
      )}
      {isFile
        ? <FileAnswerEditor appId={appId} q={q} localFiles={localFiles} onSaved={onSaved} />
        : <TextAnswerEditor appId={appId} q={q} onSaved={onSaved} />}
    </div>
  );
}

export function ApplicationDetail() {
  const { id } = useParams();
  const { data: initial, loading, error } = useAsync(() => api.application(id!), [id]);
  const { data: filesData } = useAsync(() => api.localFiles(), []);
  const [override, setOverride] = useState<AppDetail | null>(null);
  const [approving, setApproving] = useState(false);
  const app = override ?? initial;
  const localFiles = filesData?.files ?? [];

  if (loading && !app) return <div className="content"><Loading /></div>;
  if (error) return <div className="content"><ErrorState message={error} /></div>;
  if (!app) return null;

  const required = app.questions.filter((q) => q.required);
  const requiredReady = required.filter((q) => q.answer.status === 'READY').length;
  const needsGen = app.questions.filter((q) => q.answer.status === 'NEEDS_GENERATION').length;
  const needsInput = app.questions.filter((q) => q.answer.status === 'NEEDS_INPUT').length;

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
                app.questions.map((q) => <QuestionRow key={q.questionId} appId={app.id} q={q} localFiles={localFiles} onSaved={setOverride} />)}
            </div>
          </Panel>

          <Panel title="Application history" hint="append-only event log">
            <div style={{ padding: '14px 16px' }}>
              <div className="timeline">
                {app.events.map((e) => (
                  <div className="tl-item" key={e.id}>
                    <div className="tl-type">{e.eventType.replace(/_/g, ' ')}{e.fromStatus || e.toStatus ? ` · ${e.fromStatus ?? '·'} → ${e.toStatus ?? '·'}` : ''}</div>
                    <div className="tl-meta">{fmtWhen(e.createdAt)}</div>
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
              {needsInput > 0 && <div className="kv"><span className="k">Needs your input</span><span className="num">{needsInput}</span></div>}
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
