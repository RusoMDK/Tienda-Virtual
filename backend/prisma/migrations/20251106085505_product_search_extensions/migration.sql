-- This is an empty migration.-- 1) Extensiones necesarias (full-text + trigram)
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2) Columnas para búsqueda en "Product"
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "search_text"   text,
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

-- 3) Rellenar para datos ya existentes
UPDATE "Product"
SET
  "search_text" = unaccent(
    lower(
      trim(
        coalesce("name", '') || ' ' ||
        coalesce("description", '') || ' ' ||
        coalesce("brand", '')
      )
    )
  ),
  "search_vector" = to_tsvector('spanish', "search_text");

-- 4) Índices GIN para full-text y trigram
CREATE INDEX IF NOT EXISTS "Product_search_vector_idx"
  ON "Product" USING GIN ("search_vector");

CREATE INDEX IF NOT EXISTS "Product_search_text_trgm_idx"
  ON "Product" USING GIN ("search_text" gin_trgm_ops);

-- 5) Trigger para mantener search_text / search_vector siempre actualizados
CREATE OR REPLACE FUNCTION product_search_tsvector_trigger() RETURNS trigger AS $$
BEGIN
  NEW."search_text" = unaccent(
    lower(
      trim(
        coalesce(NEW."name", '') || ' ' ||
        coalesce(NEW."description", '') || ' ' ||
        coalesce(NEW."brand", '')
      )
    )
  );
  NEW."search_vector" = to_tsvector('spanish', NEW."search_text");
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_search_tsvector_update ON "Product";

CREATE TRIGGER product_search_tsvector_update
BEFORE INSERT OR UPDATE ON "Product"
FOR EACH ROW EXECUTE FUNCTION product_search_tsvector_trigger();
