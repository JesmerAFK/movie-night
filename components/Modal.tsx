import React, { useState, useEffect } from 'react';
import { Movie } from '../types';
import { IMAGE_BASE_URL } from '../constants';
import { X, Play, Plus, ThumbsUp, Check, Info } from 'lucide-react';
import { BACKEND_URL } from '../constants';
import AdContainer from './AdContainer';

interface ModalProps {
    movie: Movie;
    onClose: () => void;
    onPlay: (movie: Movie, season?: number, episode?: number) => void;
    isAddedToList: boolean;
    onToggleList: () => void;
}

const Modal: React.FC<ModalProps> = ({ movie, onClose, onPlay, isAddedToList, onToggleList }) => {
    const [metadata, setMetadata] = useState<any>(null);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [loading, setLoading] = useState(false);

    const percentage = Math.round(movie.vote_average * 10);
    const isTV = movie.first_air_date !== undefined || (metadata && metadata.is_tv);
    const movieTitle = movie.title || movie.name || movie.original_title || "Untitled";

    useEffect(() => {
        const titleToSearch = movie.title || movie.name || "";
        const year = movie.release_date ? movie.release_date.split('-')[0] : (movie.first_air_date ? movie.first_air_date.split('-')[0] : undefined);

        setLoading(true);
        fetch(`${BACKEND_URL}/api/metadata?title=${encodeURIComponent(titleToSearch)}${year ? `&year=${year}` : ''}`)
            .then(res => res.json())
            .then(data => {
                setMetadata(data);
                if (data && data.is_tv && data.seasons && data.seasons.length > 0) {
                    setSelectedSeason(data.seasons[0].season);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Metadata error:", err);
                setLoading(false);
            });
    }, [movie]);

    const currentSeasonData = metadata?.seasons?.find((s: any) => s.season === selectedSeason);
    const episodes = currentSeasonData ? Array.from({ length: currentSeasonData.episodes_count }, (_, i) => i + 1) : [];

    return (
        <div className="fixed inset-0 z-[100] flex justify-center overflow-y-auto overflow-x-hidden bg-black/80 backdrop-blur-md px-0 py-4 sm:p-8 md:p-12">
            {/* Backdrop click to close */}
            <div className="fixed inset-0 -z-10" onClick={onClose}></div>

            <div className="relative w-full max-w-[900px] h-fit bg-[#181818] rounded-xl shadow-2xl overflow-hidden animate-fadeIn mb-12 border border-white/5">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-[110] flex h-10 w-10 items-center justify-center rounded-full bg-[#181818]/80 hover:bg-black border border-white/20 transition-all active:scale-95"
                >
                    <X className="h-6 w-6 text-white" />
                </button>

                {/* Banner Section */}
                <div className="relative w-full aspect-video bg-[#242424]">
                    {(movie.backdrop_path || movie.poster_path) && (
                        <img
                            src={`${IMAGE_BASE_URL}${movie.backdrop_path || movie.poster_path}`}
                            alt={movieTitle}
                            className="w-full h-full object-cover"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                    )}
                    {/* Dark Gradients */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/40 to-transparent" />
                    <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />

                    {/* Banner Content */}
                    <div className="absolute bottom-6 md:bottom-12 left-6 md:left-12 space-y-4 md:space-y-6 max-w-[90%] z-10">
                        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
                            {movieTitle}
                        </h2>
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={() => onPlay(movie, isTV ? selectedSeason : undefined, isTV ? 1 : undefined)}
                                className="flex items-center gap-x-2 rounded bg-white px-6 md:px-10 py-1.5 md:py-3 text-lg md:text-xl font-bold text-black transition hover:bg-white/80 active:scale-95"
                            >
                                <Play className="h-6 w-6 md:h-8 md:w-8 fill-black" />
                                Play
                            </button>
                            <button
                                onClick={onToggleList}
                                className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full border-2 border-gray-400 bg-[#2a2a2a]/60 text-white transition hover:border-white hover:bg-white/10"
                            >
                                {isAddedToList ? <Check className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                            </button>
                            <button className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full border-2 border-gray-400 bg-[#2a2a2a]/60 text-white transition hover:border-white hover:bg-white/10">
                                <ThumbsUp className="h-6 w-6" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Details Section */}
                <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-x-12 px-6 md:px-12 py-10 transition-all">
                    <div className="space-y-6">
                        <div className="flex items-center space-x-4 text-sm font-semibold">
                            <span className="text-green-500">{percentage}% Match</span>
                            <span className="text-gray-400">{movie.release_date?.substring(0, 4) || movie.first_air_date?.substring(0, 4)}</span>
                            <span className="px-1.5 py-0.5 border border-gray-500 text-xs text-gray-400 rounded">HD</span>
                        </div>
                        <p className="text-white text-base md:text-lg leading-relaxed font-medium">
                            {movie.overview}
                        </p>
                    </div>

                    <div className="mt-8 md:mt-0 space-y-4 border-l border-gray-800 md:pl-8">
                        <div className="text-sm">
                            <span className="text-gray-500">Genres: </span>
                            <span className="text-white">Action, Adventure, Sci-Fi</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-gray-500">Original Language: </span>
                            <span className="text-white uppercase">{movie.original_language || 'en'}</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-gray-500">Popularity Score: </span>
                            <span className="text-white">{Math.round(movie.popularity || 0)}</span>
                        </div>
                    </div>
                </div>

                {/* Episodes Section - Only if TV Series */}
                {isTV && (
                    <div className="px-6 md:px-12 pb-20 border-t border-gray-800/50 mt-4">
                        <div className="flex items-center justify-between py-10">
                            <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Episodes</h3>
                            {metadata?.seasons?.length > 1 && (
                                <select
                                    value={selectedSeason}
                                    onChange={(e) => setSelectedSeason(Number(e.target.value))}
                                    className="bg-[#242424] text-white border border-gray-600 rounded px-4 py-2 text-base outline-none focus:border-white transition cursor-pointer hover:bg-black/40"
                                >
                                    {metadata.seasons.map((s: any) => (
                                        <option key={s.season} value={s.season}>Season {s.season}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="space-y-3">
                            {loading ? (
                                <div className="py-24 flex flex-col items-center justify-center space-y-4">
                                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-red-600 border-r-2"></div>
                                    <p className="text-gray-500 animate-pulse font-medium">Crunching episode data...</p>
                                </div>
                            ) : (
                                episodes.map((ep) => (
                                    <div
                                        key={ep}
                                        onClick={() => onPlay(movie, selectedSeason, ep)}
                                        className="group flex flex-col sm:flex-row items-center p-4 md:p-6 rounded-xl hover:bg-white/5 transition-all duration-300 cursor-pointer border border-transparent hover:border-white/10"
                                    >
                                        <div className="hidden sm:block text-gray-500 font-bold text-2xl w-14 text-center mr-4 group-hover:text-white transition">
                                            {ep}
                                        </div>
                                        <div className="relative w-full sm:w-56 aspect-video rounded-lg overflow-hidden bg-[#242424] sm:mr-8 mb-4 sm:mb-0 shadow-lg">
                                            <img
                                                src={`${IMAGE_BASE_URL}${movie.backdrop_path}`}
                                                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition duration-500 scale-100 group-hover:scale-110"
                                                alt={`Episode ${ep}`}
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 duration-300">
                                                <div className="p-3 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 shadow-2xl transform scale-75 group-hover:scale-100 transition-transform duration-300">
                                                    <Play className="w-8 h-8 text-white fill-white ml-1" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex-1 w-full text-center sm:text-left">
                                            <div className="flex items-center justify-center sm:justify-between mb-2">
                                                <h4 className="text-white font-bold text-xl group-hover:text-green-400 transition">Episode {ep}</h4>
                                            </div>
                                            <p className="text-gray-400 text-sm md:text-base line-clamp-2 md:line-clamp-3 leading-relaxed">
                                                {movie.overview}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                            {!loading && episodes.length === 0 && (
                                <div className="text-center py-24 bg-white/5 rounded-2xl border border-dashed border-gray-800">
                                    <Info className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                    <p className="text-gray-500 font-medium text-lg">Detailed data for Season {selectedSeason} is coming soon.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="px-6 md:px-12 pb-8">
                    <AdContainer type="native" />
                </div>
            </div>
        </div>
    );
};

export default Modal;
