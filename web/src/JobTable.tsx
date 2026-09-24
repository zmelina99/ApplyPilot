import { useNavigate } from 'react-router-dom';
import type { JobListItem } from './types';
import { AppStatusBadge, EligibilityBadge, FitBadge, Badge, fmtSalary, fmtWhen, remoteLabel, uncertaintyLabel } from './ui';

export function JobTable({ items }: { items: JobListItem[] }) {
  const nav = useNavigate();
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>Company / Role</th>
            <th>Fit</th>
            <th>Eligibility</th>
            <th>Location</th>
            <th>Salary</th>
            <th>Posted</th>
            <th>Source</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((j) => (
            <tr key={j.id} onClick={() => nav(`/jobs/${j.id}`)} tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') nav(`/jobs/${j.id}`); }}>
              <td>
                <div className="cell-title">{j.title ?? '—'}</div>
                <div className="cell-sub">{j.company ?? '—'}</div>
                {j.uncertainties.length > 0 && (
                  <div className="pill-group" style={{ marginTop: 4 }}>
                    {j.uncertainties.slice(0, 2).map((u) => (
                      <span key={u} className="badge b-blue" title="Uncertainty — not a rejection"><span className="dot" />{uncertaintyLabel(u)}</span>
                    ))}
                  </div>
                )}
              </td>
              <td><FitBadge status={j.fitStatus} score={j.fitScore} /></td>
              <td><EligibilityBadge status={j.eligibilityStatus} /></td>
              <td>{j.priority && <span title="Posted within 72h" style={{ marginRight: 4 }}>●</span>}{j.location ?? '—'} <span className="cell-sub">{remoteLabel(j.remoteType)}</span></td>
              <td className="num">{fmtSalary(j.salary)}</td>
              <td className="num">{fmtWhen(j.datePosted)}</td>
              <td className="cell-sub">{j.sources.join(', ') || '—'}</td>
              <td>{j.applicationStatus ? <AppStatusBadge status={j.applicationStatus} /> : <span className="muted">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function JobMiniList({ items }: { items: JobListItem[] }) {
  const nav = useNavigate();
  return (
    <div>
      {items.map((j) => (
        <div key={j.id} className="attn-row" onClick={() => nav(`/jobs/${j.id}`)} tabIndex={0}
             onKeyDown={(e) => { if (e.key === 'Enter') nav(`/jobs/${j.id}`); }} style={{ cursor: 'pointer' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="cell-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.title ?? '—'}</div>
            <div className="cell-sub">{j.company ?? '—'} · {j.location ?? remoteLabel(j.remoteType)}</div>
          </div>
          {j.fitScore != null ? <FitBadge status={j.fitStatus} score={j.fitScore} /> : <EligibilityBadge status={j.eligibilityStatus} />}
        </div>
      ))}
    </div>
  );
}
