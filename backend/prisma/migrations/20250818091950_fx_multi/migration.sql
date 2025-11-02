-- ─────────────────────────────────────────────
-- INFORMAL FX: migrar a PK por 'code' (seguro)
-- ─────────────────────────────────────────────

-- 1) Agrega 'code' (NULL temporalmente para no romper si hay filas)
ALTER TABLE "public"."InformalFx"
  ADD COLUMN IF NOT EXISTS "code" TEXT;

-- 2) Backfill de 'code' usando la columna previa si existía (key) o 'USD' por defecto
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'InformalFx' AND column_name = 'key'
  ) THEN
    UPDATE "public"."InformalFx" SET "code" = "key" WHERE "code" IS NULL;
  END IF;

  -- Si aún queda NULL (no había 'key' o estaba vacío), usa 'USD'
  UPDATE "public"."InformalFx" SET "code" = 'USD' WHERE "code" IS NULL;
END$$;

-- 3) Quita la PK actual (si existe)
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public."InformalFx"'::regclass AND contype = 'p';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public."InformalFx" DROP CONSTRAINT %I', cname);
  END IF;
END$$;

-- 4) Limpia columnas viejas
ALTER TABLE "public"."InformalFx"
  DROP COLUMN IF EXISTS "key",
  DROP COLUMN IF EXISTS "note";

-- 5) 'code' ahora sí NOT NULL
ALTER TABLE "public"."InformalFx"
  ALTER COLUMN "code" SET NOT NULL;

-- 6) Nueva PK en 'code'
ALTER TABLE "public"."InformalFx"
  ADD CONSTRAINT "InformalFx_pkey" PRIMARY KEY ("code");

-- 7) Garantiza columnas auxiliares (idempotente)
ALTER TABLE "public"."InformalFx"
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "effectiveAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now();
