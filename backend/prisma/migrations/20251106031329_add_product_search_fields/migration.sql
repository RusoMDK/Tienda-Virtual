-- CreateEnum
CREATE TYPE "public"."ProductCondition" AS ENUM ('NEW', 'USED', 'REFURBISHED');

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "condition" "public"."ProductCondition" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Product_active_ratingAvg_idx" ON "public"."Product"("active", "ratingAvg");

-- CreateIndex
CREATE INDEX "Product_brand_active_idx" ON "public"."Product"("brand", "active");
