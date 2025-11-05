-- AlterTable
ALTER TABLE "public"."Address" ADD COLUMN     "geoPlaceId" TEXT,
ADD COLUMN     "geoProvider" TEXT,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "mapLabel" TEXT;
