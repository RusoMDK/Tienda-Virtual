/*
  Warnings:

  - A unique constraint covering the columns `[publicId]` on the table `ProductImage` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[productId,position]` on the table `ProductImage` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."ProductImage" ADD COLUMN     "publicId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_publicId_key" ON "public"."ProductImage"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_productId_position_key" ON "public"."ProductImage"("productId", "position");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "public"."RefreshToken"("expiresAt");
