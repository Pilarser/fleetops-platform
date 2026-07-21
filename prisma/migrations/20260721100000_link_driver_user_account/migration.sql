ALTER TABLE "Driver" ADD COLUMN "userId" TEXT;

UPDATE "Driver"
SET "userId" = 'user-driver'
WHERE id = 'driver-1'
  AND EXISTS (SELECT 1 FROM "User" WHERE id = 'user-driver');

CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");

ALTER TABLE "Driver"
ADD CONSTRAINT "Driver_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
