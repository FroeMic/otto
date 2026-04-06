DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'memberships'
      AND column_name = 'external_id'
  ) THEN
    ALTER TABLE "memberships" ADD COLUMN "external_id" varchar(255);
  END IF;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'memberships'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE "memberships" ADD COLUMN "status" varchar(64);
  END IF;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'memberships'
      AND column_name = 'removed_at'
  ) THEN
    ALTER TABLE "memberships" ADD COLUMN "removed_at" timestamp with time zone;
  END IF;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'memberships'
      AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE "memberships" ADD COLUMN "last_synced_at" timestamp with time zone;
  END IF;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'memberships'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE "memberships" ADD COLUMN "updated_at" timestamp with time zone;
  END IF;
END
$$;--> statement-breakpoint
UPDATE "memberships"
SET
  "status" = COALESCE("status", 'active'),
  "last_synced_at" = COALESCE("last_synced_at", now()),
  "updated_at" = COALESCE("updated_at", now());--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "last_synced_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "last_synced_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
WITH ranked_memberships AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "user_id", "organization_id"
      ORDER BY "created_at" DESC, "id" DESC
    ) AS "row_number"
  FROM "memberships"
)
DELETE FROM "memberships"
WHERE "id" IN (
  SELECT "id"
  FROM ranked_memberships
  WHERE "row_number" > 1
);--> statement-breakpoint
WITH ranked_external_ids AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "external_id"
      ORDER BY "last_synced_at" DESC, "created_at" DESC, "id" DESC
    ) AS "row_number"
  FROM "memberships"
  WHERE "external_id" IS NOT NULL
)
DELETE FROM "memberships"
WHERE "id" IN (
  SELECT "id"
  FROM ranked_external_ids
  WHERE "row_number" > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "memberships_external_id_idx" ON "memberships" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "memberships_user_id_organization_id_idx" ON "memberships" USING btree ("user_id","organization_id");
