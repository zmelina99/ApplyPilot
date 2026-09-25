import {
  pgTable, uuid, text, integer, boolean, timestamp, jsonb, uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { applications } from './applications.js';
import {
  questionCategoryEnum, questionSourceKindEnum, answerSourceEnum, answerStatusEnum,
} from './enums.js';

/**
 * A discovered (or standard) application question for one application. For a supported
 * structured provider these are the real form fields; otherwise they are the
 * candidate's standard questions (source_kind = STANDARD) prepared as an aid.
 */
export const applicationQuestions = pgTable(
  'application_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').default(0).notNull(),
    providerFieldId: text('provider_field_id'), // stable id from the ATS, when available
    label: text('label').notNull(),
    fieldType: text('field_type').notNull(), // text | textarea | select | multiselect | boolean | file | ...
    required: boolean('required').default(false).notNull(),
    options: jsonb('options'), // for select/multiselect
    category: questionCategoryEnum('category').default('UNKNOWN').notNull(),
    sourceKind: questionSourceKindEnum('source_kind').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('application_questions_app_idx').on(t.applicationId)],
);

/**
 * The proposed/held answer for one question. Never presents a GENERATED value as a
 * verified fact; UNKNOWN answers are NEEDS_INPUT, never guessed. `reusable` is only
 * set when the user explicitly opts in.
 */
export const applicationAnswers = pgTable(
  'application_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => applicationQuestions.id, { onDelete: 'cascade' }),
    value: text('value'),
    answerSource: answerSourceEnum('answer_source').default('UNKNOWN').notNull(),
    confidence: text('confidence').default('low').notNull(), // high | medium | low
    status: answerStatusEnum('status').default('NEEDS_INPUT').notNull(),
    approved: boolean('approved').default(false).notNull(),
    reusable: boolean('reusable').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('application_answers_question_unique').on(t.questionId),
    index('application_answers_app_idx').on(t.applicationId),
  ],
);

/**
 * Globally reusable, user-approved answers by question category (+ optional label
 * qualifier for TECH_YEARS etc.). Only written when the user explicitly opts in.
 */
export const savedAnswers = pgTable(
  'saved_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: questionCategoryEnum('category').notNull(),
    label: text('label'), // qualifier, e.g. the specific tech for TECH_YEARS
    value: text('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('saved_answers_user_cat_label_unique').on(t.userId, t.category, t.label)],
);

export type ApplicationQuestion = typeof applicationQuestions.$inferSelect;
export type NewApplicationQuestion = typeof applicationQuestions.$inferInsert;
export type ApplicationAnswer = typeof applicationAnswers.$inferSelect;
export type NewApplicationAnswer = typeof applicationAnswers.$inferInsert;
export type SavedAnswer = typeof savedAnswers.$inferSelect;
