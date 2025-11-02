// vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Puedes sobreescribir el backend con VITE_API_TARGET, si no → localhost:4000
  const apiTarget = env.VITE_API_TARGET || "http://localhost:4000";

  return {
    plugins: [react(), tsconfigPaths()],

    // 🔥 Dev server “misma origin” con proxy → adiós CORS y cookies raras
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      // útil si corres dentro de Docker/WSL
      hmr: { clientPort: 5173 },
      proxy: {
        // Todo lo que empiece con /api va al backend y se reescribe
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        // Si usas el image proxy del backend (/img/...)
        "/img": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },

    // Para `vite preview` mantener el mismo comportamiento
    preview: {
      port: 5173,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/img": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },

    // Calidad de vida
    css: {
      devSourcemap: true,
    },
    build: {
      sourcemap: true, // útil para depurar en staging
      chunkSizeWarningLimit: 1000,
    },

    // Ejemplo de constante global (opcional, por si quieres mostrar versión)
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
  };
});
