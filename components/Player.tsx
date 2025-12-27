import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, AlertCircle, WifiOff,
  Play, Pause, RotateCcw, RotateCw,
  Volume2, VolumeX, Maximize, Languages
} from 'lucide-react';
import { Movie } from '../types';
import { BACKEND_URL } from '../constants';

interface PlayerProps {
  movie: Movie;
  onBack: () => void;
}

// Configuration removed - we now play directly from URLs provided by the backend

const Player: React.FC<PlayerProps> = ({ movie, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [useEmbed, setUseEmbed] = useState(false); // Toggle between Brain and Global Embed
  const [errorType, setErrorType] = useState<'network' | 'format' | null>(null);

  // Quality Selection State
  const [qualities, setQualities] = useState<{ quality: string, url: string }[]>([]);
  const [selectedQualityUrl, setSelectedQualityUrl] = useState<string>('');

  // Subtitle State
  const [subtitles, setSubtitles] = useState<{ language: string, url: string }[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>(''); // '' = off

  // Player Control State
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isDelayedLoading, setIsDelayedLoading] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUrlRef = useRef<string>('');

  // Series State
  const [isSeries, setIsSeries] = useState(false);
  const [availableSeasonsData, setAvailableSeasonsData] = useState<{ season: number, episodes_count: number }[]>([]);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const titleToSearch = movie.title || movie.name || "";
  const year = movie.release_date ? parseInt(movie.release_date.split('-')[0]) : (movie.first_air_date ? parseInt(movie.first_air_date.split('-')[0]) : undefined);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, []);

  // Delayed loading to prevent flicker on fast skips
  useEffect(() => {
    if (loading) {
      loadingTimeoutRef.current = setTimeout(() => {
        setIsDelayedLoading(true);
      }, 400); // Only show spinner if it takes longer than 400ms
    } else {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      setIsDelayedLoading(false);
    }
  }, [loading]);

  // Auto-hide controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in a select or input
      if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          handleMouseMove();
          break;
        case 'f':
          e.preventDefault();
          if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
          } else {
            document.exitFullscreen();
          }
          break;
        case 'j':
        case 'arrowleft':
          e.preventDefault();
          skip(-10);
          handleMouseMove();
          break;
        case 'l':
        case 'arrowright':
          e.preventDefault();
          skip(10);
          handleMouseMove();
          break;
        case 'm':
          e.preventDefault();
          setIsMuted(prev => !prev);
          if (videoRef.current) videoRef.current.muted = !isMuted;
          handleMouseMove();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isMuted]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const skip = (amount: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime += amount;
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration);
    }
  };

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) videoRef.current.currentTime = time;
  };

  // Check metadata
  useEffect(() => {
    console.log(`Fetching metadata for: ${titleToSearch}`);
    fetch(`${BACKEND_URL}/api/metadata?title=${encodeURIComponent(titleToSearch)}${year ? `&year=${year}` : ''}`)
      .then(res => res.json())
      .then(data => {
        console.log("Metadata received:", data);
        if (data && data.is_tv) {
          setIsSeries(true);
          if (data.seasons && Array.isArray(data.seasons)) {
            setAvailableSeasonsData(data.seasons);
          }
        } else {
          setIsSeries(false);
          setAvailableSeasonsData([]);
        }
      })
      .catch(err => {
        console.error("Metadata error:", err);
        setIsSeries(false);
      });
  }, [titleToSearch, year]);

  // Get episode count for current season
  const currentSeasonData = availableSeasonsData.find(s => s.season === season);
  const episodesCount = currentSeasonData ? currentSeasonData.episodes_count : 1; // Default to 1 if unknown (avoid fake 24)
  const episodeList = Array.from({ length: episodesCount }, (_, i) => i + 1);

  // Fetch available qualities and subtitles
  useEffect(() => {
    if (!titleToSearch) return;

    setLoading(true);
    setQualities([]);
    setSubtitles([]);
    setErrorType(null);

    const qs = new URLSearchParams({
      title: titleToSearch,
      ...(year && { year: year.toString() }),
      season: season.toString(),
      episode: episode.toString()
    });

    Promise.all([
      fetch(`${BACKEND_URL}/api/qualities?${qs}`).then(res => res.json()),
      fetch(`${BACKEND_URL}/api/subtitles?${qs}`).then(res => res.json())
    ]).then(([qualityData, subData]) => {
      setQualities(qualityData);
      if (qualityData.length > 0) {
        setSelectedQualityUrl(qualityData[0].url);
      }
      setSubtitles(subData);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [titleToSearch, year, season, episode]);

  // Handle HLS and Video Source
  useEffect(() => {
    if (!videoRef.current || !selectedQualityUrl) return;

    const video = videoRef.current;

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (selectedQualityUrl.includes('.m3u8')) {
      // Import HLS only when needed or use window.Hls if loaded via CDN
      const Hls = (window as any).Hls;
      if (Hls && Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(selectedQualityUrl);
        hls.attachMedia(video);
        hlsRef.current = hls;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = selectedQualityUrl;
      }
    } else {
      video.src = selectedQualityUrl;
    }
  }, [selectedQualityUrl]);

  // Reset state on title change
  useEffect(() => {
    setSeason(1);
    setEpisode(1);
    setIsSeries(false);
    setAvailableSeasonsData([]);
    setSelectedQualityUrl('');
    setSelectedSubtitle('');
    setErrorType(null);
  }, [titleToSearch]);

  const handleCanPlay = () => {
    setLoading(false);
    setErrorType(null);

    // Only restore playback position if the URL actually changed
    if (videoRef.current && currentTime > 0 && lastUrlRef.current !== selectedQualityUrl) {
      videoRef.current.currentTime = currentTime;
    }
    lastUrlRef.current = selectedQualityUrl;

    applySubtitles();
  };

  const handleWaiting = () => setLoading(true);
  const handlePlaying = () => {
    setLoading(false);
    setIsPlaying(true);
  };

  const handleError = () => {
    if (videoRef.current && !videoRef.current.error) return;
    setLoading(false);
    setErrorType('format');
  };

  const handleQualityChange = (url: string) => {
    setSelectedQualityUrl(url);
    setLoading(true);
  };

  const applySubtitles = () => {
    if (!videoRef.current) return;
    const tracks = videoRef.current.textTracks;

    const sub = subtitles.find(s => s.url === selectedSubtitle);
    const targetLang = sub?.language;

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (selectedSubtitle && track.label === targetLang) {
        track.mode = 'showing';
      } else {
        track.mode = 'disabled';
      }
    }
  };

  // Manual subtitle track activation
  useEffect(() => {
    if (useEmbed) return;
    const timer = setTimeout(applySubtitles, 200);
    return () => clearTimeout(timer);
  }, [selectedSubtitle, subtitles, selectedQualityUrl]);

  // VidSrc Embed URL Calculation
  const tmdbId = movie.id;
  const embedUrl = isSeries
    ? `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`
    : `https://vidsrc.to/embed/movie/${tmdbId}`;

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 bg-black overflow-hidden flex flex-col font-sans select-none transition-all duration-300 ${!showControls && isPlaying ? 'cursor-none' : 'cursor-default'}`}
      onMouseMove={handleMouseMove}
      onClick={handleMouseMove}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!document.fullscreenElement) {
          containerRef.current?.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      }}
    >
      <style>{`
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #e50914;
          cursor: pointer;
          border: 2px solid white;
        }
        .progress-bar:hover input[type='range']::-webkit-slider-thumb {
          transform: scale(1.2);
        }
        /* Style subtitles */
        video::cue {
          background-color: rgba(0, 0, 0, 0.7);
          color: #ffffff;
          font-family: 'Inter', Arial, sans-serif;
          font-size: 1.4rem;
          text-shadow: 0 0 10px rgba(0,0,0,1);
          line-height: 1.5;
        }
      `}</style>

      {/* Top Navigation Overlay */}
      <div className={`absolute top-0 left-0 right-0 p-8 flex items-start justify-between bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-500 z-40 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center space-x-6">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full transition-all group duration-300"
          >
            <ArrowLeft className="text-white w-8 h-8 group-hover:scale-110" />
          </button>
          <div>
            <h1 className="text-white text-2xl font-bold drop-shadow-lg">{movie.title || movie.name}</h1>
            <p className="text-gray-300 text-sm font-medium">
              {isSeries ? `S${season}:E${episode}` : (movie.release_date || movie.first_air_date || '').split('-')[0]}
            </p>
          </div>
        </div>

        <button
          onClick={() => setUseEmbed(!useEmbed)}
          className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all border ${useEmbed ? 'bg-[#e50914] border-[#e50914] text-white' : 'bg-black/40 border-white/20 text-gray-400 hover:text-white'}`}
        >
          {useEmbed ? 'Mode: Global Mirror' : 'Mode: Direct Play'}
        </button>

        {!useEmbed && (
          <div className="flex items-center space-x-2 bg-black/40 backdrop-blur-md rounded-lg px-3 py-1 border border-white/10">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Quality</span>
            <select
              value={selectedQualityUrl}
              onChange={(e) => handleQualityChange(e.target.value)}
              className="bg-transparent text-white text-sm font-medium outline-none cursor-pointer [&>option]:bg-[#141414]"
            >
              {qualities.map(q => <option key={q.url} value={q.url}>{q.quality}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Loading & Error Overlays */}
      {(isDelayedLoading || errorType) && (
        <div className={`absolute inset-0 flex items-center justify-center bg-black/40 z-20 transition-opacity duration-300 ${isDelayedLoading && !errorType ? 'animate-in fade-in' : ''}`}>
          {isDelayedLoading && !errorType && (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#e50914] mb-4"></div>
              <p className="text-white/60 text-sm font-medium animate-pulse">Buffering...</p>
            </div>
          )}
          {errorType && (
            <div className="text-center p-8 bg-black/80 rounded-2xl border border-white/10 backdrop-blur-xl max-w-sm">
              <AlertCircle className="w-16 h-16 text-[#e50914] mx-auto mb-4" />
              <h2 className="text-white text-xl font-bold mb-2">Something went wrong</h2>
              <p className="text-gray-400 text-sm mb-6">We're having trouble playing this title. Please try again later.</p>
              <button onClick={() => window.location.reload()} className="w-full py-3 bg-white text-black font-bold rounded hover:bg-gray-200 transition">Retry</button>
            </div>
          )}
        </div>
      )}

      {/* Main Player Area */}
      <div
        className="flex-1 relative bg-black flex items-center justify-center overflow-hidden"
        onClick={() => !useEmbed && togglePlay()}
      >
        {useEmbed ? (
          <iframe
            src={embedUrl}
            className="w-full h-full border-none"
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture"
            // The "Magic" Ad-Blocker Shield:
            sandbox="allow-forms allow-scripts allow-pointer-lock allow-same-origin allow-top-navigation"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              key={selectedQualityUrl}
              className="w-full h-full object-contain"
              autoPlay
              playsInline
              preload="auto"
              crossOrigin="anonymous"
              onCanPlay={handleCanPlay}
              onWaiting={handleWaiting}
              onPlaying={handlePlaying}
              onError={handleError}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleTimeUpdate}
            >
              <source src={selectedQualityUrl} type="video/mp4" />
              {subtitles.map((sub, idx) => (
                <track
                  key={sub.url}
                  kind="subtitles"
                  src={`${BACKEND_URL}/api/subtitles/proxy?url=${encodeURIComponent(sub.url)}`}
                  srcLang={sub.language}
                  label={sub.language}
                  default={sub.url === selectedSubtitle}
                />
              ))}
            </video>

            {/* Center Play/Pause Indicator */}
            {!isPlaying && showControls && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="p-8 rounded-full bg-black/40 border border-white/10 backdrop-blur-sm">
                  <Play className="w-20 h-20 text-white fill-white" />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Custom Bottom Controls */}
      <div className={`absolute bottom-0 left-0 right-0 p-8 pt-20 bg-gradient-to-t from-black via-black/80 to-transparent transition-all duration-500 z-40 ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>

        {/* Progress Bar */}
        <div className="group/progress flex flex-col mb-6">
          <div className="flex items-center justify-between text-white text-sm font-medium mb-2 px-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="relative h-1 group-hover/progress:h-2 w-full bg-white/20 rounded-full transition-all duration-200 overflow-hidden progress-bar">
            <div
              className="absolute h-full bg-[#e50914] z-10"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="hover:scale-110 transition-transform">
              {isPlaying ? <Pause className="w-10 h-10 text-white fill-white" /> : <Play className="w-10 h-10 text-white fill-white" />}
            </button>

            <div className="flex items-center space-x-6">
              <button onClick={(e) => { e.stopPropagation(); skip(-10); }} className="group flex flex-col items-center">
                <RotateCcw className="w-8 h-8 text-white group-hover:rotate-[-30deg] transition-transform" />
                <span className="text-[10px] text-white font-bold mt-1">10</span>
              </button>
              <button onClick={(e) => { e.stopPropagation(); skip(10); }} className="group flex flex-col items-center">
                <RotateCw className="w-8 h-8 text-white group-hover:rotate-[30deg] transition-transform" />
                <span className="text-[10px] text-white font-bold mt-1">10</span>
              </button>
            </div>

            <div className="flex items-center group/volume ml-4">
              <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); if (videoRef.current) videoRef.current.muted = !isMuted; }}>
                {isMuted || volume === 0 ? <VolumeX className="w-8 h-8 text-white" /> : <Volume2 className="w-8 h-8 text-white" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setVolume(val);
                  if (videoRef.current) videoRef.current.volume = val;
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-0 group-hover/volume:w-24 overflow-hidden transition-all duration-300 ml-2"
              />
            </div>
          </div>

          <div className="flex items-center space-x-6">
            {/* Series Selection (Episodes Button - Netflix Style) */}
            {isSeries && (
              <div className="flex items-center space-x-4 mr-4">
                <div className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-lg px-4 py-2 border border-white/10 transition-colors">
                  <span className="text-xs text-gray-400 font-bold uppercase mr-2">Season</span>
                  <select
                    value={season}
                    onChange={(e) => { e.stopPropagation(); setSeason(Number(e.target.value)); }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent text-white text-sm font-bold outline-none cursor-pointer [&>option]:bg-[#141414]"
                  >
                    {availableSeasonsData.map(s => <option key={s.season} value={s.season}>{s.season}</option>)}
                    {availableSeasonsData.length === 0 && <option value={1}>1</option>}
                  </select>
                </div>
                <div className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-lg px-4 py-2 border border-white/10 transition-colors">
                  <span className="text-xs text-gray-400 font-bold uppercase mr-2">Episode</span>
                  <select
                    value={episode}
                    onChange={(e) => { e.stopPropagation(); setEpisode(Number(e.target.value)); }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent text-white text-sm font-bold outline-none cursor-pointer [&>option]:bg-[#141414]"
                  >
                    {episodeList.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Subtitles Dropdown */}
            <div className="flex items-center space-x-2">
              <Languages className="w-6 h-6 text-gray-400" />
              <select
                value={selectedSubtitle}
                onChange={(e) => { e.stopPropagation(); setSelectedSubtitle(e.target.value); }}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent text-white text-sm font-medium outline-none cursor-pointer [&>option]:bg-[#141414]"
              >
                <option value="">Off</option>
                {subtitles.map(sub => <option key={sub.url} value={sub.url}>{sub.language}</option>)}
              </select>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!document.fullscreenElement) {
                  containerRef.current?.requestFullscreen();
                } else {
                  document.exitFullscreen();
                }
              }}
              className="hover:scale-110 transition-transform"
            >
              <Maximize className="w-8 h-8 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div >
  );
};

export default Player;