/*
  Warnings:

  - The values [INTERNAL_NOTE] on the enum `MsgKind` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `lastCustomerMessageAt` on the `Conversation` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."MsgKind_new" AS ENUM ('USER', 'AGENT', 'SYSTEM', 'INTERNAL');
ALTER TABLE "public"."Message" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "public"."Message" ALTER COLUMN "kind" TYPE "public"."MsgKind_new" USING ("kind"::text::"public"."MsgKind_new");
ALTER TYPE "public"."MsgKind" RENAME TO "MsgKind_old";
ALTER TYPE "public"."MsgKind_new" RENAME TO "MsgKind";
DROP TYPE "public"."MsgKind_old";
ALTER TABLE "public"."Message" ALTER COLUMN "kind" SET DEFAULT 'USER';
COMMIT;

-- AlterTable
ALTER TABLE "public"."Attachment" ADD COLUMN     "filename" TEXT,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "publicId" TEXT,
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "public"."Conversation" DROP COLUMN "lastCustomerMessageAt",
ADD COLUMN     "firstAgentResponseAt" TIMESTAMP(3),
ADD COLUMN     "lastMessageAt" TIMESTAMP(3),
ADD COLUMN     "lastUserMessageAt" TIMESTAMP(3),
ADD COLUMN     "slaBreached" BOOLEAN,
ADD COLUMN     "slaTargetAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Attachment_publicId_idx" ON "public"."Attachment"("publicId");

-- CreateIndex
CREATE INDEX "Conversation_status_lastMessageAt_idx" ON "public"."Conversation"("status", "lastMessageAt");
