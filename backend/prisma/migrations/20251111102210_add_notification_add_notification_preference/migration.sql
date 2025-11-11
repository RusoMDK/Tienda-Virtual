-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('ORDER_CREATED', 'ORDER_PAID', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'ORDER_CANCELLED', 'PAYMENT_FAILED', 'ACCOUNT_PASSWORD_CHANGED', 'ACCOUNT_EMAIL_CHANGED', 'NEW_LOGIN', 'WISHLIST_ITEM_ON_SALE', 'WISHLIST_ITEM_BACK_IN_STOCK', 'PROMOTION_COUPON', 'SUPPORT_MESSAGE_REPLY');

-- CreateEnum
CREATE TYPE "public"."NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH');

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "channel" "public"."NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailOrderUpdates" BOOLEAN NOT NULL DEFAULT true,
    "emailSecurityAlerts" BOOLEAN NOT NULL DEFAULT true,
    "emailPromotions" BOOLEAN NOT NULL DEFAULT false,
    "inAppOrderUpdates" BOOLEAN NOT NULL DEFAULT true,
    "inAppSecurityAlerts" BOOLEAN NOT NULL DEFAULT true,
    "inAppPromotions" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_archived_isRead_createdAt_idx" ON "public"."Notification"("userId", "archived", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "public"."Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "public"."NotificationPreference"("userId");

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
