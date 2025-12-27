export interface Movie {
  id: number;
  title: string;
  name?: string; // TV shows use 'name'
  original_title?: string;
  backdrop_path: string | null;
  poster_path: string | null;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids: number[];
  media_type?: 'movie' | 'tv';
}

export interface MovieDetails extends Movie {
  genres: { id: number; name: string }[];
  runtime?: number;
}

export interface TMDBResponse {
  page: number;
  results: Movie[];
  total_pages: number;
  total_results: number;
}

export interface Genre {
  id: number;
  name: string;
}

export enum RequestType {
  Trending = 'trending/all/week',
  NetflixOriginals = 'discover/tv?with_networks=213',
  TopRated = 'movie/top_rated',
  ActionMovies = 'discover/movie?with_genres=28',
  ComedyMovies = 'discover/movie?with_genres=35',
  HorrorMovies = 'discover/movie?with_genres=27',
  RomanceMovies = 'discover/movie?with_genres=10749',
  Documentaries = 'discover/movie?with_genres=99',
}