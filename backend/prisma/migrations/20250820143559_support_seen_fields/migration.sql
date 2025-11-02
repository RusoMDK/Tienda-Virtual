-- AlterEnum
ALTER TYPE "public"."Channel" ADD VALUE 'TELEGRAM';

-- AlterTable
ALTER TABLE "public"."Conversation" ADD COLUMN     "lastAgentMessageAt" TIMESTAMP(3),
ADD COLUMN     "lastCustomerMessageAt" TIMESTAMP(3),
ADD COLUMN     "lastSeenByCustomerAt" TIMESTAMP(3),
ADD COLUMN     "lastSeenByStaffAt" TIMESTAMP(3);
