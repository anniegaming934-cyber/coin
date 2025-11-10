// src/apiconfig.ts
import axios from "axios";

export const API_BASE =
  import.meta.env.VITE_API_BASEURL ||
  (import.meta.env.DEV
    ? "http://localhost:5000"
    : "https://coin-backend-production-3480.up.railway.app");

// Optional: axios instance with baseURL set
export const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: false, // or true if you need cookies
});
