export const API_KEY = "95f2419536f533cdaa1dadf83c606027";
export const BASE_URL = "https://api.themoviedb.org/3";
export const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/original";
export const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

// IMPORTANT: Replace this with your actual deployed backend URL (e.g. https://my-app.railway.app)
// For local development, we dynamically use the current hostname (localhost or IP)
// Use your deployed backend URL (e.g. from Render or Railway)
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://localhost:8000");