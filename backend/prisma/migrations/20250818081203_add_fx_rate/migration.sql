-- CreateTable
CREATE TABLE "public"."FxRate" (
    "id" TEXT NOT NULL,
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "rate" DECIMAL(10,4) NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FxRate_base_quote_effectiveAt_idx" ON "public"."FxRate"("base", "quote", "effectiveAt" DESC);
