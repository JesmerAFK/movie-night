import React from 'react';
import { Movie } from '../types';
import { IMAGE_BASE_URL } from '../constants';
import { Play, Info, Star } from 'lucide-react';

interface HeroProps {
  movie: Movie | null;
  onPlay: (movie: Movie) => void;
  onMoreInfo: (movie: Movie) => void;
}

const Hero: React.FC<HeroProps> = ({ movie, onPlay, onMoreInfo }) => {
  if (!movie) return <div className="h-[70vh] bg-[#141414] animate-pulse"></div>;

  return (
    <header className="relative h-[85vh] text-white overflow-hidden group">
      <div className="absolute top-0 left-0 w-full h-full">
        <img
          src={`${IMAGE_BASE_URL}w1280${movie.backdrop_path || movie.poster_path}`}
          alt={movie.title || movie.name}
          className="w-full h-full object-cover"
        />
        {/* Complex Gradients for Premium Look */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
      </div>

      <div className="absolute bottom-[10%] sm:bottom-[20%] left-6 md:left-12 space-y-4 md:space-y-6 max-w-[95%] sm:max-w-2xl z-20">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold drop-shadow-2xl leading-tight">
          {movie.title || movie.name}
        </h1>

        <p className="text-sm sm:text-base md:text-lg drop-shadow-md text-white line-clamp-3 md:line-clamp-4 max-w-lg leading-relaxed font-medium">
          {movie.overview}
        </p>

        <div className="flex items-center space-x-3 pt-4">
          <button
            onClick={() => onPlay(movie)}
            className="flex items-center px-6 sm:px-8 py-2.5 sm:py-3 bg-white text-black rounded hover:bg-white/80 transition-all font-bold text-lg active:scale-95 shadow-lg"
          >
            <Play className="w-6 h-6 mr-2 fill-black" />
            Play
          </button>
          <button
            onClick={() => onMoreInfo(movie)}
            className="flex items-center px-6 sm:px-8 py-2.5 sm:py-3 bg-[#6d6d6eb3] hover:bg-[#6d6d6e66] text-white rounded transition-all font-bold text-lg"
          >
            <Info className="w-6 h-6 mr-2" />
            More Info
          </button>
        </div>
      </div>
    </header>
  );
};

export default Hero;
