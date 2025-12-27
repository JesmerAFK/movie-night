import React, { useRef, useState } from 'react';
import { Movie } from '../types';
import { POSTER_BASE_URL } from '../constants';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
    <div className="space-y-0.5 md:space-y-2 mb-8 group px-4 md:px-12">
      <h2 className="w-56 cursor-pointer text-sm font-semibold text-[#e5e5e5] transition duration-200 hover:text-white md:text-xl">
        {title}
      </h2>
      
      <div className="relative md:-ml-2">
        <ChevronLeft 
          className={`absolute top-0 bottom-0 left-2 z-40 m-auto h-9 w-9 cursor-pointer opacity-0 transition hover:scale-125 group-hover:opacity-100 ${!isMoved && 'hidden'}`} 
          onClick={() => handleClick('left')} 
        />
        
        <div 
          ref={rowRef}
          className="flex items-center space-x-2.5 overflow-x-scroll no-scrollbar md:space-x-4 md:p-2"
        >
          {movies.map((movie) => {
            if (!movie.poster_path && !movie.backdrop_path) return null;
            return (
              <div 
                key={movie.id} 
                className={`relative min-w-[140px] md:min-w-[180px] cursor-pointer transition duration-200 ease-out md:hover:scale-105`}
                onClick={() => onMovieClick(movie)}
              >
                <img
                  src={`${POSTER_BASE_URL}${isLargeRow ? movie.poster_path : movie.backdrop_path}`}
                  alt={movie.title || movie.name}
                  className="rounded-sm object-cover md:rounded"
                  loading="lazy"
                />
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
