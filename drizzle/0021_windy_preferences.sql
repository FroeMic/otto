ALTER TABLE "organizations" ADD COLUMN "locale" varchar(32) DEFAULT 'en-US' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "time_format_preference" varchar(16) DEFAULT 'auto' NOT NULL;--> statement-breakpoint
