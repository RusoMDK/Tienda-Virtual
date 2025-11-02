-- CreateEnum
CREATE TYPE "public"."ConvStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."Channel" AS ENUM ('WEB', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "public"."MsgKind" AS ENUM ('USER', 'AGENT', 'SYSTEM', 'INTERNAL_NOTE');

-- AlterEnum
ALTER TYPE "public"."Role" ADD VALUE 'SUPPORT';

-- CreateTable
CREATE TABLE "public"."Conversation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "assignedToId" TEXT,
    "guestName" TEXT,
    "guestEmail" TEXT,
    "guestKey" TEXT,
    "subject" TEXT,
    "status" "public"."ConvStatus" NOT NULL DEFAULT 'OPEN',
    "channel" "public"."Channel" NOT NULL DEFAULT 'WEB',
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,
    "authorId" TEXT,
    "kind" "public"."MsgKind" NOT NULL DEFAULT 'USER',
    "text" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Attachment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT,
    "messageId" TEXT,
    "url" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConversationTag" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "ConversationTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_guestKey_key" ON "public"."Conversation"("guestKey");

-- CreateIndex
CREATE INDEX "Conversation_status_updatedAt_idx" ON "public"."Conversation"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Conversation_assignedToId_status_idx" ON "public"."Conversation"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "Conversation_userId_status_idx" ON "public"."Conversation"("userId", "status");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "public"."Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Attachment_conversationId_idx" ON "public"."Attachment"("conversationId");

-- CreateIndex
CREATE INDEX "Attachment_messageId_idx" ON "public"."Attachment"("messageId");

-- CreateIndex
CREATE INDEX "ConversationTag_tag_idx" ON "public"."ConversationTag"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationTag_conversationId_tag_key" ON "public"."ConversationTag"("conversationId", "tag");

-- AddForeignKey
ALTER TABLE "public"."Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Conversation" ADD CONSTRAINT "Conversation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attachment" ADD CONSTRAINT "Attachment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConversationTag" ADD CONSTRAINT "ConversationTag_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
