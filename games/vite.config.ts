// vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// ✅ Dynamic config that adapts between dev and production
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Use your backend URL in production
  const apiBase =
    mode === "development"
      ? "http://localhost:5000"
      : env.VITE_API_BASE_URL || "";

  return {
    plugins: [react()],

    // ✅ Proxy only during local development
    server: {
      proxy: {
        "/api": {
          target: apiBase,
          changeOrigin: true,
          secure: false,
        },
      },
    },

    // ✅ Ensures clean routing on Vercel (React Router)
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },

    // ✅ Optional: if your app is hosted at a subpath (usually not needed)
    base: "./",
  };
});
