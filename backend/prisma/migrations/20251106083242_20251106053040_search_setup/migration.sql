/*
  Warnings:

  - You are about to drop the column `search_text` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `search_vector` on the `Product` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Product_search_text_trgm_idx";

-- DropIndex
DROP INDEX "public"."Product_search_vector_idx";

-- AlterTable
ALTER TABLE "public"."Product" DROP COLUMN "search_text",
DROP COLUMN "search_vector";
