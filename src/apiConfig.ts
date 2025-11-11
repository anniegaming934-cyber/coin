// src/apiConfig.ts
import axios from "axios";

/**
 * ✅ Smart base URL logic
 * - In development: uses localhost backend
 * - In production (Vercel): uses your Railway backend URL (via env)
 * - Supports either with or without /api prefix
 */
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || // ✅ read from .env or Vercel Env Var
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000" // local backend
    : "https://coin-backend-production-9573.up.railway.app"); // production backend

// ✅ Preconfigured axios instance
export const apiClient = axios.create({
  baseURL: API_BASE, // automatically includes /api
  withCredentials: false, // set true only if backend sets cookies
  headers: {
    "Content-Type": "application/json",
  },
});

// Optional helper: add token automatically if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
