/*
  Warnings:

  - You are about to alter the column `phone` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(16)`.

*/
-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "ci" VARCHAR(64),
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "middleName" TEXT,
ALTER COLUMN "phone" SET DATA TYPE VARCHAR(16);

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "public"."User"("phone");

-- CreateIndex
CREATE INDEX "User_ci_idx" ON "public"."User"("ci");
