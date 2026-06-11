CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'in_progress', 'awaiting_response', 'paused', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."run_step_status" AS ENUM('in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."run_step_type" AS ENUM('message_creation', 'tool_call', 'agent_delegation', 'reasoning');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('T1', 'T2', 'T3');--> statement-breakpoint
CREATE TYPE "public"."tool_call_status" AS ENUM('in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."tool_type" AS ENUM('function', 'builtin');--> statement-breakpoint
CREATE TABLE "agent_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tier" "tier" NOT NULL,
	"description" text NOT NULL,
	"model_config" jsonb,
	"capabilities" jsonb,
	"tool_ids" uuid[],
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"name" text NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "invite_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(64) NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invite_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"thread_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"agent_type_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"type" "run_step_type" NOT NULL,
	"status" "run_step_status" DEFAULT 'in_progress' NOT NULL,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"thread_id" uuid NOT NULL,
	"agent_type_id" uuid NOT NULL,
	"parent_run_id" uuid,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"model_config" jsonb,
	"usage" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" jsonb,
	"is_global" boolean DEFAULT true NOT NULL,
	"user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_calls" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_step_id" uuid NOT NULL,
	"tool_id" uuid NOT NULL,
	"name" text NOT NULL,
	"arguments" jsonb,
	"result" jsonb,
	"status" "tool_call_status" DEFAULT 'in_progress' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"parameters_schema" jsonb,
	"type" "tool_type" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tools_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_agent_type_id_agent_types_id_fk" FOREIGN KEY ("agent_type_id") REFERENCES "public"."agent_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_agent_type_id_agent_types_id_fk" FOREIGN KEY ("agent_type_id") REFERENCES "public"."agent_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_parent_run_id_runs_id_fk" FOREIGN KEY ("parent_run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_run_step_id_run_steps_id_fk" FOREIGN KEY ("run_step_id") REFERENCES "public"."run_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_user_id_index" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "messages_thread_id_index" ON "messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "run_steps_run_id_index" ON "run_steps" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "runs_thread_id_index" ON "runs" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "runs_agent_type_id_index" ON "runs" USING btree ("agent_type_id");--> statement-breakpoint
CREATE INDEX "runs_status_index" ON "runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "runs_parent_run_id_index" ON "runs" USING btree ("parent_run_id");--> statement-breakpoint
CREATE INDEX "settings_key_index" ON "settings" USING btree ("key");--> statement-breakpoint
CREATE INDEX "settings_user_id_index" ON "settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "threads_user_id_index" ON "threads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tool_calls_run_step_id_index" ON "tool_calls" USING btree ("run_step_id");--> statement-breakpoint
CREATE INDEX "tool_calls_tool_id_index" ON "tool_calls" USING btree ("tool_id");