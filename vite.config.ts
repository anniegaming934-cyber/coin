// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ✅ Clean config for Vercel frontend + Express backend
export default defineConfig({
  plugins: [react()],

  // Optional: proxy /api requests during local development
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000", // backend dev server
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // ✅ Fix for client-side routing on Vercel (React Router, etc.)
  build: {
    outDir: "dist",
  },
});
