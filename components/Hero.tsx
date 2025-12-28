import React from 'react';
import { Movie } from '../types';
import { IMAGE_BASE_URL } from '../constants';
import { Play, Info } from 'lucide-react';

interface HeroProps {
  movie: Movie | null;
  onPlay: (movie: Movie) => void;
  onMoreInfo: (movie: Movie) => void;
}

const Hero: React.FC<HeroProps> = ({ movie, onPlay, onMoreInfo }) => {
  if (!movie) return <div className="h-[50vh] bg-[#141414] animate-pulse"></div>;

  const truncate = (str: string, n: number) => {
    return str?.length > n ? str.substr(0, n - 1) + "..." : str;
  };

  return (
    <header className="relative h-[56.25vw] max-h-[85vh] text-white object-contain">
      <div className="absolute top-0 left-0 w-full h-full">
        <img
          src={`${IMAGE_BASE_URL}${movie.backdrop_path}`}
          alt={movie.title || movie.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-transparent to-transparent opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/40 to-transparent" />
      </div>

      <div className="absolute top-[20%] sm:top-[25%] md:top-[30%] left-4 md:left-12 space-y-2 md:space-y-4 max-w-[90%] sm:max-w-xl z-20">
        <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold drop-shadow-lg leading-tight">
          {movie.title || movie.name || movie.original_title}
        </h1>

        <p className="text-[10px] sm:text-xs md:text-lg drop-shadow-md text-gray-200 line-clamp-3 md:line-clamp-4 lg:line-clamp-none max-w-sm sm:max-w-md md:max-w-none">
          {truncate(movie.overview, 200)}
        </p>

        <div className="flex space-x-2 md:space-x-3 pt-2 md:pt-4">
          <button
            onClick={() => onPlay(movie)}
            className="flex items-center px-3 sm:px-5 md:px-8 py-1.5 sm:py-2 md:py-3 bg-white text-black rounded hover:bg-opacity-80 transition font-bold text-xs sm:text-sm md:text-lg"
          >
            <Play className="w-3 h-3 sm:w-4 sm:h-4 md:w-6 md:h-6 mr-1.5 md:mr-2 fill-black" />
            Play
          </button>
          <button
            onClick={() => onMoreInfo(movie)}
            className="flex items-center px-3 sm:px-5 md:px-8 py-1.5 sm:py-2 md:py-3 bg-gray-500/70 text-white rounded hover:bg-gray-500/50 transition font-bold text-xs sm:text-sm md:text-lg"
          >
            <Info className="w-3 h-3 sm:w-4 sm:h-4 md:w-6 md:h-6 mr-1.5 md:mr-2" />
            More Info
          </button>
        </div>
      </div>
    </header>
  );
};

export default Hero;
