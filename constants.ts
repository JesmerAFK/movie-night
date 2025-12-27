export const API_KEY = "95f2419536f533cdaa1dadf83c606027";
export const BASE_URL = "https://api.themoviedb.org/3";
export const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/original";
export const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

// IMPORTANT: Replace this with your actual deployed backend URL (e.g. https://my-app.railway.app)
// For local development, we dynamically use the current hostname (localhost or IP)
// Use your live Render backend URL or a Tunnel URL (ngrok/localtunnel)
export const BACKEND_URL = (typeof window !== 'undefined' && (window as any).MB_BACKEND_URL)
  ? (window as any).MB_BACKEND_URL
  : "https://movie-night-xe5i.onrender.com";