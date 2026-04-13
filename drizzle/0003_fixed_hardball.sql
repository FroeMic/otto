ALTER TABLE "organizations" ADD COLUMN "slug" varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_slug_unique" UNIQUE("slug");