CREATE TYPE "public"."application_event_type" AS ENUM('APPLICATION_CREATED', 'STATUS_CHANGED', 'APPLICATION_STARTED', 'USER_INPUT_REQUIRED', 'USER_APPROVED', 'USER_REJECTED', 'LOGIN_REQUIRED', 'CAPTCHA_ENCOUNTERED', 'AUTOMATION_FAILED', 'APPLICATION_SUBMITTED');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('QUEUED', 'APPLYING', 'NEEDS_USER_INPUT', 'LOGIN_REQUIRED', 'CAPTCHA', 'AUTOMATION_FAILED', 'MANUAL_REVIEW', 'READY_FOR_APPROVAL', 'APPLIED');--> statement-breakpoint
CREATE TYPE "public"."automation_approval_status" AS ENUM('NOT_REQUESTED', 'AWAITING_AUTOMATION_APPROVAL', 'APPROVED', 'DECLINED');--> statement-breakpoint
CREATE TYPE "public"."eligibility_status" AS ENUM('PENDING', 'ELIGIBLE', 'INELIGIBLE', 'AMBIGUOUS');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('PERMANENT', 'FIXED_TERM', 'CONTRACT', 'FREELANCE', 'EOR', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."fit_status" AS ENUM('PENDING', 'STRONG', 'MODERATE', 'WEAK');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('PENDING', 'FILTERED', 'QUALIFIED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."posting_status" AS ENUM('ACTIVE', 'EXPIRED', 'CLOSED', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."remote_type" AS ENUM('REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('OPEN', 'RESOLVED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."review_type" AS ENUM('INITIAL_APPLICATION_APPROVAL', 'SWISS_APPLICATION', 'EXCEPTIONAL_STARTUP', 'MISSING_INFORMATION', 'AMBIGUOUS_ELIGIBILITY', 'SALARY_QUESTION', 'LOGIN_REQUIRED', 'CAPTCHA', 'AUTOMATION_FAILURE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."salary_period" AS ENUM('YEAR', 'MONTH', 'WEEK', 'DAY', 'HOUR');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_automation_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"automation_enabled" boolean DEFAULT false NOT NULL,
	"initial_review_target" integer DEFAULT 20 NOT NULL,
	"initial_review_count" integer DEFAULT 0 NOT NULL,
	"automation_approval_status" "automation_approval_status" DEFAULT 'NOT_REQUESTED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_url" text NOT NULL,
	"company_name" text,
	"title" text,
	"location_text" text,
	"remote_type" "remote_type" DEFAULT 'UNKNOWN' NOT NULL,
	"employment_type" "employment_type",
	"description" text,
	"salary_min" numeric,
	"salary_max" numeric,
	"salary_currency" text,
	"salary_period" "salary_period",
	"date_posted" timestamp with time zone,
	"first_discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"posting_status" "posting_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"source_name" text NOT NULL,
	"source_job_id" text,
	"source_url" text NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "job_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"status" "match_status" DEFAULT 'PENDING' NOT NULL,
	"eligibility_status" "eligibility_status" DEFAULT 'PENDING' NOT NULL,
	"eligibility_reason" text,
	"fit_status" "fit_status" DEFAULT 'PENDING' NOT NULL,
	"fit_score" integer,
	"fit_reason" text,
	"evaluated_at" timestamp with time zone,
	"evaluation_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"status" "application_status" DEFAULT 'QUEUED' NOT NULL,
	"ats_type" text,
	"started_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"current_step" text,
	"requires_user_input" boolean DEFAULT false NOT NULL,
	"user_input_reason" text,
	"failure_category" text,
	"failure_details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"event_type" "application_event_type" NOT NULL,
	"from_status" "application_status",
	"to_status" "application_status",
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid,
	"application_id" uuid,
	"review_type" "review_type" NOT NULL,
	"status" "review_status" DEFAULT 'OPEN' NOT NULL,
	"reason" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user_automation_settings" ADD CONSTRAINT "user_automation_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_sources" ADD CONSTRAINT "job_sources_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_canonical_url_unique" ON "jobs" USING btree ("canonical_url");--> statement-breakpoint
CREATE UNIQUE INDEX "job_sources_name_source_job_id_unique" ON "job_sources" USING btree ("source_name","source_job_id") WHERE "job_sources"."source_job_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "job_sources_name_url_unique" ON "job_sources" USING btree ("source_name","source_url");--> statement-breakpoint
CREATE INDEX "job_sources_job_id_idx" ON "job_sources" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_matches_user_job_unique" ON "job_matches" USING btree ("user_id","job_id");--> statement-breakpoint
CREATE INDEX "job_matches_user_id_idx" ON "job_matches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "job_matches_job_id_idx" ON "job_matches" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_user_job_unique" ON "applications" USING btree ("user_id","job_id");--> statement-breakpoint
CREATE INDEX "applications_user_id_idx" ON "applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "applications_job_id_idx" ON "applications" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "application_events_application_id_idx" ON "application_events" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_events_app_created_idx" ON "application_events" USING btree ("application_id","created_at");--> statement-breakpoint
CREATE INDEX "review_items_user_id_idx" ON "review_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "review_items_user_status_idx" ON "review_items" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "review_items_application_id_idx" ON "review_items" USING btree ("application_id");