export const API_KEY = "95f2419536f533cdaa1dadf83c606027";
export const BASE_URL = "https://api.themoviedb.org/3";
export const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/original";
export const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

// For local development, use localhost, otherwise use the production backend
export const BACKEND_URL = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? "http://localhost:8000"
    : "https://movie-night-production-51e0.up.railway.app";