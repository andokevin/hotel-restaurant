import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// En développement, le front (5173) transmet /api à la gateway (3000).
// Front et API partagent ainsi la même origine : le cookie de session
// (httpOnly, SameSite=Strict, Path=/api/auth) est bien envoyé par le navigateur.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Une seule application d'environ 500 ko : pas besoin de découper le bundle pour ce projet.
  build: { chunkSizeWarningLimit: 800 },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
