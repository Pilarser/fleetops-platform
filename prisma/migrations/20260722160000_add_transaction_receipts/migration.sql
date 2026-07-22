ALTER TABLE "FleetTransaction"
ADD COLUMN "receiptPath" TEXT,
ADD COLUMN "receiptName" TEXT,
ADD COLUMN "receiptMimeType" TEXT,
ADD COLUMN "receiptSize" INTEGER;
