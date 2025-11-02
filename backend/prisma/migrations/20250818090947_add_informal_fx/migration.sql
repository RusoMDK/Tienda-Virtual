-- CreateTable
CREATE TABLE "public"."InformalFx" (
    "key" TEXT NOT NULL DEFAULT 'current',
    "rate" DOUBLE PRECISION NOT NULL,
    "source" TEXT,
    "note" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InformalFx_pkey" PRIMARY KEY ("key")
);
