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
  fetchSciFi: () => fetchFromTMDB(`discover/movie?with_genres=878`),
  fetchAnimation: () => fetchFromTMDB(`discover/movie?with_genres=16`),
  fetchMystery: () => fetchFromTMDB(`discover/movie?with_genres=9648`),
  fetchTVShows: () => fetchFromTMDB(`tv/popular`),
  fetchFamily: () => fetchFromTMDB(`discover/movie?with_genres=10751`),
  fetchDetails: async (id: number, type: 'movie' | 'tv'): Promise<Movie | null> => {
    try {
      const response = await fetch(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}&language=en-US`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error("Failed to fetch details:", error);
      return null;
    }
  },
  searchMovies: async (query: string): Promise<Movie[]> => {
    if (!query) return [];
    try {
      // Search for both movies and TV shows
      const [movieRes, tvRes] = await Promise.all([
        fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`),
        fetch(`${BASE_URL}/search/tv?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`)
      ]);

      const movieData = await movieRes.json();
      const tvData = await tvRes.json();

      const results = [...(movieData.results || []), ...(tvData.results || [])];
      // Sort by popularity
      return results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
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