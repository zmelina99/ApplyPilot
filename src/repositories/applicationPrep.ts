import { and, asc, eq } from 'drizzle-orm';
import type { Database, Exec } from '../db/client.js';
import {
  applicationQuestions, applicationAnswers, savedAnswers, applications,
} from '../db/schema/index.js';
import type {
  ApplicationQuestion, ApplicationAnswer, NewApplicationQuestion, NewApplicationAnswer,
} from '../db/schema/applicationPrep.js';
import { NotFoundError } from '../domain/errors.js';

export interface PreparedItem {
  question: Omit<NewApplicationQuestion, 'applicationId' | 'ordinal'>;
  answer: Omit<NewApplicationAnswer, 'applicationId' | 'questionId'>;
}

/** Replace all questions+answers for an application in one transaction (idempotent
 * re-prepare). USER-provided answers are preserved by category+label if present. */
export async function replacePreparedForm(
  db: Database,
  applicationId: string,
  items: PreparedItem[],
): Promise<void> {
  await db.transaction(async (tx) => {
    // Preserve prior USER answers so re-preparing doesn't wipe manual input.
    const prior = await tx
      .select({ q: applicationQuestions, a: applicationAnswers })
      .from(applicationQuestions)
      .innerJoin(applicationAnswers, eq(applicationAnswers.questionId, applicationQuestions.id))
      .where(eq(applicationQuestions.applicationId, applicationId));
    const userAnswers = new Map<string, ApplicationAnswer>();
    for (const row of prior) {
      if (row.a.answerSource === 'USER') userAnswers.set(`${row.q.category}:${row.q.label}`, row.a);
    }

    await tx.delete(applicationQuestions).where(eq(applicationQuestions.applicationId, applicationId));
    let ordinal = 0;
    for (const item of items) {
      const [q] = await tx
        .insert(applicationQuestions)
        .values({ ...item.question, applicationId, ordinal: ordinal++ })
        .returning();
      if (!q) throw new Error('Failed to insert question');
      const preserved = userAnswers.get(`${q.category}:${q.label}`);
      const answer = preserved
        ? { value: preserved.value, answerSource: preserved.answerSource, confidence: preserved.confidence, status: preserved.status, approved: preserved.approved, reusable: preserved.reusable }
        : item.answer;
      await tx.insert(applicationAnswers).values({ ...answer, applicationId, questionId: q.id });
    }
  });
}

export interface QARow { question: ApplicationQuestion; answer: ApplicationAnswer }

export async function getPreparedForm(exec: Exec, applicationId: string): Promise<QARow[]> {
  const rows = await exec
    .select({ question: applicationQuestions, answer: applicationAnswers })
    .from(applicationQuestions)
    .innerJoin(applicationAnswers, eq(applicationAnswers.questionId, applicationQuestions.id))
    .where(eq(applicationQuestions.applicationId, applicationId))
    .orderBy(asc(applicationQuestions.ordinal));
  return rows;
}

export async function getAnswer(exec: Exec, answerId: string): Promise<ApplicationAnswer | null> {
  const [row] = await exec.select().from(applicationAnswers).where(eq(applicationAnswers.id, answerId)).limit(1);
  return row ?? null;
}
export async function getQuestion(exec: Exec, questionId: string): Promise<ApplicationQuestion | null> {
  const [row] = await exec.select().from(applicationQuestions).where(eq(applicationQuestions.id, questionId)).limit(1);
  return row ?? null;
}

/** Persist a user's answer to one question. */
export async function setUserAnswer(
  db: Database,
  questionId: string,
  value: string,
): Promise<ApplicationAnswer> {
  const [row] = await db
    .update(applicationAnswers)
    .set({ value, answerSource: 'USER', confidence: 'high', status: 'READY', updatedAt: new Date() })
    .where(eq(applicationAnswers.questionId, questionId))
    .returning();
  if (!row) throw new NotFoundError('ApplicationAnswer', questionId);
  return row;
}

/** Save a globally reusable, user-approved answer (explicit opt-in only). */
export async function saveReusableAnswer(
  db: Database,
  userId: string,
  category: ApplicationQuestion['category'],
  label: string | null,
  value: string,
): Promise<void> {
  await db
    .insert(savedAnswers)
    .values({ userId, category, label, value })
    .onConflictDoUpdate({
      target: [savedAnswers.userId, savedAnswers.category, savedAnswers.label],
      set: { value, updatedAt: new Date() },
    });
}

/** Map of reusable answers keyed by category (or `TECH_YEARS:<tech>`). */
export async function getSavedAnswersMap(exec: Exec, userId: string): Promise<Map<string, string>> {
  const rows = await exec.select().from(savedAnswers).where(eq(savedAnswers.userId, userId));
  const m = new Map<string, string>();
  for (const r of rows) m.set(r.category === 'TECH_YEARS' && r.label ? `TECH_YEARS:${r.label}` : r.category, r.value);
  return m;
}

export interface PrepMeta {
  provider: (typeof applications.$inferInsert)['provider'];
  applyUrl: string | null;
  formUnderstood: boolean;
  resumeStatus: string | null;
  preparationNote: string | null;
}
export async function setApplicationPrep(db: Database, applicationId: string, meta: PrepMeta): Promise<void> {
  await db
    .update(applications)
    .set({ ...meta, updatedAt: new Date() })
    .where(eq(applications.id, applicationId));
}

export async function markAnswerApproved(db: Database, answerId: string, approved: boolean): Promise<void> {
  await db.update(applicationAnswers).set({ approved, updatedAt: new Date() }).where(eq(applicationAnswers.id, answerId));
}
