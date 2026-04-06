ALTER TABLE "memberships" ADD COLUMN "external_id" varchar(255);--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "status" varchar(64) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "last_synced_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_external_id_idx" ON "memberships" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_id_organization_id_idx" ON "memberships" USING btree ("user_id","organization_id");