// src/routes/search.ts
import type { FastifyPluginAsync } from "fastify";
import searchProductsRoutes from "./searchProducts.js";
import searchSuggestRoutes from "./searchSuggest.js";

const searchRoutes: FastifyPluginAsync = async (app) => {
  // OJO: el prefix "/search" ya viene desde server.ts
  await app.register(searchProductsRoutes);
  await app.register(searchSuggestRoutes);
};

export default searchRoutes;
