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
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
      </div>

      <div className="absolute top-[30%] md:top-[40%] left-4 md:left-12 space-y-4 max-w-xl">
        <h1 className="text-3xl md:text-5xl font-bold drop-shadow-lg">
          {movie.title || movie.name || movie.original_title}
        </h1>
        
        <p className="text-xs md:text-lg drop-shadow-md text-gray-200 line-clamp-3 md:line-clamp-none">
          {truncate(movie.overview, 150)}
        </p>

        <div className="flex space-x-3 pt-4">
          <button 
            onClick={() => onPlay(movie)}
            className="flex items-center px-4 md:px-7 py-2 md:py-3 bg-white text-black rounded hover:bg-opacity-80 transition font-bold text-sm md:text-lg"
          >
            <Play className="w-4 h-4 md:w-6 md:h-6 mr-2 fill-black" />
            Play
          </button>
          <button 
            onClick={() => onMoreInfo(movie)}
            className="flex items-center px-4 md:px-7 py-2 md:py-3 bg-gray-500/70 text-white rounded hover:bg-gray-500/50 transition font-bold text-sm md:text-lg"
          >
            <Info className="w-4 h-4 md:w-6 md:h-6 mr-2" />
            More Info
          </button>
        </div>
      </div>
    </header>
  );
};

export default Hero;
