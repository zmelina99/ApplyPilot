import type { ReactNode } from 'react';

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="topbar">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h1>{title}</h1>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {actions}
      </div>
    </div>
  );
}

export function Loading() { return <div className="loading">Loading…</div>; }
export function ErrorState({ message }: { message: string }) {
  return <div className="error">Couldn’t load data: {message}</div>;
}
export function Empty({ big, children }: { big: string; children?: ReactNode }) {
  return <div className="empty"><div className="big">{big}</div>{children}</div>;
}

export function Panel({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-h"><h3>{title}</h3>{hint && <span className="hint">{hint}</span>}</div>
      <div className="panel-b">{children}</div>
    </section>
  );
}

export function Stat({ k, v, tone }: { k: string; v: ReactNode; tone?: string }) {
  return <div className="stat"><div className="k">{k}</div><div className={`v${tone ? ' ' + tone : ''}`}>{v}</div></div>;
}
