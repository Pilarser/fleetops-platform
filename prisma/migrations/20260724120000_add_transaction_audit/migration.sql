CREATE TABLE "TransactionEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TransactionEvent_companyId_transactionId_createdAt_idx"
ON "TransactionEvent"("companyId", "transactionId", "createdAt");

ALTER TABLE "TransactionEvent"
ADD CONSTRAINT "TransactionEvent_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TransactionEvent"
ADD CONSTRAINT "TransactionEvent_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "FleetTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "TransactionEvent" ("id", "companyId", "transactionId", "type", "actorId", "actorName", "actorRole", "details", "createdAt")
SELECT
    'event-' || gen_random_uuid()::text,
    "companyId",
    id,
    'submitted',
    'system',
    'FleetOS',
    'system',
    '{"summary":"Transaction existed before audit tracking was enabled."}'::jsonb,
    "createdAt"
FROM "FleetTransaction";

ALTER TABLE "TransactionEvent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "TransactionEvent" FROM anon, authenticated;
