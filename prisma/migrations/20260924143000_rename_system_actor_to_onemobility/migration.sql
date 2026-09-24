UPDATE "TransactionEvent"
SET "actorName" = 'OneMobility'
WHERE "actorName" = 'FleetOS'
  AND "actorRole" = 'system';
