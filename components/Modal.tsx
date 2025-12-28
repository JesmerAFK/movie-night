import React, { useState, useEffect } from 'react';
import { Movie } from '../types';
import { IMAGE_BASE_URL } from '../constants';
import { X, Play, Plus, ThumbsUp, Check, Info, Star, Calendar, Globe, TrendingUp } from 'lucide-react';
import { BACKEND_URL } from '../constants';

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
        <div className="fixed inset-0 z-[100] flex justify-center overflow-y-auto no-scrollbar bg-black/90 backdrop-blur-2xl">
            {/* Backdrop click to close */}
            <div className="fixed inset-0 -z-10" onClick={onClose}></div>

            <div className="relative w-full max-w-4xl h-fit bg-[#0f0f0f] sm:my-10 sm:rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden border border-white/5 animate-in slide-in-from-bottom-10 duration-500">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 z-[110] flex h-12 w-12 items-center justify-center rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 text-white hover:bg-black transition-all active:scale-95 group"
                >
                    <X className="h-6 w-6 group-hover:rotate-90 transition-transform" />
                </button>

                {/* Banner Section */}
                <div className="relative w-full aspect-video md:aspect-[21/9] bg-black">
                    {(movie.backdrop_path || movie.poster_path) && (
                        <img
                            src={`${IMAGE_BASE_URL}${movie.backdrop_path || movie.poster_path}`}
                            alt={movieTitle}
                            className="w-full h-full object-cover"
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/20 to-transparent" />
                    <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent" />

                    {/* Banner Content */}
                    <div className="absolute bottom-10 left-8 md:left-12 space-y-6 max-w-[90%] z-10">
                        <div className="flex items-center space-x-2">
                            <div className="bg-[#e50914] text-white text-[10px] font-black px-2 py-0.5 rounded-sm">MOVIE NIGHT</div>
                            <div className="flex items-center space-x-1 text-green-500 text-xs font-black">
                                <TrendingUp className="w-4 h-4" />
                                <span>{Math.round(movie.vote_average * 10)}% MATCH</span>
                            </div>
                        </div>
                        <h2 className="text-4xl md:text-6xl font-black text-white drop-shadow-2xl uppercase tracking-tighter">
                            {movieTitle}
                        </h2>
                        <div className="flex items-center space-x-4 pt-2">
                            <button
                                onClick={() => onPlay(movie, isTV ? selectedSeason : undefined, isTV ? 1 : undefined)}
                                className="flex items-center gap-x-3 rounded-2xl bg-white px-10 py-4 text-sm font-black text-black transition hover:bg-gray-200 active:scale-95 uppercase tracking-widest"
                            >
                                <Play className="h-5 w-5 fill-black" />
                                Play Now
                            </button>
                            <button
                                onClick={onToggleList}
                                className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 transition-all active:scale-95 ${isAddedToList ? 'bg-[#e50914] border-[#e50914]' : 'bg-white/5 hover:bg-white/10'}`}
                            >
                                {isAddedToList ? <Check className="h-6 w-6 text-white" /> : <Plus className="h-6 w-6 text-white" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="p-8 md:p-12 space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-12">
                        <div className="space-y-8">
                            <div className="flex flex-wrap gap-4 text-xs font-black text-gray-400 uppercase tracking-widest">
                                <div className="flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-full">
                                    <Calendar className="w-3.5 h-3.5 text-[#e50914]" />
                                    <span>{movie.release_date?.substring(0, 4) || movie.first_air_date?.substring(0, 4) || '2025'}</span>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-full">
                                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                                    <span>{movie.original_language || 'EN'}</span>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-full">
                                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-current" />
                                    <span>{movie.vote_average.toFixed(1)} TMDB</span>
                                </div>
                            </div>
                            <p className="text-gray-300 text-lg leading-relaxed font-medium">
                                {movie.overview}
                            </p>
                        </div>

                        <div className="space-y-6 pt-2">
                            <div className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl space-y-4">
                                <div>
                                    <h5 className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Status</h5>
                                    <p className="text-white text-sm font-bold">Released</p>
                                </div>
                                <div>
                                    <h5 className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Production</h5>
                                    <p className="text-white text-sm font-bold">Global Origins</p>
                                </div>
                                <div>
                                    <h5 className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Age Rating</h5>
                                    <p className="text-white text-sm font-bold border border-white/20 inline-block px-2 rounded-sm italic">PG-13</p>
                                </div>
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
                                            <option key={s.season} value={s.season}>Season {s.season}</option>
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
