import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../hooks';
import { PageHeader, Loading, ErrorState, Empty } from '../components';
import { AppStatusBadge, Badge, FitBadge, fmtWhen } from '../ui';

const ACTION = ['READY_FOR_APPROVAL', 'NEEDS_USER_INPUT', 'MANUAL_REVIEW', 'LOGIN_REQUIRED', 'CAPTCHA', 'AUTOMATION_FAILED'];

export function Applications() {
  const { data, loading, error } = useAsync(() => api.applications(), []);
  const [tab, setTab] = useState<'action' | 'all' | 'applied' | 'queued'>('action');
  const nav = useNavigate();

  const groups = useMemo(() => {
    const all = data ?? [];
    return {
      action: all.filter((a) => ACTION.includes(a.status)),
      queued: all.filter((a) => a.status === 'QUEUED' || a.status === 'APPLYING'),
      applied: all.filter((a) => a.status === 'APPLIED'),
      all,
    };
  }, [data]);

  const rows = groups[tab];

  return (
    <>
      <PageHeader title="Applications" sub="Applications requiring action are shown first. This becomes the main workspace in Phase 2D." />
      <div className="content">
        {loading && <Loading />}
        {error && <ErrorState message={error} />}
        {data && (data.length === 0 ? (
          <section className="panel"><Empty big="Applications you prepare will appear here.">
            ApplyPilot hasn’t created any applications yet — that begins in Phase 2D. For now, explore the ranked <a className="ext" href="/jobs">Jobs</a>.
          </Empty></section>
        ) : (
          <>
            <div className="tabs">
              {([['action', 'Needs action'], ['queued', 'In progress'], ['applied', 'Applied'], ['all', 'All']] as const).map(([key, label]) => (
                <button key={key} className={`tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
                  {label}<span className="c num">{groups[key].length}</span>
                </button>
              ))}
            </div>
            <section className="panel">
              {rows.length === 0 ? <Empty big="Nothing here." /> : (
                <div className="table-wrap">
                  <table className="tbl">
                    <thead><tr><th>Company / Role</th><th>Status</th><th>Fit</th><th>Flags</th><th>Created</th><th>Updated</th></tr></thead>
                    <tbody>
                      {rows.map((a) => (
                        <tr key={a.id} onClick={() => nav(`/applications/${a.id}`)} tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter') nav(`/applications/${a.id}`); }}>
                          <td><div className="cell-title">{a.title ?? '—'}</div><div className="cell-sub">{a.company ?? '—'}</div></td>
                          <td><AppStatusBadge status={a.status} /></td>
                          <td><FitBadge status={a.fitStatus} score={a.fitScore} /></td>
                          <td>{a.swiss && <Badge tone="violet">Swiss — review</Badge>}{a.needsAttention && !a.swiss && <Badge tone="amber">Action</Badge>}</td>
                          <td className="num">{fmtWhen(a.createdAt)}</td>
                          <td className="num">{fmtWhen(a.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ))}
      </div>
    </>
  );
}
