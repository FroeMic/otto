CREATE TABLE "user_platform_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_platform_roles" ADD CONSTRAINT "user_platform_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "user_platform_roles_user_id_idx" ON "user_platform_roles" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "user_platform_roles_user_id_role_idx" ON "user_platform_roles" USING btree ("user_id","role");
