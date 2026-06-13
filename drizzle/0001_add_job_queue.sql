-- Add job_queue table
CREATE TYPE "public"."job_queue_priority" AS ENUM('critical', 'high', 'normal', 'low');

CREATE TABLE "job_queue" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"priority" "job_queue_priority" DEFAULT 'normal' NOT NULL,
	"status" varchar(20) DEFAULT 'waiting' NOT NULL,
	"enqueued_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	CONSTRAINT "job_queue_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "job_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "job_queue_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action
);

CREATE INDEX "job_queue_status_index" ON "job_queue" USING btree ("status");
CREATE INDEX "job_queue_priority_enqueued_index" ON "job_queue" USING btree ("priority", "enqueued_at");
