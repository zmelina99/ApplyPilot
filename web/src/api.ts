import type { AppDetail, AppListItem, DashboardData, JobDetail, JobListItem, ReviewView } from './types';

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}
async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export const api = {
  dashboard: () => get<DashboardData>('/api/dashboard'),
  sources: () => get<string[]>('/api/sources'),
  jobs: (params: Record<string, string>) =>
    get<{ items: JobListItem[]; total: number }>(`/api/jobs?${new URLSearchParams(params)}`),
  job: (id: string) => get<JobDetail>(`/api/jobs/${id}`),
  applications: (status?: string) =>
    get<AppListItem[]>(`/api/applications${status ? `?status=${status}` : ''}`),
  application: (id: string) => get<AppDetail>(`/api/applications/${id}`),
  reviews: () => get<ReviewView[]>('/api/reviews'),
  resolveReview: (id: string, note?: string) => post(`/api/reviews/${id}/resolve`, { note }),
  rejectReview: (id: string, note?: string) => post(`/api/reviews/${id}/reject`, { note }),
  prepareJob: (jobId: string) => post<{ applicationId: string | null }>(`/api/jobs/${jobId}/prepare`, {}),
  answer: (appId: string, questionId: string, value: string, reusable: boolean) =>
    post<AppDetail>(`/api/applications/${appId}/answers`, { questionId, value, reusable }),
  approve: (appId: string) => post<AppDetail>(`/api/applications/${appId}/approve`, {}),
};
