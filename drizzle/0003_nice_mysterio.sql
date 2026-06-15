DROP TABLE IF EXISTS "api_keys";--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "agent_types" ADD COLUMN "status" varchar(20) DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "agent_types" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "agent_types" ADD COLUMN "delegates_to" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "agent_types" ADD COLUMN "tools" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "run_count" varchar(10);--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "last_message_snippet" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_user_id_index" ON "sessions" USING btree ("user_id");