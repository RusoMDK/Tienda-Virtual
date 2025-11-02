-- This is an empty migration.-- Habilita la extensión de trigram (solo se hace una vez por DB)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índices GIN de trigram para acelerar búsquedas tipo "contiene"
CREATE INDEX IF NOT EXISTS product_name_trgm_idx
  ON "Product" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS product_desc_trgm_idx
  ON "Product" USING GIN ("description" gin_trgm_ops);
