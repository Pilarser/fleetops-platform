ALTER TABLE "MobilityService" ADD COLUMN "type" TEXT;

UPDATE "MobilityService" SET "type" = id;

ALTER TABLE "MobilityService" ALTER COLUMN "type" SET NOT NULL;

CREATE UNIQUE INDEX "MobilityService_companyId_type_key" ON "MobilityService"("companyId", "type");
