import React, { useRef, useState } from 'react';
import { Movie } from '../types';
import { IMAGE_BASE_URL } from '../constants';
import { ChevronLeft, ChevronRight, ChevronDown, Play, Plus, Info, Star } from 'lucide-react';

interface RowProps {
  title: string;
  movies: Movie[];
  onMovieClick: (movie: Movie) => void;
  isLargeRow?: boolean;
}

const Row: React.FC<RowProps> = ({ title, movies, onMovieClick, isLargeRow }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [isMoved, setIsMoved] = useState(false);

  const handleClick = (direction: 'left' | 'right') => {
    setIsMoved(true);
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo = direction === 'left'
        ? scrollLeft - clientWidth / 2
        : scrollLeft + clientWidth / 2;

      rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-1 md:space-y-2 mb-8 group px-4 md:px-12">
      <h2 className="w-full cursor-pointer text-base font-semibold text-[#e5e5e5] transition duration-200 hover:text-white md:text-2xl lg:text-3xl mb-1 md:mb-3">
        {title}
      </h2>

      <div className="relative md:-ml-2">
        <ChevronLeft
          className={`absolute top-0 bottom-0 left-2 z-40 m-auto h-9 w-9 cursor-pointer opacity-0 transition hover:scale-125 group-hover:opacity-100 ${!isMoved && 'hidden'}`}
          onClick={() => handleClick('left')}
        />

        <div
          ref={rowRef}
          className="flex items-center space-x-2 overflow-x-scroll no-scrollbar md:space-x-2 py-4 px-2"
        >
          {movies.map((movie) => {
            if (!movie.poster_path && !movie.backdrop_path) return null;
            const releaseYear = (movie.release_date || movie.first_air_date || '').split('-')[0];
            const movieTitle = movie.title || movie.name;

            return (
              <div
                key={movie.id}
                className={`relative min-w-[130px] sm:min-w-[150px] md:min-w-[170px] lg:min-w-[190px] aspect-[2/3] cursor-pointer transition-all duration-300 ease-out hover:z-50 hover:scale-105 group/item mx-1`}
                onClick={() => onMovieClick(movie)}
              >
                <img
                  src={`${IMAGE_BASE_URL}w342${movie.poster_path || movie.backdrop_path}`}
                  alt={movieTitle}
                  className="rounded-lg object-cover shadow-lg w-full h-full border border-white/[0.06]"
                  loading="lazy"
                />

                {/* Hover Overlay - stays on same image */}
                <div className="absolute inset-0 rounded-lg overflow-hidden opacity-0 group-hover/item:opacity-100 transition-all duration-300 pointer-events-none">
                  {/* Dark gradient from bottom */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                  
                  {/* Play button centered */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm">
                      <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                    </div>
                  </div>

                  {/* Bottom info */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1">
                    <h3 className="text-white font-bold text-xs truncate drop-shadow-lg">
                      {movieTitle}
                    </h3>
                    <div className="flex items-center space-x-2 text-[10px]">
                      <span className="text-green-400 font-bold">{Math.round((movie.vote_average || 0) * 10)}%</span>
                      <span className="text-white/60">{releaseYear}</span>
                      <span className="border border-white/30 px-1 rounded text-[8px] text-white/50">HD</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <ChevronRight
          className="absolute top-0 bottom-0 right-2 z-40 m-auto h-9 w-9 cursor-pointer opacity-0 transition hover:scale-125 group-hover:opacity-100"
          onClick={() => handleClick('right')}
        />
      </div>
    </div>
  );
};

export default Row;
