import React, { useRef, useState } from 'react';
import { Movie } from '../types';
import { POSTER_BASE_URL } from '../constants';
import { ChevronLeft, ChevronRight, Play, Plus, Info, Star } from 'lucide-react';

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
          className="flex items-center space-x-2.5 overflow-x-scroll no-scrollbar md:space-x-4 md:p-2 py-4"
        >
          {movies.map((movie) => {
            if (!movie.poster_path && !movie.backdrop_path) return null;
            const releaseYear = (movie.release_date || movie.first_air_date || '').split('-')[0];
            const movieTitle = movie.title || movie.name;

            return (
              <div
                key={movie.id}
                className={`relative min-w-[130px] sm:min-w-[160px] md:min-w-[200px] lg:min-w-[240px] cursor-pointer transition duration-300 ease-out hover:scale-110 hover:z-50 group/item`}
                onClick={() => onMovieClick(movie)}
              >
                <img
                  src={`${POSTER_BASE_URL}${isLargeRow ? movie.poster_path : movie.backdrop_path}`}
                  alt={movieTitle}
                  className="rounded-sm object-cover md:rounded shadow-lg w-full h-auto"
                  loading="lazy"
                />

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 rounded md:rounded flex flex-col justify-end p-2 md:p-4">
                  <h3 className="text-white font-bold text-xs md:text-sm lg:text-base line-clamp-2 mb-1">
                    {movieTitle}
                  </h3>
                  <div className="flex items-center space-x-2 text-[10px] md:text-xs text-gray-300">
                    <span className="text-green-400 font-semibold">{Math.round((movie.vote_average || 0) * 10)}% Match</span>
                    <span>{releaseYear}</span>
                    <div className="flex items-center border border-gray-500 px-1 rounded-sm text-[8px] md:text-[10px]">
                      HD
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <div className="p-1 md:p-1.5 bg-white rounded-full hover:bg-gray-200 transition">
                      <Play className="w-3 h-3 md:w-4 md:h-4 text-black fill-black" />
                    </div>
                    <div className="p-1 md:p-1.5 border-2 border-gray-400 rounded-full hover:border-white transition">
                      <Plus className="w-3 h-3 md:w-4 md:h-4 text-white" />
                    </div>
                    <div className="flex-grow" />
                    <div className="p-1 md:p-1.5 border-2 border-gray-400 rounded-full hover:border-white transition">
                      <Info className="w-3 h-3 md:w-4 md:h-4 text-white" />
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
