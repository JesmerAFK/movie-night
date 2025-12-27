import React from 'react';
import { Movie } from '../types';
import { IMAGE_BASE_URL } from '../constants';
import { X, Play, Plus, ThumbsUp, Check } from 'lucide-react';

interface ModalProps {
    movie: Movie;
    onClose: () => void;
    onPlay: (movie: Movie) => void;
    isAddedToList: boolean;
    onToggleList: () => void;
}

const Modal: React.FC<ModalProps> = ({ movie, onClose, onPlay, isAddedToList, onToggleList }) => {
    const percentage = Math.round(movie.vote_average * 10);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/60 backdrop-blur-sm p-4">
            {/* Click outside to close */}
            <div className="fixed inset-0" onClick={onClose}></div>

            <div className="relative w-full max-w-[850px] bg-[#181818] rounded-md shadow-2xl overflow-hidden transform transition-all animate-fadeIn">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-[#181818] hover:bg-[#181818]/80 cursor-pointer"
                >
                    <X className="h-6 w-6 text-white" />
                </button>

                <div className="relative pt-[56.25%]">
                    <img
                        src={`${IMAGE_BASE_URL}${movie.backdrop_path || movie.poster_path}`}
                        alt={movie.title || movie.name}
                        className="absolute top-0 left-0 h-full w-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-[#181818] to-transparent"></div>

                    <div className="absolute bottom-10 left-10 space-y-4">
                        <h2 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg max-w-lg">
                            {movie.title || movie.name}
                        </h2>
                        <div className="flex space-x-3">
                            <button
                                onClick={() => onPlay(movie)}
                                className="flex items-center gap-x-2 rounded bg-white px-8 py-2 text-xl font-bold text-black transition hover:bg-[#e6e6e6]"
                            >
                                <Play className="h-7 w-7 fill-black" />
                                Play
                            </button>
                            <button
                                onClick={onToggleList}
                                className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[gray] bg-[#2a2a2a]/60 transition hover:border-white hover:bg-white/10"
                                title={isAddedToList ? "Remove from List" : "Add to List"}
                            >
                                {isAddedToList ? <Check className="h-6 w-6 text-white" /> : <Plus className="h-6 w-6 text-white" />}
                            </button>
                            <button className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[gray] bg-[#2a2a2a]/60 transition hover:border-white hover:bg-white/10">
                                <ThumbsUp className="h-6 w-6 text-white" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-x-8 px-10 py-8">
                    <div className="space-y-4">
                        <div className="flex items-center space-x-4 text-sm">
                            <span className="text-green-500 font-semibold">{percentage}% Match</span>
                            <span className="text-gray-400">{movie.release_date?.substring(0, 4) || movie.first_air_date?.substring(0, 4)}</span>
                            <span className="border border-gray-400 px-1 text-xs text-gray-400 rounded">HD</span>
                        </div>
                        <p className="text-white text-base leading-relaxed">
                            {movie.overview}
                        </p>
                    </div>

                    <div className="text-sm space-y-4 text-gray-400">
                        <div>
                            <span className="text-gray-500">Genres: </span>
                            {/* We don't have genre names in the simple Movie object, usually would fetch detailed info. Simulating here. */}
                            <span className="text-white">Action, Thriller, Drama</span>
                        </div>
                        <div>
                            <span className="text-gray-500">Original Language: </span>
                            <span className="text-white uppercase">{movie.original_title ? 'EN' : 'EN'}</span>
                        </div>
                        <div>
                            <span className="text-gray-500">Total Votes: </span>
                            <span className="text-white">{movie.vote_average} ({percentage * 10})</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Modal;
