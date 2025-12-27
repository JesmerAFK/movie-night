import { API_KEY, BASE_URL } from '../constants';
import { TMDBResponse, Movie } from '../types';

const fetchFromTMDB = async (endpoint: string): Promise<Movie[]> => {
  try {
    // Determine correctly if we need '?' or '&' to append parameters
    const separator = endpoint.includes('?') ? '&' : '?';
    const response = await fetch(`${BASE_URL}/${endpoint}${separator}api_key=${API_KEY}&language=en-US`);
    
    if (!response.ok) {
      console.warn(`TMDB API Error: ${response.status} for ${endpoint}`);
      return [];
    }
    
    const data: TMDBResponse = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Failed to fetch from TMDB:", error);
    return [];
  }
};

export const requests = {
  fetchTrending: () => fetchFromTMDB(`trending/all/week`),
  fetchTopRated: () => fetchFromTMDB(`movie/top_rated`),
  fetchActionMovies: () => fetchFromTMDB(`discover/movie?with_genres=28`),
  fetchComedyMovies: () => fetchFromTMDB(`discover/movie?with_genres=35`),
  fetchHorrorMovies: () => fetchFromTMDB(`discover/movie?with_genres=27`),
  fetchRomanceMovies: () => fetchFromTMDB(`discover/movie?with_genres=10749`),
  fetchDocumentaries: () => fetchFromTMDB(`discover/movie?with_genres=99`),
  searchMovies: async (query: string): Promise<Movie[]> => {
    if (!query) return [];
    try {
      const response = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`);
      if (!response.ok) return [];
      const data: TMDBResponse = await response.json();
      return data.results || [];
    } catch (error) {
      console.error("Search failed:", error);
      return [];
    }
  }
};

// We don't need getStreamUrl anymore as Player.tsx uses the ID directly with the embed service
export const getStreamUrl = async (title: string): Promise<string> => {
  return "";
};