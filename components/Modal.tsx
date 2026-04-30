import React, { useState, useEffect } from 'react';
import { Movie } from '../types';
import { IMAGE_BASE_URL } from '../constants';
import { X, Play, Plus, ThumbsUp, Check, Info, Star, Calendar, Globe, TrendingUp } from 'lucide-react';
import { requests } from '../services/api';

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

    const isTV = movie.first_air_date !== undefined || movie.name !== undefined;
    const movieTitle = movie.title || movie.name || movie.original_title || "Untitled";

    useEffect(() => {
        setLoading(true);
        const type = isTV ? 'tv' : 'movie';
        requests.fetchDetails(movie.id, type).then(data => {
            if (data) {
                setMetadata(data);
                if (isTV && (data as any).seasons && (data as any).seasons.length > 0) {
                    // Filter out "Season 0" (Specials) if preferred, or just pick first
                    const firstSeason = (data as any).seasons.find((s: any) => s.season_number > 0) || (data as any).seasons[0];
                    setSelectedSeason(firstSeason.season_number);
                }
            }
            setLoading(false);
        }).catch(err => {
            console.error("Metadata error:", err);
            setLoading(false);
        });
    }, [movie.id, isTV]);

    const currentSeasonData = metadata?.seasons?.find((s: any) => s.season_number === selectedSeason);
    const episodes = currentSeasonData ? Array.from({ length: currentSeasonData.episode_count }, (_, i) => i + 1) : [];

    return (
        <div className="fixed inset-0 z-[100] flex justify-center overflow-y-auto no-scrollbar bg-black/90 backdrop-blur-2xl">
            {/* Backdrop click to close */}
            <div className="fixed inset-0 -z-10" onClick={onClose}></div>

            <div className="relative w-full max-w-4xl h-fit bg-[#141414] sm:my-10 sm:rounded-md shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden border border-white/5 animate-in slide-in-from-bottom-10 duration-500">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 z-[110] flex h-10 w-10 items-center justify-center rounded-full bg-[#141414] text-white hover:bg-white hover:text-black transition-all active:scale-95 group"
                >
                    <X className="h-6 w-6" />
                </button>

                {/* Banner Section */}
                <div className="relative w-full aspect-video md:aspect-[21/9] bg-black">
                    {(movie.backdrop_path || movie.poster_path) && (
                        <img
                            src={`${IMAGE_BASE_URL}w780${movie.backdrop_path || movie.poster_path}`}
                            alt={movieTitle}
                            className="w-full h-full object-cover"
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/20 to-transparent" />

                    {/* Banner Content */}
                    <div className="absolute bottom-10 left-8 md:left-12 space-y-6 max-w-[90%] z-10">
                        <h2 className="text-3xl md:text-5xl font-bold text-white drop-shadow-2xl">
                            {movieTitle}
                        </h2>
                        <div className="flex items-center space-x-4 pt-2">
                            <button
                                onClick={() => onPlay(movie, isTV ? selectedSeason : undefined, isTV ? 1 : undefined)}
                                className="flex items-center gap-x-3 rounded bg-white px-8 py-2.5 text-lg font-bold text-black transition hover:bg-white/80 active:scale-95"
                            >
                                <Play className="h-6 w-6 fill-black" />
                                Play
                            </button>
                            <button
                                onClick={onToggleList}
                                className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/40 transition-all active:scale-95 ${isAddedToList ? 'bg-white text-black' : 'bg-black/60 hover:border-white text-white'}`}
                            >
                                {isAddedToList ? <Check className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="p-8 md:p-12 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-12">
                        <div className="space-y-6">
                            <div className="flex items-center space-x-2 text-sm font-semibold">
                                <span className="text-green-500">{Math.round(movie.vote_average * 10)}% Match</span>
                                <span className="text-gray-400">{movie.release_date?.substring(0, 4) || movie.first_air_date?.substring(0, 4) || '2025'}</span>
                                <span className="border border-gray-500 px-1.5 rounded-sm text-[10px] text-gray-400">HD</span>
                            </div>
                            <p className="text-white text-lg leading-relaxed">
                                {movie.overview}
                            </p>
                        </div>

                        <div className="space-y-4 text-sm">
                            <div className="flex flex-wrap gap-2">
                                <span className="text-gray-500">Genres:</span>
                                <span className="text-white">Drama, Entertainment</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className="text-gray-500">Language:</span>
                                <span className="text-white uppercase">{movie.original_language || 'EN'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Episodes Section */}
                    {isTV && (
                        <div className="pt-12 border-t border-white/5">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Episodes</h3>
                                {metadata?.seasons?.length > 1 && (
                                    <select
                                        value={selectedSeason}
                                        onChange={(e) => setSelectedSeason(Number(e.target.value))}
                                        className="bg-white/5 text-white border border-white/10 rounded-xl px-5 py-3 text-sm font-bold outline-none cursor-pointer hover:bg-white/10 transition"
                                    >
                                        {metadata.seasons.map((s: any) => (
                                            <option key={s.season_number} value={s.season_number}>Season {s.season_number}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div className="space-y-4">
                                {loading ? (
                                    <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-50">
                                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-[#e50914]"></div>
                                        <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Syncing episodes...</p>
                                    </div>
                                ) : (
                                    episodes.map((ep) => (
                                        <div
                                            key={ep}
                                            onClick={() => onPlay(movie, selectedSeason, ep)}
                                            className="group flex flex-col sm:flex-row items-center p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-300 cursor-pointer active:scale-[0.98]"
                                        >
                                            <div className="hidden sm:flex text-gray-600 font-black text-3xl w-14 items-center justify-center mr-6 group-hover:text-[#e50914] transition-colors">
                                                {ep.toString().padStart(2, '0')}
                                            </div>
                                            <div className="relative w-full sm:w-52 aspect-video rounded-2xl overflow-hidden bg-black sm:mr-8 mb-4 sm:mb-0">
                                                <img
                                                    src={`${IMAGE_BASE_URL}${movie.backdrop_path}`}
                                                    className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition duration-700 group-hover:scale-110"
                                                    alt={`Episode ${ep}`}
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Play className="w-8 h-8 text-white fill-current" />
                                                </div>
                                            </div>
                                            <div className="flex-1 w-full text-center sm:text-left">
                                                <h4 className="text-white font-black text-xl mb-2">Episode {ep}</h4>
                                                <p className="text-gray-500 text-sm line-clamp-2">
                                                    Streaming available in HD and Surround Sound. Experience the next chapter of {movieTitle}.
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="h-20 sm:hidden" /> {/* Mobile Spacer */}
        </div>
    );
};

export default Modal;
