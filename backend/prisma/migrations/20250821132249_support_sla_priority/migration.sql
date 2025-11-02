/*
  Warnings:

  - You are about to drop the column `firstAgentResponseAt` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `lastUserMessageAt` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `slaBreached` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `slaTargetAt` on the `Conversation` table. All the data in the column will be lost.
  - The `priority` column on the `Conversation` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."ConvPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "public"."Conversation" DROP COLUMN "firstAgentResponseAt",
DROP COLUMN "lastUserMessageAt",
DROP COLUMN "slaBreached",
DROP COLUMN "slaTargetAt",
ADD COLUMN     "firstResponseAt" TIMESTAMP(3),
ADD COLUMN     "firstResponseSlaAt" TIMESTAMP(3),
ADD COLUMN     "lastCustomerMessageAt" TIMESTAMP(3),
ADD COLUMN     "resolutionSlaAt" TIMESTAMP(3),
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
DROP COLUMN "priority",
ADD COLUMN     "priority" "public"."ConvPriority" NOT NULL DEFAULT 'NORMAL';

-- CreateIndex
CREATE INDEX "Conversation_priority_status_idx" ON "public"."Conversation"("priority", "status");

-- CreateIndex
CREATE INDEX "Conversation_firstResponseSlaAt_idx" ON "public"."Conversation"("firstResponseSlaAt");

-- CreateIndex
CREATE INDEX "Conversation_resolutionSlaAt_idx" ON "public"."Conversation"("resolutionSlaAt");
