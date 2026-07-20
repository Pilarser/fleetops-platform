ALTER TABLE "FleetTransaction"
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "reviewedByName" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "rejectionReason" TEXT;
