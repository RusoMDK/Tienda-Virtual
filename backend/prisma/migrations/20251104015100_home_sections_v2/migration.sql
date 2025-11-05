/*
  Warnings:

  - You are about to drop the column `kind` on the `home_sections` table. All the data in the column will be lost.
  - You are about to drop the column `visible` on the `home_sections` table. All the data in the column will be lost.
  - The `layout` column on the `home_sections` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[slug]` on the table `home_sections` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `home_sections` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `home_sections` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."HomeSectionType" AS ENUM ('HERO', 'PRODUCT_GRID', 'PRODUCT_STRIP', 'CATEGORY_STRIP', 'BANNER', 'TEXT_BLOCK');

-- DropIndex
DROP INDEX "public"."home_sections_kind_visible_position_idx";

-- AlterTable
ALTER TABLE "public"."home_sections" DROP COLUMN "kind",
DROP COLUMN "visible",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "config" JSONB,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "type" "public"."HomeSectionType" NOT NULL,
ALTER COLUMN "title" DROP NOT NULL,
DROP COLUMN "layout",
ADD COLUMN     "layout" JSONB,
ALTER COLUMN "position" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "home_sections_slug_key" ON "public"."home_sections"("slug");

-- CreateIndex
CREATE INDEX "home_sections_active_position_createdAt_idx" ON "public"."home_sections"("active", "position", "createdAt");
