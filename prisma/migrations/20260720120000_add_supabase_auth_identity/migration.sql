ALTER TABLE "User" ADD COLUMN "authUserId" TEXT;
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

CREATE UNIQUE INDEX "User_authUserId_key" ON "User"("authUserId");
