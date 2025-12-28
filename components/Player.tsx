import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, AlertCircle, WifiOff,
  Play, Pause, RotateCcw, RotateCw,
  Volume2, VolumeX, Maximize, Languages, Users, Monitor, MonitorPlay, ChevronRight, Star, Info, Share2, Download, Check, Plus, Settings2, ExternalLink
} from 'lucide-react';
import WatchTogether from './WatchTogether/WatchTogether';
import SkippableAd from './SkippableAd';
import { Movie } from '../types';
import { BACKEND_URL, API_KEY, BASE_URL } from '../constants';
import { Capacitor } from '@capacitor/core';

// Native Plugin Fallbacks
let Share: any = null;
let ScreenOrientation: any = null;
let Haptics: any = null;
let ImpactStyle: any = { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' };

if (Capacitor.isNativePlatform()) {
  import('@capacitor/share').then(m => Share = m.Share).catch(() => { });
  import('@capacitor/screen-orientation').then(m => ScreenOrientation = m.ScreenOrientation).catch(() => { });
  import('@capacitor/haptics').then(m => {
    Haptics = m.Haptics;
    ImpactStyle = m.ImpactStyle;
  }).catch(() => { });
}

interface PlayerProps {
  movie: Movie;
  onBack: () => void;
  initialSeason?: number;
  initialEpisode?: number;
  isAddedToList: boolean;
  onToggleList: () => void;
}

const Player: React.FC<PlayerProps> = ({
  movie,
  onBack,
  initialSeason = 1,
  initialEpisode = 1,
  isAddedToList,
  onToggleList
}) => {
  const [loading, setLoading] = useState(true);
  const [useEmbed, setUseEmbed] = useState(false);
  const [errorType, setErrorType] = useState<'network' | 'format' | null>(null);

  const [qualities, setQualities] = useState<string[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<string>('');
  const [subtitles, setSubtitles] = useState<{ language: string, url: string }[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>('');

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showAd, setShowAd] = useState(true);
  const [isLandscape, setIsLandscape] = useState(false);
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
  const [showSpecs, setShowSpecs] = useState(false);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bufferCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isSeries, setIsSeries] = useState(false);
  const [availableSeasonsData, setAvailableSeasonsData] = useState<{ season: number, episodes_count: number }[]>([]);
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);

  const [showWatchTogether, setShowWatchTogether] = useState(() => {
    return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('room');
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const titleToSearch = movie.title || movie.name || "";
  const yearStr = movie.release_date?.split('-')[0] || movie.first_air_date?.split('-')[0];
  const year = yearStr ? parseInt(yearStr) : undefined;

  const currentUrl = `${BACKEND_URL}/api/stream?title=${encodeURIComponent(titleToSearch)}${selectedQuality ? `&quality=${selectedQuality}` : ''}${year ? `&year=${year}` : ''}&season=${season}&episode=${episode}&proxy=${!useEmbed}${isSeries ? '&is_tv=true' : ''}&native=${Capacitor.isNativePlatform()}`;

  const embedUrl = isSeries
    ? `https://vidsrc.to/embed/tv/${movie.id}/${season}/${episode}`
    : `https://vidsrc.to/embed/movie/${movie.id}`;

  const currentSeasonData = availableSeasonsData.find(s => s.season === season);
  const episodesCount = currentSeasonData ? currentSeasonData.episodes_count : 1;
  const episodeList = Array.from({ length: episodesCount }, (_, i) => i + 1);

  // Buffer Timeout Logic
  useEffect(() => {
    if (loading && !showAd && !useEmbed) {
      if (bufferCheckTimeoutRef.current) clearTimeout(bufferCheckTimeoutRef.current);
      bufferCheckTimeoutRef.current = setTimeout(() => {
        if (loading) setErrorType('network');
      }, 12000);
    }
    return () => { if (bufferCheckTimeoutRef.current) clearTimeout(bufferCheckTimeoutRef.current); };
  }, [loading, showAd, useEmbed]);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (Capacitor.isNativePlatform() && ScreenOrientation) {
        try { ScreenOrientation.unlock(); } catch (e) { }
      }
    };
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const triggerHaptic = (style: string = 'LIGHT') => {
    if (Capacitor.isNativePlatform() && Haptics) {
      try { Haptics.impact({ style }); } catch (e) { }
    }
  };

  const toggleFullscreen = async () => {
    triggerHaptic('MEDIUM');
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
        setIsLandscape(true);
        if (Capacitor.isNativePlatform() && ScreenOrientation) {
          await ScreenOrientation.lock({ orientation: 'landscape' });
        }
      } catch (err) {
        console.error("Fullscreen Error:", err);
      }
    } else {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        setIsLandscape(false);
        if (Capacitor.isNativePlatform() && ScreenOrientation) {
          try { await ScreenOrientation.unlock(); } catch (e) { }
        }
      } catch (err) {
        console.error("Exit Fullscreen Error:", err);
      }
    }
  };

  const handleShare = async () => {
    triggerHaptic('HEAVY');
    const url = window.location.href;
    try {
      if (Capacitor.isNativePlatform() && Share) {
        await Share.share({
          title: movie.title || movie.name,
          text: `Watching ${movie.title || movie.name} on Movie Night!`,
          url: url,
        });
      } else if (navigator.share) {
        await navigator.share({ title: movie.title || movie.name, url: url });
      } else {
        navigator.clipboard.writeText(url);
        alert("Link copied!");
      }
    } catch (err) { console.log("Share failed"); }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    triggerHaptic('LIGHT');
    if (videoRef.current.paused) videoRef.current.play().catch(() => { });
    else videoRef.current.pause();
  };

  const skip = (amount: number) => {
    if (!videoRef.current) return;
    triggerHaptic('LIGHT');
    videoRef.current.currentTime += amount;
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) videoRef.current.currentTime = time;
  };

  useEffect(() => {
    const fetchSimilar = async () => {
      try {
        const type = movie.first_air_date ? 'tv' : 'movie';
        const response = await fetch(`${BASE_URL}/${type}/${movie.id}/similar?api_key=${API_KEY}`);
        const data = await response.json();
        if (data.results) setSimilarMovies(data.results.slice(0, 8));
      } catch (err) { console.error("Similar fetch error:", err); }
    };
    fetchSimilar();
  }, [movie.id]);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/metadata?title=${encodeURIComponent(titleToSearch)}${year ? `&year=${year}` : ''}`)
      .then(res => res.json())
      .then(data => {
        if (data?.is_tv) {
          setIsSeries(true);
          if (data.seasons) setAvailableSeasonsData(data.seasons);
        }
      });
  }, [titleToSearch]);

  useEffect(() => {
    if (!titleToSearch || showAd) return;
    setLoading(true);
    const qs = new URLSearchParams({
      title: titleToSearch,
      ...(year && { year: year.toString() }),
      season: season.toString(),
      episode: episode.toString(),
      ...(isSeries && { is_tv: 'true' })
    });

    Promise.all([
      fetch(`${BACKEND_URL}/api/qualities?${qs}`).then(res => res.json()),
      fetch(`${BACKEND_URL}/api/subtitles?${qs}`).then(res => res.json())
    ]).then(([qualityData, subData]) => {
      setQualities(qualityData);
      if (qualityData.length > 0) setSelectedQuality(qualityData[0]);
      setSubtitles(subData);
    }).finally(() => setLoading(false));
  }, [titleToSearch, season, episode, showAd]);

  useEffect(() => {
    if (!videoRef.current || useEmbed || !selectedQuality || showAd) return;
    videoRef.current.src = currentUrl;
    videoRef.current.load();
    videoRef.current.play().catch(() => { });
  }, [currentUrl, selectedQuality, showAd, useEmbed]);

  const renderVideoPlayer = () => (
    <div className={`relative w-full overflow-hidden bg-black flex items-center justify-center group ${isLandscape ? 'h-full aspect-video' : 'aspect-video'}`} onClick={() => !useEmbed && togglePlay()}>
      {useEmbed ? (
        <iframe src={embedUrl} className="w-full h-full border-none" allowFullScreen allow="autoplay; encrypted-media; picture-in-picture" />
      ) : (
        <>
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            preload="auto"
            crossOrigin="anonymous"
            onCanPlay={() => { setLoading(false); setErrorType(null); }}
            onWaiting={() => setLoading(true)}
            onPlaying={() => { setIsPlaying(true); setLoading(false); }}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onError={() => { if (videoRef.current?.error) setErrorType('format'); }}
          >
            <source src={currentUrl} type="video/mp4" />
          </video>

          {loading && !errorType && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                <div className="absolute inset-0 rounded-full border-4 border-t-[#e50914] animate-spin" />
              </div>
              <p className="text-white font-black text-[8px] uppercase tracking-[0.4em] mt-5">Loading Stream</p>
            </div>
          )}

          <div className={`absolute inset-0 z-30 flex flex-col justify-between transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="p-4 flex items-center justify-between bg-gradient-to-b from-black/95 to-transparent pt-[env(safe-area-inset-top)]">
              <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="p-2 bg-black/40 rounded-full active:scale-90 transition-transform">
                <ArrowLeft className="text-white w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3">
                <select
                  value={selectedQuality}
                  onChange={(e) => { e.stopPropagation(); handleQualityChange(e.target.value); }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-black/80 text-white text-[9px] uppercase font-black px-3 py-1.5 rounded-full border border-white/10 outline-none"
                >
                  <option value="">AUTO</option>
                  {qualities.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
                <button onClick={(e) => { e.stopPropagation(); setShowWatchTogether(!showWatchTogether); }} className={`p-2 rounded-full border border-white/10 ${showWatchTogether ? 'bg-[#e50914]' : 'bg-black/60'}`}>
                  <Users className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-8">
              <button onClick={(e) => { e.stopPropagation(); skip(-15); }} className="active:scale-90 transition-all flex flex-col items-center opacity-80 hover:opacity-100">
                <RotateCcw className="w-6 h-6 text-white" />
                <span className="text-[8px] font-black text-white mt-1">15s</span>
              </button>
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="p-4 bg-white/10 backdrop-blur-3xl rounded-full border border-white/20 hover:scale-105 active:scale-95 transition-all shadow-2xl">
                {isPlaying ? <Pause className="w-7 h-7 text-white fill-white" /> : <Play className="w-7 h-7 text-white fill-white ml-0.5" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); skip(15); }} className="active:scale-90 transition-all flex flex-col items-center opacity-80 hover:opacity-100">
                <RotateCw className="w-6 h-6 text-white" />
                <span className="text-[8px] font-black text-white mt-1">15s</span>
              </button>
            </div>

            <div className="p-4 bg-gradient-to-t from-black/95 to-transparent pb-[calc(env(safe-area-inset-bottom)+0.25rem)]">
              <div className="flex flex-col space-y-2.5">
                <div className="flex items-center justify-between text-[9px] text-gray-500 font-bold tabular-nums uppercase">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <div className="relative h-1 w-full bg-white/10 rounded-full group">
                  <div className="absolute h-full bg-[#e50914] z-10 rounded-full" style={{ width: `${(currentTime / duration) * 100}%` }} />
                  <input type="range" min={0} max={duration || 0} step={0.1} value={currentTime} onChange={(e) => { e.stopPropagation(); handleSeek(e); }} onClick={(e) => e.stopPropagation()} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
                </div>
                <div className="pt-1 flex items-center justify-between">
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                      <Languages className="w-4 h-4 text-gray-600" />
                      <select value={selectedSubtitle} onChange={(e) => setSelectedSubtitle(e.target.value)} onClick={(e) => e.stopPropagation()} className="bg-transparent text-white text-[8px] font-black uppercase outline-none">
                        <option value="">No Subs</option>
                        {subtitles.map(s => <option key={s.url} value={s.url}>{s.language}</option>)}
                      </select>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="p-2 active:scale-90 transition-transform">
                    <Maximize className="w-5 h-5 text-white/70 hover:text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {errorType && (
            <div className="absolute inset-0 bg-black/98 flex flex-col items-center justify-center p-8 text-center z-[60] animate-in fade-in duration-500">
              <AlertCircle className="w-8 h-8 text-[#e50914] mb-4" />
              <h3 className="text-white font-black text-lg mb-1 uppercase">Source Busy</h3>
              <div className="flex flex-col gap-3 w-full max-w-[200px]">
                <button onClick={() => { triggerHaptic('MEDIUM'); setUseEmbed(true); setErrorType(null); }} className="w-full py-4 bg-white text-black font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">Use Fallback Server</button>
                <button onClick={() => window.location.reload()} className="w-full py-2 text-white/40 font-bold text-[8px] uppercase active:scale-95 transition-all">Retry Direct</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const handleQualityChange = (q: string) => {
    setSelectedQuality(q);
    setLoading(true);
  };

  if (showAd) return <SkippableAd onSkip={() => { setShowAd(false); setIsPlaying(true); }} />;

  return (
    <div onMouseMove={handleMouseMove} ref={containerRef} className={`fixed inset-0 z-50 bg-[#070707] overflow-hidden flex flex-col select-none ${isLandscape ? 'md:flex-row' : 'flex-col'}`}>

      <div className={`relative transition-all duration-500 ${isLandscape ? 'w-full h-full' : 'w-full h-fit flex-shrink-0'}`}>
        {renderVideoPlayer()}
      </div>

      {!isLandscape && (
        <div className="flex-1 overflow-y-auto no-scrollbar bg-[#070707] px-6 py-8 pb-40">
          <div className="flex items-start justify-between mb-2">
            <h1 className="text-xl font-black text-white pr-4 leading-tight uppercase tracking-tight">{movie.title || movie.name}</h1>
            <div className="flex items-center space-x-1.5 bg-[#e50914]/10 border border-[#e50914]/20 px-2 py-1 rounded-lg">
              <Star className="w-3 h-3 text-[#e50914] fill-current" />
              <span className="font-black text-[#e50914] text-xs">{movie.vote_average?.toFixed(1) || '8.2'}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 mb-10 text-[9px] font-black uppercase text-gray-700 tracking-[0.2em]">
            <div className="bg-white/5 px-2 py-0.5 rounded-sm">{year || '2025'}</div>
            <div className="bg-white/5 px-2 py-0.5 rounded-sm">{movie.original_language || 'EN'}</div>
            <div className="text-[#e50914]/50">ULTRA HD</div>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-12">
            <button onClick={handleShare} className="flex flex-col items-center space-y-2 active:scale-90 transition-all">
              <div className="w-14 h-14 bg-white/[0.03] rounded-2xl flex items-center justify-center border border-white/5">
                <Share2 className="w-5 h-5 text-gray-400" />
              </div>
              <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Share</span>
            </button>
            <button onClick={onToggleList} className="flex flex-col items-center space-y-2 active:scale-90 transition-all">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-300 ${isAddedToList ? 'bg-[#e50914] border-[#e50914]' : 'bg-white/[0.03] border-white/5'}`}>
                {isAddedToList ? <Check className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-gray-400" />}
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-widest ${isAddedToList ? 'text-[#e50914]' : 'text-gray-600'}`}>{isAddedToList ? 'Added' : 'Save'}</span>
            </button>
            <button onClick={() => { triggerHaptic('LIGHT'); setShowSpecs(!showSpecs); }} className="flex flex-col items-center space-y-2 active:scale-90 transition-all">
              <div className={`w-14 h-14 bg-white/[0.03] rounded-2xl flex items-center justify-center border ${showSpecs ? 'border-[#e50914]/40 bg-[#e50914]/5' : 'border-white/5'}`}>
                <Settings2 className={`w-5 h-5 ${showSpecs ? 'text-[#e50914]' : 'text-gray-400'}`} />
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-widest ${showSpecs ? 'text-[#e50914]' : 'text-gray-600'}`}>Specs</span>
            </button>
          </div>

          {showSpecs && (
            <div className="mb-10 p-5 bg-white/[0.02] border border-white/5 rounded-2xl animate-in slide-in-from-top-1 duration-300">
              <div className="grid grid-cols-2 gap-4 text-[9px] font-black uppercase tracking-widest">
                <div><p className="text-gray-700 mb-1">Server</p><p className="text-white">{useEmbed ? 'EMBED' : 'DIRECT'}</p></div>
                <div><p className="text-gray-700 mb-1">Quality</p><p className="text-white">{selectedQuality || '720P'}</p></div>
                <div><p className="text-gray-700 mb-1">Status</p><p className="text-green-500">Live</p></div>
              </div>
            </div>
          )}

          <div className="mb-10">
            <h3 className="text-white font-black text-[9px] uppercase tracking-[0.4em] mb-4 opacity-20">Synopsis</h3>
            <p className="text-gray-500 text-[13px] leading-relaxed font-medium">{movie.overview || "No overview available."}</p>
          </div>

          {isSeries && (
            <div className="mb-14">
              <h3 className="text-white font-black text-[9px] uppercase tracking-[0.4em] mb-5 opacity-20">Selection</h3>
              <div className="flex space-x-3 overflow-x-auto no-scrollbar -mx-6 px-6">
                {episodeList.map(e => (
                  <button
                    key={e}
                    onClick={() => { triggerHaptic('LIGHT'); setEpisode(e); setLoading(true); }}
                    className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-xl font-black text-sm transition-all ${episode === e ? 'bg-[#e50914] text-white shadow-lg scale-105' : 'bg-white/5 text-gray-700'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          {similarMovies.length > 0 && (
            <div className="animate-in fade-in duration-1000">
              <h3 className="text-white font-black text-[9px] uppercase tracking-[0.4em] mb-6 opacity-20">You May Also Like</h3>
              <div className="grid grid-cols-2 gap-3">
                {similarMovies.map(similar => (
                  <div key={similar.id} className="group relative aspect-video bg-white/5 rounded-xl overflow-hidden active:scale-95 transition-all" onClick={() => window.location.search = `?movie=${similar.id}`}>
                    <img src={`https://image.tmdb.org/t/p/w200${similar.backdrop_path || similar.poster_path}`} className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/30 to-transparent">
                      <p className="text-white text-[8px] font-black uppercase truncate tracking-widest">{similar.title || similar.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showWatchTogether && (
        <div className={`transition-all duration-500 ${isLandscape ? 'hidden' : 'fixed bottom-0 left-0 w-full z-40'}`}>
          <WatchTogether movie={movie} videoRef={videoRef} isPlaying={isPlaying} currentTime={currentTime} onSyncPlay={(p) => videoRef.current && (p ? videoRef.current.play() : videoRef.current.pause())} onSyncSeek={(t) => videoRef.current && (videoRef.current.currentTime = t)} onClose={() => setShowWatchTogether(false)} onChatToggle={() => { }} />
        </div>
      )}
    </div>
  );
};

export default Player;