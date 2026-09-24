ALTER TYPE "public"."fit_status" ADD VALUE 'GOOD';--> statement-breakpoint
ALTER TYPE "public"."fit_status" ADD VALUE 'BORDERLINE';--> statement-breakpoint
ALTER TYPE "public"."fit_status" ADD VALUE 'POOR';--> statement-breakpoint
ALTER TABLE "job_matches" ADD COLUMN "fit_analysis" jsonb;--> statement-breakpoint
ALTER TABLE "job_matches" ADD COLUMN "fit_analysis_hash" text;--> statement-breakpoint
ALTER TABLE "job_matches" ADD COLUMN "fit_analyzed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_matches" ADD COLUMN "fit_model" text;--> statement-breakpoint
ALTER TABLE "job_matches" ADD COLUMN "fit_prompt_version" text;