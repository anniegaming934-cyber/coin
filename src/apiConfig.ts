export const API_BASE =
  import.meta.env.VITE_API_BASEURL ||
  (import.meta.env.DEV ? "http://localhost:5000" : "");
