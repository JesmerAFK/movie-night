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
          src={`${IMAGE_BASE_URL}${movie.backdrop_path}`}
          alt={movie.title || movie.name}
          className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-[10s] ease-out"
        />
        {/* Complex Gradients for Premium Look */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/10 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent" />
      </div>

      <div className="absolute bottom-[10%] sm:bottom-[15%] left-6 md:left-12 space-y-4 md:space-y-6 max-w-[95%] sm:max-w-xl z-20 animate-in slide-in-from-bottom-5 duration-1000">
        <div className="flex items-center space-x-2">
          <div className="bg-[#e50914] text-white text-[8px] font-black italic px-1.5 py-0.5 rounded-sm shadow-lg">JMAFK ORIGINAL</div>
          {movie.vote_average > 0 && (
            <div className="flex items-center space-x-1 text-yellow-500 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
              <Star className="w-3 h-3 fill-current" />
              <span className="text-[10px] font-bold">{movie.vote_average.toFixed(1)}</span>
            </div>
          )}
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black drop-shadow-2xl leading-tight tracking-tighter uppercase">
          {movie.title || movie.name}
        </h1>

        <p className="text-xs sm:text-base md:text-lg drop-shadow-md text-gray-300 line-clamp-3 md:line-clamp-4 max-w-lg leading-relaxed font-medium">
          {movie.overview}
        </p>

        <div className="flex items-center space-x-3 pt-4">
          <button
            onClick={() => onPlay(movie)}
            className="flex items-center px-8 sm:px-10 py-3 sm:py-4 bg-white text-black rounded-2xl hover:bg-gray-200 transition-all font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 group/play"
          >
            <Play className="w-5 h-5 mr-3 fill-black group-hover:scale-110 transition-transform" />
            Watch Now
          </button>
          <button
            onClick={() => onMoreInfo(movie)}
            className="flex items-center px-5 sm:px-6 py-3 sm:py-4 bg-white/10 backdrop-blur-xl text-white rounded-2xl border border-white/10 hover:bg-white/20 transition-all font-bold text-sm"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Hero;
