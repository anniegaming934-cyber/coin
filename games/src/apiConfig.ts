// src/apiConfig.ts
import axios from "axios";

/**
 * ✅ Smart base URL logic
 * - Dev: localhost backend
 * - Prod: Railway from env or fallback constant
 * - We append /api here so calls can use short paths ("/auth/me")
 */
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://coin-backend-production-9573.up.railway.app");

export const apiClient = axios.create({
  baseURL: `${API_BASE}`,
  withCredentials: false,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
