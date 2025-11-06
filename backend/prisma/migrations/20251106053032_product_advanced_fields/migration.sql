-- CreateEnum
CREATE TYPE "public"."ConditionGrade" AS ENUM ('LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE');

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "colorVariants" JSONB,
ADD COLUMN     "conditionGrade" "public"."ConditionGrade",
ADD COLUMN     "conditionNote" TEXT,
ADD COLUMN     "deliveryArea" JSONB,
ADD COLUMN     "homeDeliveryAvailable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mainColor" VARCHAR(32),
ADD COLUMN     "storePickupAvailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "warrantyDescription" TEXT,
ADD COLUMN     "warrantyMonths" INTEGER,
ADD COLUMN     "warrantyType" TEXT;

-- CreateIndex
CREATE INDEX "Product_mainColor_active_idx" ON "public"."Product"("mainColor", "active");
