import { NavLink, Outlet } from 'react-router-dom';
import { useAsync } from './hooks';
import { api } from './api';

function NavItem({ to, label, count }: { to: string; label: string; count?: number }) {
  return (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
      <span>{label}</span>
      {count != null && count > 0 && <span className="count num">{count}</span>}
    </NavLink>
  );
}

export function App() {
  // Lightweight counts for nav (fails silently — nav still works without them).
  const { data } = useAsync(() => api.dashboard(), []);
  const c = data?.counts;
  const attention = (data?.needsAttention.reviews.length ?? 0) + (data?.needsAttention.applications.length ?? 0);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">A</span> ApplyPilot</div>
        <NavItem to="/" label="Dashboard" />
        <NavItem to="/jobs" label="Jobs" count={c?.jobsDiscovered} />
        <NavItem to="/applications" label="Applications" count={c?.applicationsTotal} />
        <NavItem to="/review" label="Review" count={attention || undefined} />
        <div className="sidebar-foot">
          {data ? (
            <>Local single-user · {data.meta.llmConfigured ? 'fit analysis on' : 'fit analysis off (no API key)'}</>
          ) : 'Local single-user'}
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
