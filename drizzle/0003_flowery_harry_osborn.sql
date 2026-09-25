CREATE TYPE "public"."answer_source" AS ENUM('PROFILE', 'APPROVED_ANSWER', 'DETERMINISTIC_RULE', 'GENERATED', 'USER', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."answer_status" AS ENUM('READY', 'NEEDS_INPUT', 'NEEDS_GENERATION', 'OPTIONAL_BLANK', 'UNSUPPORTED');--> statement-breakpoint
CREATE TYPE "public"."application_provider" AS ENUM('GREENHOUSE', 'LEVER', 'ASHBY', 'WORKABLE', 'SMARTRECRUITERS', 'RECRUITEE', 'CUSTOM', 'AGGREGATOR', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."question_category" AS ENUM('NAME', 'EMAIL', 'PHONE', 'LOCATION', 'LINKEDIN', 'GITHUB', 'PORTFOLIO', 'RESUME', 'YEARS_EXPERIENCE', 'TECH_YEARS', 'WORK_AUTHORIZATION', 'SPONSORSHIP', 'SALARY_EXPECTATION', 'AVAILABILITY', 'EDUCATION', 'LANGUAGE', 'RELOCATION', 'EEO', 'COVER_LETTER', 'WHY_COMPANY', 'FREE_TEXT', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."question_source_kind" AS ENUM('PROVIDER_FORM', 'STANDARD');--> statement-breakpoint
ALTER TYPE "public"."application_event_type" ADD VALUE 'PROVIDER_DETECTED';--> statement-breakpoint
ALTER TYPE "public"."application_event_type" ADD VALUE 'FORM_INSPECTED';--> statement-breakpoint
ALTER TYPE "public"."application_event_type" ADD VALUE 'QUESTION_DISCOVERED';--> statement-breakpoint
ALTER TYPE "public"."application_event_type" ADD VALUE 'ANSWER_PROPOSED';--> statement-breakpoint
ALTER TYPE "public"."application_event_type" ADD VALUE 'USER_ANSWERED';--> statement-breakpoint
ALTER TYPE "public"."application_event_type" ADD VALUE 'PREPARATION_VALIDATED';--> statement-breakpoint
ALTER TYPE "public"."application_event_type" ADD VALUE 'READY_FOR_APPROVAL';--> statement-breakpoint
ALTER TYPE "public"."application_event_type" ADD VALUE 'PREPARATION_APPROVED';--> statement-breakpoint
CREATE TABLE "application_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"value" text,
	"answer_source" "answer_source" DEFAULT 'UNKNOWN' NOT NULL,
	"confidence" text DEFAULT 'low' NOT NULL,
	"status" "answer_status" DEFAULT 'NEEDS_INPUT' NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"reusable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"ordinal" integer DEFAULT 0 NOT NULL,
	"provider_field_id" text,
	"label" text NOT NULL,
	"field_type" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"options" jsonb,
	"category" "question_category" DEFAULT 'UNKNOWN' NOT NULL,
	"source_kind" "question_source_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" "question_category" NOT NULL,
	"label" text,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "provider" "application_provider";--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "apply_url" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "form_understood" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "resume_status" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "preparation_note" text;--> statement-breakpoint
ALTER TABLE "application_answers" ADD CONSTRAINT "application_answers_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_answers" ADD CONSTRAINT "application_answers_question_id_application_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."application_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_questions" ADD CONSTRAINT "application_questions_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_answers" ADD CONSTRAINT "saved_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "application_answers_question_unique" ON "application_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "application_answers_app_idx" ON "application_answers" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_questions_app_idx" ON "application_questions" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_answers_user_cat_label_unique" ON "saved_answers" USING btree ("user_id","category","label");