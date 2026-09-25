import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import type { Database } from '../db/client.js';
import * as q from './queries.js';
import { listApprovedLocalFiles } from '../prep/artifacts.js';
import { prepareApplication, applyUserAnswer, approvePreparation } from '../prep/prepare.js';

/** Wrap an async handler so rejections become 500s instead of crashing. */
function h(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[api]', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
    });
  };
}

/**
 * Build the read-oriented API. All data access goes through ./queries (the single
 * data-access boundary) — routes never touch the DB directly. Mutations are limited
 * to existing domain behavior (resolve/reject a review item).
 */
export function createApiApp(db: Database): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  const r = express.Router();

  r.get('/dashboard', h(async (_req, res) => res.json(await q.getDashboard(db))));
  r.get('/sources', h(async (_req, res) => res.json(await q.listSources(db))));

  r.get('/jobs', h(async (req, res) => {
    const s = req.query as Record<string, string | undefined>;
    res.json(await q.listJobs(db, {
      eligibility: s['eligibility'], fit: s['fit'], source: s['source'], freshness: s['freshness'],
      appStatus: s['appStatus'], q: s['q'], sort: s['sort'],
      limit: s['limit'] ? Number(s['limit']) : undefined,
      offset: s['offset'] ? Number(s['offset']) : undefined,
    }));
  }));
  r.get('/jobs/:id', h(async (req, res) => {
    const detail = await q.getJobDetail(db, String(req.params['id']));
    if (!detail) return res.status(404).json({ error: 'Job not found' });
    return res.json(detail);
  }));

  r.get('/applications', h(async (req, res) => {
    const status = (req.query['status'] as string) || undefined;
    res.json(await q.listApplications(db, status));
  }));
  r.get('/applications/:id', h(async (req, res) => {
    const detail = await q.getApplicationDetail(db, String(req.params['id']));
    if (!detail) return res.status(404).json({ error: 'Application not found' });
    return res.json(detail);
  }));

  // --- Phase 2D: supervised application preparation (never submits) ---
  r.post('/jobs/:id/prepare', h(async (req, res) => {
    const summary = await prepareApplication(db, String(req.params['id']));
    res.json(summary);
  }));
  r.get('/local-files', h(async (_req, res) => {
    res.json({ files: listApprovedLocalFiles() });
  }));
  r.post('/applications/:id/answers', h(async (req, res) => {
    const questionId = String(req.body?.questionId ?? '');
    const value = String(req.body?.value ?? '');
    const reusable = Boolean(req.body?.reusable);
    const manual = Boolean(req.body?.manual);
    const localFile = req.body?.localFile != null ? String(req.body.localFile) : undefined;
    if (!questionId) return res.status(400).json({ error: 'questionId required' });
    const mode = manual ? 'manual' : localFile ? 'local_file' : 'text';
    await applyUserAnswer(db, questionId, value, { reusable, mode, localFile });
    return res.json(await q.getApplicationDetail(db, String(req.params['id'])));
  }));
  r.post('/applications/:id/approve', h(async (req, res) => {
    await approvePreparation(db, String(req.params['id']));
    res.json(await q.getApplicationDetail(db, String(req.params['id'])));
  }));

  r.get('/reviews', h(async (_req, res) => res.json(await q.listBlockingReviews(db))));
  r.post('/reviews/:id/resolve', h(async (req, res) => {
    const note = (req.body?.note as string) || undefined;
    res.json(await q.resolveReview(db, String(req.params['id']), 'RESOLVED', note));
  }));
  r.post('/reviews/:id/reject', h(async (req, res) => {
    const note = (req.body?.note as string) || undefined;
    res.json(await q.resolveReview(db, String(req.params['id']), 'DISMISSED', note));
  }));

  app.use('/api', r);
  return app;
}
