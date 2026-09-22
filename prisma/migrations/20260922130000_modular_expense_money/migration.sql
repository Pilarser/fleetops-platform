-- Store financial values exactly and make currency explicit before adding billing domains.
ALTER TABLE "Driver"
  ALTER COLUMN "monthlySpend" TYPE DECIMAL(12,2) USING "monthlySpend"::DECIMAL(12,2),
  ALTER COLUMN "personalSpend" TYPE DECIMAL(12,2) USING "personalSpend"::DECIMAL(12,2),
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR';

ALTER TABLE "Vehicle"
  ALTER COLUMN "monthlySpend" TYPE DECIMAL(12,2) USING "monthlySpend"::DECIMAL(12,2),
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR';

ALTER TABLE "MobilityService"
  ALTER COLUMN "monthlyLimit" TYPE DECIMAL(12,2) USING "monthlyLimit"::DECIMAL(12,2),
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR';

ALTER TABLE "FleetTransaction"
  ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING "amount"::DECIMAL(12,2),
  ALTER COLUMN "vat" TYPE DECIMAL(12,2) USING "vat"::DECIMAL(12,2),
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR';
