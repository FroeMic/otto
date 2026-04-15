ALTER TABLE "tenant_servers"
  ADD COLUMN "provisioning_strategy" varchar(64),
  ADD COLUMN "snapshot_generation" varchar(255),
  ADD COLUMN "source_image" varchar(255),
  ADD COLUMN "source_snapshot_id" varchar(255);
