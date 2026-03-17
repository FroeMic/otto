CREATE TABLE "waitlist_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" varchar(320) NOT NULL,
	"usage_preference" varchar(32) NOT NULL,
	"heard_about_otto" text,
	"use_case" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "waitlist_signups_created_at_idx" ON "waitlist_signups" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_signups_email_idx" ON "waitlist_signups" USING btree ("email");