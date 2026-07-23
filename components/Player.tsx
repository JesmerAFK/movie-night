import React, { useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import {
  ArrowLeft, AlertCircle, WifiOff,
  Play, Pause, RotateCcw, RotateCw,
  Volume2, VolumeX, Maximize, Languages, Users, Monitor, MonitorPlay, ChevronRight, Star, Info, Share2, Download, Check, Plus, Settings2, ExternalLink, Zap, X, Database, SkipForward
} from 'lucide-react';
import WatchTogether from './WatchTogether/WatchTogether';
import { Movie } from '../types';

import { API_KEY, BASE_URL } from '../constants';
import { saveHistory, getHistory } from '../services/history';
import { addDownload } from '../services/downloadTracker';
import { Capacitor } from '@capacitor/core';
import { ScreenBrightness } from '@capacitor-community/screen-brightness';

// Native Plugin Fallbacks
let Share: any = null;
let ScreenOrientation: any = null;
let Haptics: any = null;
let App: any = null;
let ImpactStyle = { Light: 'LIGHT' as const, Medium: 'MEDIUM' as const, Heavy: 'HEAVY' as const };

if (Capacitor.isNativePlatform()) {
  import('@capacitor/share').then(m => { Share = m.Share; }).catch(() => { });
  import('@capacitor/screen-orientation').then(m => { ScreenOrientation = m.ScreenOrientation; }).catch(() => { });
  import('@capacitor/app').then(m => { App = m.App; }).catch(() => { });
  import('@capacitor/haptics').then(m => {
    Haptics = m.Haptics;
    (ImpactStyle as any) = m.ImpactStyle;
  }).catch(() => { });
}

// Haptic Helper
const triggerHaptic = (style: 'LIGHT' | 'MEDIUM' | 'HEAVY') => {
  if (Capacitor.isNativePlatform() && Haptics && ImpactStyle) {
    try {
      Haptics.impact({ style: ImpactStyle[style] }).catch(() => { });
    } catch (e) { }
  } else if ('vibrate' in navigator) {
    const durations = { LIGHT: 10, MEDIUM: 20, HEAVY: 30 };
    navigator.vibrate(durations[style]);
  }
};

interface PlayerProps {
  movie: Movie;
  onBack: () => void;
  initialSeason?: number;
  initialEpisode?: number;
  isAddedToList: boolean;
  onToggleList: () => void;
  onMovieChange?: (movie: Movie) => void;
  backendUrl?: string;
}

const Player: React.FC<PlayerProps> = ({
  movie,
  onBack,
  initialSeason = 1,
  initialEpisode = 1,
  isAddedToList,
  onToggleList,
  onMovieChange,
  backendUrl = 'http://127.0.0.1:8000'
}) => {
  const computedIsSeries = !!(movie.first_air_date || (movie as any).seasons || movie.media_type === 'tv' || (movie.name && !movie.title));
  const [loading, setLoading] = useState(true);
  const [useEmbed, setUseEmbed] = useState(false);
  const [movieBoxId, setMovieBoxId] = useState<string | null>(null);
  const [streamUrls, setStreamUrls] = useState<{ quality: string, url: string }[]>([]);
  const [selectedStreamUrl, setSelectedStreamUrl] = useState<string>('');
  const [errorType, setErrorType] = useState<'network' | 'format' | 'BUSY' | null>(null);

  const [qualities, setQualities] = useState<string[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<string>('');
  const [subtitles, setSubtitles] = useState<{ language: string, url: string }[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>('');

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [subSettings, setSubSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('movie_night_sub_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          fontSize: typeof parsed.fontSize === 'number' ? parsed.fontSize : 16,
          bottom: typeof parsed.bottom === 'number' ? parsed.bottom : 40,
          bgOpacity: typeof parsed.bgOpacity === 'number' ? parsed.bgOpacity : 0.6
        };
      }
    } catch (e) {
      console.error("Error reading subSettings from localStorage:", e);
    }
    return { fontSize: 16, bottom: 40, bgOpacity: 0.6 };
  });

  useEffect(() => {
    try {
      localStorage.setItem('movie_night_sub_settings', JSON.stringify(subSettings));
    } catch (e) {
      console.error("Error saving subSettings to localStorage:", e);
    }
  }, [subSettings]);

  const [showSubSettings, setShowSubSettings] = useState(false);
  const [activeCue, setActiveCue] = useState<string>('');

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  const [isLandscape, setIsLandscape] = useState(false);
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
  const [showSpecs, setShowSpecs] = useState(false);
  const [showDownloadSelector, setShowDownloadSelector] = useState(false);
  const [downloadLinks, setDownloadLinks] = useState<{ quality: string, url: string }[]>([]);
  const [isFetchingDownloads, setIsFetchingDownloads] = useState(false);

  // Swipe Gesture States
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const [swipeStartY, setSwipeStartY] = useState<number | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'horizontal' | 'vertical' | null>(null);
  const [swipeAmount, setSwipeAmount] = useState(0);
  const [swipeFeedback, setSwipeFeedback] = useState<{ type: 'VOLUME' | 'BRIGHTNESS' | 'SEEK', value: string } | null>(null);
  const [swipeSide, setSwipeSide] = useState<'left' | 'right' | null>(null);
  const [initialBrightness, setInitialBrightness] = useState<number>(0.5);
  const [initialVolume, setInitialVolume] = useState<number>(0.5);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bufferCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isSeries, setIsSeries] = useState(computedIsSeries);
  const [availableSeasonsData, setAvailableSeasonsData] = useState<{ season: number, episodes_count: number }[]>([]);
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);

  const [showWatchTogether, setShowWatchTogether] = useState(() => {
    return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('room');
  });

  const [showSubSelector, setShowSubSelector] = useState(false);
  const [showQualitySelector, setShowQualitySelector] = useState(false);
  const [isSpeeding, setIsSpeeding] = useState(false);
  const [showEpisodeSelector, setShowEpisodeSelector] = useState(false);
  const [selectedSeasonInPanel, setSelectedSeasonInPanel] = useState<number | null>(null);
  const [episodesInSeason, setEpisodesInSeason] = useState<number>(0);
  const [episodeSearch, setEpisodeSearch] = useState<string>('');
  const [episodesDetails, setEpisodesDetails] = useState<any[]>([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [videoZoom, setVideoZoom] = useState(1); // 1 = normal, >1 = zoomed in
  const [pinchStartDistance, setPinchStartDistance] = useState<number | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const bufferingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showPauseInfo, setShowPauseInfo] = useState(false);
  const pauseInfoTimerRef = useRef<NodeJS.Timeout | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimeout = useRef<NodeJS.Timeout | null>(null);
  const autoSwitchCooldown = useRef(false);

  // For TV series, search using the name directly (do not strip colon suffixes as they might be part of the show name)
  const titleToSearch = computedIsSeries ? (movie.name || movie.title || "") : (movie.title || movie.name || "");
  const yearStr = movie.release_date?.split('-')[0] || movie.first_air_date?.split('-')[0];
  const year = yearStr ? parseInt(yearStr) : undefined;

  // Expected duration from TMDB (in seconds) — used when video.duration is unreliable (e.g. fragmented MP4 transcoding)
  const [expectedDuration, setExpectedDuration] = useState<number>(0);

  const embedUrl = computedIsSeries
    ? `https://v2.vidsrc.me/embed/tv/${movie.id}/${season}/${episode}`
    : `https://v2.vidsrc.me/embed/movie/${movie.id}`;

  const [hevcSupported, setHevcSupported] = useState(false);
  const [isTranscodedStream, setIsTranscodedStream] = useState(false);
  const [isTranscodeChecking, setIsTranscodeChecking] = useState(false);
  const [transcodeStartTime, setTranscodeStartTime] = useState(0);
  const historyResumedRef = useRef(false);
  const pendingSeekTimeRef = useRef<number | null>(null);

  // Detect HEVC support on mount
  useEffect(() => {
    try {
      const video = document.createElement('video');
      const supported = !!(
        video.canPlayType('video/mp4; codecs="hvc1"') || 
        video.canPlayType('video/mp4; codecs="hev1"')
      );
      setHevcSupported(supported);
      console.log("DEBUG: HEVC native support detected:", supported);
    } catch (e) {
      console.error("DEBUG: HEVC support check failed:", e);
    }
  }, []);

  const isNative = Capacitor.isNativePlatform();

  // Dynamic currentUrl builder that appends start_time and hevc supported params
  const currentUrl = (() => {
    if (useEmbed) return embedUrl;
    if (!selectedStreamUrl) return '';
    
    if (selectedStreamUrl.includes('/api/stream')) {
      let url = selectedStreamUrl;
      url = url.replace(/[?&]start_time=[^&]*/g, '');
      url = url.replace(/[?&]hevc=[^&]*/g, '');
      
      const separator = url.includes('?') ? '&' : '?';
      const hevcParam = hevcSupported ? 'hevc=1' : 'hevc=0';
      const startTimeParam = transcodeStartTime > 0 ? `&start_time=${transcodeStartTime}` : '';
      return `${url}${separator}${hevcParam}${startTimeParam}`;
    }
    return selectedStreamUrl;
  })();

  // Abortable check to determine if the stream will be transcoded — uses lightweight /check endpoint
  useEffect(() => {
    if (!selectedStreamUrl || useEmbed) {
      setIsTranscodedStream(false);
      setIsTranscodeChecking(false);
      return;
    }
    
    if (selectedStreamUrl.includes('/api/stream')) {
      const controller = new AbortController();
      const checkTranscode = async () => {
        setIsTranscodeChecking(true);
        try {
          // Use the lightweight /api/stream/check endpoint instead of fetching the full stream
          const yearParam = year ? `&year=${year}` : '';
          const hevcParam = hevcSupported ? 'hevc=1' : 'hevc=0';
          const checkUrl = `${backendUrl}/api/stream/check?title=${encodeURIComponent(titleToSearch)}&is_tv=${computedIsSeries}&season=${season}&episode=${episode}${yearParam}&${hevcParam}`;

          const res = await fetch(checkUrl, { signal: controller.signal });
          if (res.ok) {
            const data = await res.json();
            const isTranscoded = data.transcoded === true;
            setIsTranscodedStream(isTranscoded);
            console.log("DEBUG: Checked transcode status:", isTranscoded);
          } else {
            setIsTranscodedStream(false);
            console.log("DEBUG: Checked transcode status: false (check endpoint failed)");
          }
        } catch (e) {
          if (e.name !== 'AbortError') {
            console.error("DEBUG: Failed to check transcode status:", e);
          }
          setIsTranscodedStream(false);
        } finally {
          setIsTranscodeChecking(false);
        }
      };
      checkTranscode();
      return () => controller.abort();
    } else {
      setIsTranscodedStream(false);
      setIsTranscodeChecking(false);
    }
  }, [selectedStreamUrl, useEmbed, hevcSupported]);

  const currentTimeRef = useRef(0);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Resume from history or preserve playhead on quality switch
  useEffect(() => {
    if (!selectedStreamUrl || isTranscodeChecking || useEmbed) return;

    // Case 1: Initial load / history resume
    if (!historyResumedRef.current) {
      historyResumedRef.current = true;
      try {
        const history = getHistory();
        const item = history.find(h =>
          h.id === movie.id && (isSeries ? (h.season === season && h.episode === episode) : true)
        );
        if (item && item.timestamp > 10) {
          console.log(`DEBUG: Resuming history at ${item.timestamp}s. Transcoded: ${isTranscodedStream}`);
          if (isTranscodedStream) {
            setTranscodeStartTime(item.timestamp);
            setCurrentTime(item.timestamp);
          } else {
            pendingSeekTimeRef.current = item.timestamp;
            setCurrentTime(item.timestamp);
          }
        } else {
          setTranscodeStartTime(0);
        }
      } catch (e) {
        console.error("DEBUG: History resume error:", e);
      }
    } 
    // Case 2: Quality/source switch during playback
    else {
      const targetTime = currentTimeRef.current;
      console.log(`DEBUG: Quality switch. Preserving playhead at ${targetTime}s. Transcoded: ${isTranscodedStream}`);
      if (isTranscodedStream) {
        setTranscodeStartTime(targetTime);
      } else {
        pendingSeekTimeRef.current = targetTime;
        setTranscodeStartTime(0); // Reset transcode offset since it's now native seek
      }
    }
  }, [isTranscodeChecking, selectedStreamUrl, isTranscodedStream, movie.id, season, episode, isSeries, useEmbed]);

  const currentSeasonData = availableSeasonsData.find(s => s.season === season);
  const episodesCount = currentSeasonData ? currentSeasonData.episodes_count : 24;
  const episodeList = Array.from({ length: episodesCount }, (_, i) => i + 1);

  // Next Episode logic
  const hasNextEpisode = (() => {
    if (!computedIsSeries) return false;
    if (availableSeasonsData.length === 0) return true;
    // Check if there's a next episode in the current season
    if (episode < episodesCount) return true;
    // Check if there's a next season
    const sortedSeasons = [...availableSeasonsData].sort((a, b) => a.season - b.season);
    const currentSeasonIndex = sortedSeasons.findIndex(s => s.season === season);
    return currentSeasonIndex < sortedSeasons.length - 1;
  })();

  const handleNextEpisode = () => {
    if (!hasNextEpisode) return;
    triggerHaptic('MEDIUM');

    // Reset playback position
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }

    if (episode < episodesCount) {
      // Next episode in the same season
      setEpisode(episode + 1);
    } else {
      // Move to the first episode of the next season
      const sortedSeasons = [...availableSeasonsData].sort((a, b) => a.season - b.season);
      const currentSeasonIndex = sortedSeasons.findIndex(s => s.season === season);
      if (currentSeasonIndex < sortedSeasons.length - 1) {
        const nextSeason = sortedSeasons[currentSeasonIndex + 1];
        setSeason(nextSeason.season);
        setEpisode(1);
      }
    }

    setLoading(true);
    setIsPlaying(true);
    setDownloadLinks([]); // Clear cached download links for the new episode
  };

  // Consolidated orientation and subtitle track management
  useEffect(() => {
    const video = videoRef.current;
    const syncState = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
      if (video) {
        for (let i = 0; i < video.textTracks.length; i++) {
          video.textTracks[i].mode = 'hidden';
        }
      }
    };
    window.addEventListener('resize', syncState);
    if (video) {
      video.addEventListener('loadedmetadata', syncState);
      video.addEventListener('play', syncState);
    }
    syncState();
    const interval = setInterval(syncState, 2000); // Periodic check for stubborn browsers
    return () => {
      window.removeEventListener('resize', syncState);
      if (video) {
        video.removeEventListener('loadedmetadata', syncState);
        video.removeEventListener('play', syncState);
      }
      clearInterval(interval);
    };
  }, [selectedSubtitle, videoRef.current]);

  // Buffer Timeout Logic
  useEffect(() => {
    if (loading && !useEmbed) {
      if (bufferCheckTimeoutRef.current) clearTimeout(bufferCheckTimeoutRef.current);
      bufferCheckTimeoutRef.current = setTimeout(() => {
        if (loading) setErrorType('network');
      }, 12000);
    }
    return () => { if (bufferCheckTimeoutRef.current) clearTimeout(bufferCheckTimeoutRef.current); };
  }, [loading, useEmbed]);

  // Save progress periodically
  useEffect(() => {
    if (isPlaying && currentTime > 10 && !useEmbed) {
      saveHistory({
        id: movie.id,
        title: movie.title || movie.name || '',
        poster_path: movie.poster_path || '',
        timestamp: currentTime,
        duration: duration,
        season: isSeries ? season : undefined,
        episode: isSeries ? episode : undefined,
        isTV: isSeries
      });
    }
  }, [isPlaying, currentTime, duration, movie.id, isSeries, season, episode, useEmbed]);

  // Netflix-style pause info overlay after 3 seconds
  useEffect(() => {
    if (pauseInfoTimerRef.current) clearTimeout(pauseInfoTimerRef.current);
    if (!isPlaying && !loading && !errorType && currentTime > 0 && !useEmbed) {
      pauseInfoTimerRef.current = setTimeout(() => {
        setShowPauseInfo(true);
      }, 3000);
    } else {
      setShowPauseInfo(false);
    }
    return () => { if (pauseInfoTimerRef.current) clearTimeout(pauseInfoTimerRef.current); };
  }, [isPlaying, loading, errorType, currentTime, useEmbed]);

  // Reload video when season or episode changes
  useEffect(() => {
    if (videoRef.current && isSeries) {
      const wasPlaying = isPlaying;
      videoRef.current.load();
      if (wasPlaying) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => { });
        }
      }
    }
  }, [season, episode, currentUrl]);

  // Placeholder for auto-switch or retry logic if needed
  useEffect(() => {
    if (errorType && !useEmbed && retryCount < 2) {
      setRetryCount(prev => prev + 1);
      setErrorType(null);
      setLoading(true);
      if (videoRef.current) {
        videoRef.current.load();
        videoRef.current.play().catch(() => { });
      }
    } else if (errorType && !useEmbed) {
      setUseEmbed(true);
      setErrorType(null);
      setLoading(false);
    }
  }, [errorType, useEmbed, retryCount]);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (errorRetryTimeoutRef.current) clearTimeout(errorRetryTimeoutRef.current);
      if (Capacitor.isNativePlatform() && ScreenOrientation) {
        try { ScreenOrientation.unlock(); } catch (e) { }
      }
    };
  }, []);

  // Handle ESC key and Android back button for episode selector and main back navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showEpisodeSelector) {
          setShowEpisodeSelector(false);
          setSelectedSeasonInPanel(null);
          setEpisodesInSeason(0);
          setEpisodeSearch('');
        } else {
          // ESC from player goes back to home
          onBack();
        }
      }
    };

    const handleBackButton = () => {
      if (showEpisodeSelector) {
        setShowEpisodeSelector(false);
        setSelectedSeasonInPanel(null);
        setEpisodesInSeason(0);
        setEpisodeSearch('');
        return true; // Prevent default back action
      }
      // Back button from player should go back to home screen
      onBack();
      return true;
    };

    window.addEventListener('keydown', handleKeyDown);

    if (Capacitor.isNativePlatform() && App) {
      const listener = App.addListener('backButton', () => {
        handleBackButton();
      });
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        listener.remove();
      };
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showEpisodeSelector, onBack]);

  // Auto-fullscreen on landscape orientation only if not manually toggled or already in it
  useEffect(() => {
    if (Capacitor.isNativePlatform() && isLandscape && !document.fullscreenElement) {
      toggleFullscreen();
    }
  }, [isLandscape]);

  // Auto-select season when episode selector is opened
  useEffect(() => {
    if (showEpisodeSelector && selectedSeasonInPanel === null) {
      handleSeasonSelect(season);
    }
  }, [showEpisodeSelector]);

  // Fetch episode details from TMDB
  useEffect(() => {
    if (showEpisodeSelector && selectedSeasonInPanel !== null) {
      const fetchEpisodes = async () => {
        setIsLoadingEpisodes(true);
        try {
          const url = `${BASE_URL}/tv/${movie.id}/season/${selectedSeasonInPanel}?api_key=${API_KEY}`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data && data.episodes) {
              setEpisodesDetails(data.episodes);
              setIsLoadingEpisodes(false);
              return;
            }
          }
        } catch (err) {
          console.error("Error fetching season details from TMDB:", err);
        }
        
        // Fallback: build basic array using episodesInSeason
        const fallbackCount = episodesInSeason || 24;
        const fallbackList = Array.from({ length: fallbackCount }, (_, i) => ({
          episode_number: i + 1,
          name: `Episode ${i + 1}`,
          overview: 'No description available.',
          still_path: null,
          runtime: null,
        }));
        setEpisodesDetails(fallbackList);
        setIsLoadingEpisodes(false);
      };
      
      fetchEpisodes();
    } else {
      setEpisodesDetails([]);
    }
  }, [showEpisodeSelector, selectedSeasonInPanel, movie.id, episodesInSeason]);

  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlayingRef.current) {
        setShowControls(false);
      }
    }, 2000);
  };

  const handleSeasonSelect = (seasonNum: number) => {
    setSelectedSeasonInPanel(seasonNum);
    const seasonData = availableSeasonsData.find(s => s.season === seasonNum);
    setEpisodesInSeason(seasonData?.episodes_count || 0);
  };

  const handleEpisodeSelect = (episodeNum: number) => {
    if (selectedSeasonInPanel === null) return;

    // Update season and episode (useEffect will handle video reload)
    setSeason(selectedSeasonInPanel);
    setEpisode(episodeNum);
    setIsPlaying(true); // Auto-play the new episode

    // Reset video position
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }

    // Close the episode selector
    setShowEpisodeSelector(false);
    setSelectedSeasonInPanel(null);
    setEpisodesInSeason(0);
    setEpisodeSearch('');
  };

  const handleMouseMove = () => {
    resetControlsTimer();
  };

  const triggerHaptic = (style: string = 'LIGHT') => {
    if (Capacitor.isNativePlatform() && Haptics) {
      try { Haptics.impact({ style }); } catch (e) { }
    }
  };

  const toggleFullscreen = async () => {
    triggerHaptic('MEDIUM');

    if (!document.fullscreenElement) {
      try {
        // Request fullscreen on documentElement for true immersive mode
        const docElement = document.documentElement;
        if (docElement.requestFullscreen) {
          await docElement.requestFullscreen();
        } else if ((docElement as any).webkitRequestFullscreen) {
          await (docElement as any).webkitRequestFullscreen();
        } else if ((docElement as any).mozRequestFullScreen) {
          await (docElement as any).mozRequestFullScreen();
        } else if ((docElement as any).msRequestFullscreen) {
          await (docElement as any).msRequestFullscreen();
        }

        setIsLandscape(true);

        // Lock to landscape orientation
        if (Capacitor.isNativePlatform() && ScreenOrientation) {
          try {
            await ScreenOrientation.lock({ orientation: 'landscape' });
          } catch (e) {
            console.log('Orientation lock failed:', e);
          }
        }

        // Hide status bar on native platforms
        if (Capacitor.isNativePlatform()) {
          try {
            const { StatusBar } = await import('@capacitor/status-bar');
            await StatusBar.hide();
          } catch (e) {
            console.log('StatusBar hide failed:', e);
          }
        }
      } catch (err) {
        console.error("Fullscreen Error:", err);
      }
    } else {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if ((document as any).webkitExitFullscreen) await (document as any).webkitExitFullscreen();
        else if ((document as any).mozCancelFullScreen) await (document as any).mozCancelFullScreen();
        else if ((document as any).msExitFullscreen) await (document as any).msExitFullscreen();

        setIsLandscape(false);

        // Unlock orientation
        if (Capacitor.isNativePlatform() && ScreenOrientation) {
          try {
            await ScreenOrientation.unlock();
          } catch (e) {
            console.log('Orientation unlock failed:', e);
          }
        }

        // Show status bar on native platforms
        if (Capacitor.isNativePlatform()) {
          try {
            const { StatusBar } = await import('@capacitor/status-bar');
            await StatusBar.show();
          } catch (e) {
            console.log('StatusBar show failed:', e);
          }
        }
      } catch (err) {
        console.error("Exit Fullscreen Error:", err);
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (useEmbed) return;
    resetControlsTimer();

    // 2-Finger Pinch Zoom Detection
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      setPinchStartDistance(distance);
      return; // Don't process other gestures when pinching
    }

    // Start Long Press Detection for 2x Speed
    if (longPressTimeout.current) clearTimeout(longPressTimeout.current);
    longPressTimeout.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setIsSpeeding(true);
        videoRef.current.playbackRate = 2.0;
        triggerHaptic('MEDIUM');
      }
    }, 600); // 600ms for long press

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setSwipeStartX(touch.clientX);
      setSwipeStartY(touch.clientY);
      setIsSwiping(true);
      // Determine which side of screen was touched
      const side = touch.clientX < window.innerWidth / 2 ? 'left' : 'right';
      setSwipeSide(side);

      // Get current values for smooth adjustment
      if (side === 'left' && Capacitor.isNativePlatform()) {
        // Get brightness for left side
        ScreenBrightness.getBrightness().then(result => {
          setInitialBrightness(result.brightness);
        }).catch(() => setInitialBrightness(0.5));
      } else if (side === 'right' && videoRef.current) {
        // Use video volume for right side
        setInitialVolume(videoRef.current.volume);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (longPressTimeout.current) clearTimeout(longPressTimeout.current);

    // Handle 2-Finger Pinch Zoom
    if (e.touches.length === 2 && pinchStartDistance !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      const zoomDelta = (currentDistance - pinchStartDistance) / 200;
      const newZoom = Math.max(1, Math.min(2.5, videoZoom + zoomDelta));
      setVideoZoom(newZoom);
      setPinchStartDistance(currentDistance);
      return;
    }

    if (!isSwiping || !swipeStartX || !swipeStartY || useEmbed) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeStartX;
    const deltaY = touch.clientY - swipeStartY;

    if (!swipeDirection) {
      if (Math.abs(deltaX) > 20) setSwipeDirection('horizontal');
      else if (Math.abs(deltaY) > 20) setSwipeDirection('vertical');
      return;
    }

    if (swipeDirection === 'horizontal') {
      const seekSeconds = Math.round((deltaX / window.innerWidth) * 90);
      setSwipeAmount(seekSeconds);
      setSwipeFeedback({
        type: 'SEEK',
        value: `${seekSeconds > 0 ? 'Forward' : 'Rewind'} ${Math.abs(seekSeconds)}s`
      });
    } else if (swipeDirection === 'vertical') {
      // Increased sensitivity: changed from 0.1 to 1.0 multiplier
      const changeDelta = -(deltaY / window.innerHeight);
      setSwipeAmount(changeDelta);

      if (swipeSide === 'right') {
        // Right side controls device volume
        const newVol = Math.max(0, Math.min(1, initialVolume + changeDelta));

        if (videoRef.current) {
          videoRef.current.volume = newVol;
        }

        setSwipeFeedback({
          type: 'VOLUME',
          value: `Volume ${Math.round(newVol * 100)}%`
        });
      } else {
        // Left side controls device brightness
        const newBrightness = Math.max(0, Math.min(1, initialBrightness + changeDelta));

        if (Capacitor.isNativePlatform()) {
          ScreenBrightness.setBrightness({ brightness: newBrightness }).catch(() => { });
        }

        setSwipeFeedback({
          type: 'BRIGHTNESS',
          value: `Brightness ${Math.round(newBrightness * 100)}%`
        });
      }
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimeout.current) clearTimeout(longPressTimeout.current);

    // Reset pinch zoom tracking
    setPinchStartDistance(null);

    if (isSpeeding) {
      setIsSpeeding(false);
      if (videoRef.current) videoRef.current.playbackRate = 1.0;
      triggerHaptic('LIGHT');
    }

    if (!isSwiping || useEmbed) return;

    if (swipeDirection === 'horizontal' && videoRef.current) {
      const seekTime = Math.max(0, Math.min(displayDuration, currentTime + swipeAmount));
      if (isTranscodedStream) {
        setTranscodeStartTime(seekTime);
        setCurrentTime(seekTime);
        setLoading(true);
      } else {
        videoRef.current.currentTime = seekTime;
        setCurrentTime(seekTime);
      }
      triggerHaptic('MEDIUM');
    } else if (swipeDirection === 'vertical') {
      triggerHaptic('LIGHT');
    }

    setIsSwiping(false);
    setSwipeStartX(null);
    setSwipeStartY(null);
    setSwipeDirection(null);
    setSwipeAmount(0);
    setSwipeSide(null);
    resetControlsTimer();
    setTimeout(() => setSwipeFeedback(null), 500);
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
    resetControlsTimer();
  };

  const skip = (amount: number) => {
    if (!videoRef.current) return;
    triggerHaptic('LIGHT');
    
    const targetTime = currentTime + amount;
    const seekTime = Math.max(0, Math.min(displayDuration, targetTime));
    
    if (isTranscodedStream) {
      setTranscodeStartTime(seekTime);
      setCurrentTime(seekTime);
      setLoading(true);
    } else {
      videoRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
    setTimeout(syncSubtitles, 50);
  };

  // Compute a reliable display duration: prefer video.duration if it looks correct, fall back to TMDB runtime
  const displayDuration = (() => {
    // If video reports a reasonable finite duration (> 2 minutes), trust it
    if (duration > 0 && isFinite(duration) && duration > 120) return duration;
    // Otherwise use TMDB expected duration if available
    if (expectedDuration > 0) return expectedDuration;
    // Last resort: use whatever video reports
    return duration;
  })();

  const handleTimeUpdate = () => {
    if (videoRef.current && !isSeeking) {
      const videoTime = videoRef.current.currentTime;
      setCurrentTime(videoTime + transcodeStartTime);
      
      const reportedDuration = videoRef.current.duration;
      // Only update state duration if the video reports something reasonable and it's not transcoded
      if (isFinite(reportedDuration) && reportedDuration > 0 && !isTranscodedStream) {
        setDuration(reportedDuration);
      }

      // Robust subtitle sync: Fallback for when oncuechange doesn't fire
      const video = videoRef.current;
      const activeTracks = (Array.from(video.textTracks) as TextTrack[]).filter(t => t.mode !== 'disabled');
      if (activeTracks.length > 0) {
        const track = activeTracks[0];
        if (track.activeCues && track.activeCues.length > 0) {
          const text = Array.from(track.activeCues)
            .map((cue: any) => (cue as any).text || '')
            .join('\n');
          if (activeCue !== text) setActiveCue(text);
        } else if (activeCue !== '') {
          setActiveCue('');
        }
      }
    }
  };

  const syncSubtitles = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const activeTracks = (Array.from(video.textTracks) as TextTrack[]).filter(t => t.mode !== 'disabled');
    if (activeTracks.length > 0) {
      const track = activeTracks[0];
      if (track.activeCues && track.activeCues.length > 0) {
        const text = Array.from(track.activeCues)
          .map((cue: any) => cue.text || '')
          .join('\n');
        setActiveCue(prev => prev !== text ? text : prev);
      } else {
        setActiveCue(prev => prev !== '' ? '' : prev);
      }
    } else {
      setActiveCue(prev => prev !== '' ? '' : prev);
    }
  };

  const errorRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onPlayerError = () => {
    // Prevent rapid-fire retry loops by adding exponential backoff
    if (errorRetryTimeoutRef.current) {
      // Already waiting for a retry, don't stack another one
      return;
    }

    const currentIndex = streamUrls.findIndex(s => s.url === selectedStreamUrl);
    if (currentIndex !== -1 && currentIndex < streamUrls.length - 1) {
      // Add exponential backoff: 2s, 4s, 8s based on retry count
      const delay = Math.min(2000 * Math.pow(2, retryCount), 10000);
      console.warn(`Player Error detected. Retrying next mirror/quality in ${delay}ms (retry ${retryCount + 1})...`);
      setRetryCount(prev => prev + 1);
      
      errorRetryTimeoutRef.current = setTimeout(() => {
        errorRetryTimeoutRef.current = null;
        setSelectedStreamUrl(streamUrls[currentIndex + 1].url);
        setSelectedQuality(streamUrls[currentIndex + 1].quality);
      }, delay);
      return;
    }
    console.warn("Player Error: All mirrors exhausted.");
    setErrorType('BUSY');
    setLoading(false);
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
    if (!isTranscodedStream && videoRef.current) {
      videoRef.current.currentTime = time;
    }
    resetControlsTimer();
    syncSubtitles();
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeekEnd = (e: React.SyntheticEvent<HTMLInputElement>) => {
    // Ensure the video seeks to the final position on mouse/touch release
    const time = Number((e.target as HTMLInputElement).value);
    if (isTranscodedStream) {
      setTranscodeStartTime(time);
      setCurrentTime(time);
      setLoading(true);
    } else {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
      setCurrentTime(time);
    }
    setIsSeeking(false);
    resetControlsTimer();
    setTimeout(syncSubtitles, 50);
  };

  // Handle direct click on the seek bar (not drag)
  const handleSeekBarClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const seekTime = percentage * displayDuration;
    if (displayDuration > 0) {
      if (isTranscodedStream) {
        setTranscodeStartTime(seekTime);
        setCurrentTime(seekTime);
        setLoading(true);
      } else {
        if (videoRef.current) {
          videoRef.current.currentTime = seekTime;
        }
        setCurrentTime(seekTime);
      }
    }
    resetControlsTimer();
    setTimeout(syncSubtitles, 50);
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

  // Fetch expected runtime from TMDB details
  useEffect(() => {
    const fetchRuntime = async () => {
      try {
        const type = computedIsSeries ? 'tv' : 'movie';
        const res = await fetch(`${BASE_URL}/${type}/${movie.id}?api_key=${API_KEY}`);
        const data = await res.json();
        if (data.runtime) {
          // Movies: runtime in minutes
          setExpectedDuration(data.runtime * 60);
        } else if (data.episode_run_time && data.episode_run_time.length > 0) {
          // TV shows: average episode runtime
          setExpectedDuration(data.episode_run_time[0] * 60);
        } else if (data.last_episode_to_air?.runtime) {
          setExpectedDuration(data.last_episode_to_air.runtime * 60);
        }
      } catch (err) {
        console.error("Runtime fetch error:", err);
      }
    };
    fetchRuntime();
  }, [movie.id, computedIsSeries]);

  useEffect(() => {
    setSeason(initialSeason);
    setEpisode(initialEpisode);
    setIsSeries(computedIsSeries);
    setAvailableSeasonsData([]);
    setErrorType(null);
    setLoading(true);
    setTranscodeStartTime(0);
    setIsTranscodedStream(false);
    historyResumedRef.current = false;
  }, [movie.id, initialSeason, initialEpisode, computedIsSeries]);

  useEffect(() => {
    if (!titleToSearch) return;
    setLoading(true);

    // 1. Get Clean Backend Stream (Vidsrc/Proxy)
    const fetchDirect = async () => {
      const yearParam = year ? `&year=${year}` : '';
      try {
        console.log("DEBUG: Setting Backend Stream...");
        const backendStreamUrl = `${backendUrl}/api/stream?id=${movie.id}&title=${encodeURIComponent(titleToSearch)}&is_tv=${computedIsSeries}&season=${season}&episode=${episode}${yearParam}`;

        // We set the backend as our first source. If it fails, standard React error handling will kick in.
        setStreamUrls([{ quality: 'Auto (Clean)', url: backendStreamUrl }]);
        setSelectedStreamUrl(backendStreamUrl);
        setSelectedQuality('Auto (Clean)');
        setUseEmbed(false);
        setLoading(false);
      } catch (err) {
        console.error("DEBUG: Backend setup failed:", err);
      }

      // Fetch qualities from backend
      try {
        const qualUrl = `${backendUrl}/api/qualities?title=${encodeURIComponent(titleToSearch)}&is_tv=${computedIsSeries}&season=${season}&episode=${episode}${yearParam}`;
        const qualRes = await fetch(qualUrl);
        if (qualRes.ok) {
          const qualData = await qualRes.json();
          if (Array.isArray(qualData) && qualData.length > 0) {
            const formattedQualities = qualData.map((q: string) => ({
              quality: q,
              url: `${backendUrl}/api/stream?title=${encodeURIComponent(titleToSearch)}&quality=${encodeURIComponent(q)}&is_tv=${computedIsSeries}&season=${season}&episode=${episode}${yearParam}`
            }));
            // Prepend Auto option
            formattedQualities.unshift({ quality: 'Auto (Clean)', url: `${backendUrl}/api/stream?title=${encodeURIComponent(titleToSearch)}&is_tv=${computedIsSeries}&season=${season}&episode=${episode}${yearParam}` });
            setStreamUrls(formattedQualities);
            setQualities(formattedQualities.map(q => q.quality));
          }
        }
      } catch (err) { console.log("Quality fetch failed:", err); }

      // Fetch subtitles from backend separately
      try {
        const subsUrl = `${backendUrl}/api/subtitles?title=${encodeURIComponent(titleToSearch)}&is_tv=${computedIsSeries}&season=${season}&episode=${episode}${yearParam}`;
        const subsRes = await fetch(subsUrl);
        if (subsRes.ok) {
          const subsData = await subsRes.json();
          if (Array.isArray(subsData) && subsData.length > 0) {
            // Proxy subtitle URLs through backend
            const proxiedSubs = subsData.map((s: any) => ({
              language: s.language || 'Unknown',
              url: `${backendUrl}/api/subtitles/proxy?url=${encodeURIComponent(s.url)}`
            }));
            setSubtitles(proxiedSubs);
            // Check preferred subtitle language
            let preferredLang = 'english';
            try {
              const saved = localStorage.getItem('movie_night_preferred_subtitle_lang');
              if (saved) preferredLang = saved.toLowerCase();
            } catch (e) {}

            if (preferredLang === 'off') {
              setSelectedSubtitle('');
            } else {
              const matchedSub = proxiedSubs.find((s: any) => s.language.toLowerCase().includes(preferredLang));
              if (matchedSub) {
                setSelectedSubtitle(matchedSub.url);
              } else {
                // Fallback to English
                const englishSub = proxiedSubs.find((s: any) => s.language.toLowerCase().includes('english'));
                if (englishSub) {
                  setSelectedSubtitle(englishSub.url);
                }
              }
            }
          }
        }
      } catch (subErr) {
        console.log("Subtitle fetch failed (non-critical):", subErr);
      }
    };

    fetchDirect();
  }, [titleToSearch, season, episode, backendUrl]);

  // Fetch TV Metadata (Seasons/Episodes)
  useEffect(() => {
    if (!computedIsSeries || !titleToSearch) return;
    
    const fetchTVMeta = async () => {
      const yearParam = year ? `&year=${year}` : '';
      try {
        const url = `${backendUrl}/api/metadata?title=${encodeURIComponent(titleToSearch)}${yearParam}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && data.seasons) {
            setAvailableSeasonsData(data.seasons);
            // If we're on the first load, set episodes count for the current season
            const currentSeason = data.seasons.find((s: any) => s.season === season);
            if (currentSeason) {
              setEpisodesInSeason(currentSeason.episodes_count);
            }
          }
        }
      } catch (err) {
        console.error("TV Metadata fetch error:", err);
      }
    };
    fetchTVMeta();
  }, [titleToSearch, computedIsSeries, backendUrl]);

  useEffect(() => {
    if (!videoRef.current || useEmbed || !selectedQuality || !currentUrl || isTranscodeChecking) return;
    const video = videoRef.current;

    // Check preferred subtitle language
    let preferredLang = 'english';
    try {
      const saved = localStorage.getItem('movie_night_preferred_subtitle_lang');
      if (saved) preferredLang = saved.toLowerCase();
    } catch (e) {}

    if (preferredLang === 'off') {
      if (selectedSubtitle) setSelectedSubtitle('');
    } else if (subtitles.length > 0 && !selectedSubtitle) {
      const matchedSub = subtitles.find(s => s.language.toLowerCase().includes(preferredLang)) || 
                         subtitles.find(s => s.language.toLowerCase().includes('english')) || 
                         subtitles[0];
      setSelectedSubtitle(matchedSub.url);
    }

    // Cleanup previous HLS instance
    if ((window as any).hls) {
      (window as any).hls.destroy();
      (window as any).hls = null;
    }

    // Improved HLS detection: check for .m3u8 explicitly.
    // If it's our backend proxy, we'll try HLS if it doesn't look like a direct file, 
    // but we'll add a robust fallback in the error handler.
    const isHls = currentUrl.includes('.m3u8');


    if (isHls) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 60
        });
        hls.loadSource(currentUrl);
        hls.attachMedia(video);
        (window as any).hls = hls;

        // Extract quality levels when manifest is parsed
        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          if (data.levels && data.levels.length > 1) {
            const qualityOptions: { quality: string, url: string }[] = data.levels.map((level: any, index: number) => ({
              quality: level.height ? `${level.height}p` : `Quality ${index + 1}`,
              url: `hls-level-${index}` // Special marker for HLS level switching
            }));
            // Add Auto option at the beginning
            qualityOptions.unshift({ quality: 'Auto (HLS)', url: currentUrl });
            setStreamUrls(qualityOptions);
            setQualities(qualityOptions.map(q => q.quality));
          }
        });

        // Handle level switching
        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
          const level = hls.levels[data.level];
          if (level && level.height) {
            setSelectedQuality(`${level.height}p`);
          }
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.warn("HLS fatal error:", data.type, "Attempting direct fallback...");
            // Fallback: If HLS fails, try loading the URL directly as a standard video file
            hls.destroy();
            video.src = currentUrl;
            video.load();
            video.play().catch(() => { });
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = currentUrl;
      }
    } else if (video.src !== currentUrl) {
      video.src = currentUrl;
    }

    video.load();

    // Note: History resume is handled by the dedicated useEffect when transcode status is ready.

    video.play().catch(() => { });
  }, [currentUrl, useEmbed, isTranscodeChecking]);


  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const handleCueChange = () => {
      const tracks = video.textTracks;
      let activeText = '';

      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (track && track.mode !== 'disabled' && track.activeCues && track.activeCues.length > 0) {
          activeText = Array.from(track.activeCues)
            .map((cue: any) => cue.text || '')
            .join('\n');
          break;
        }
      }
      setActiveCue(activeText);
    };

    const setupTracks = () => {
      const tracks = video.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (track) {
          track.mode = 'hidden';
          track.oncuechange = handleCueChange;
        }
      }
    };

    video.textTracks.onaddtrack = (e: TrackEvent) => {
      const track = e.track as TextTrack;
      if (track) {
        track.mode = 'hidden';
        track.oncuechange = handleCueChange;
      }
    };
    setupTracks();

    return () => {
      video.textTracks.onaddtrack = null;
      const tracks = video.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (track) {
          track.oncuechange = null;
        }
      }
    };
  }, [selectedSubtitle]);

  // Double Tap Logic
  const lastTapRef = useRef<{ time: number, x: number } | null>(null);
  const handleDoubleTap = (e: React.TouchEvent | React.MouseEvent, zone: 'left' | 'right' | 'center') => {
    const now = Date.now();
    const isTouch = 'touches' in e;
    const clientX = isTouch ? (e as React.TouchEvent).touches[0]?.clientX : (e as React.MouseEvent).clientX;

    if (lastTapRef.current && (now - lastTapRef.current.time) < 300) {
      // Double tap detected
      if (zone === 'left') {
        skip(-10);
        setSwipeFeedback({ type: 'SEEK', value: 'Rewind 10s' });
        setTimeout(() => setSwipeFeedback(null), 800);
      } else if (zone === 'right') {
        skip(10);
        setSwipeFeedback({ type: 'SEEK', value: 'Forward 10s' });
        setTimeout(() => setSwipeFeedback(null), 800);
      } else {
        togglePlay();
      }
      lastTapRef.current = null;
    } else {
      // Single tap - toggle controls
      lastTapRef.current = { time: now, x: clientX };
      if (showControls) {
        setShowControls(false);
      } else {
        resetControlsTimer();
      }
    }
  };

  const renderVideoPlayer = () => {
    const isNotReleased = (() => {
      const dateStr = movie.release_date || movie.first_air_date;
      if (!dateStr) return false;
      const releaseDate = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return releaseDate > today;
    })();

    if (isNotReleased) {
      return (
        <div className="absolute inset-0 bg-[#070707] flex flex-col items-center justify-center p-6 text-center z-50">
          <Info className="w-16 h-16 text-[#e50914] mb-4 animate-bounce" />
          <h2 className="text-2xl md:text-4xl font-black text-white mb-2 uppercase tracking-tight">Coming Soon</h2>
          <p className="text-white/60 text-xs md:text-sm max-w-md uppercase tracking-widest leading-relaxed">
            "{movie.title || movie.name}" is scheduled to premiere on <span className="text-[#e50914] font-bold">{new Date(movie.release_date || movie.first_air_date || '').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>.
          </p>
        </div>
      );
    }

    return (
      <div
        className={`relative w-full overflow-hidden bg-black flex items-center justify-center group ${isLandscape ? 'h-full flex-1' : 'aspect-video'}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Double Tap Zones */}
        {!useEmbed && (
          <>
            <div
              className="absolute top-0 left-0 w-[35%] z-30"
              style={{ bottom: '80px' }}
              onClick={(e) => handleDoubleTap(e, 'left')}
            />
            <div
              className="absolute top-0 right-0 w-[35%] z-30"
              style={{ bottom: '80px' }}
              onClick={(e) => handleDoubleTap(e, 'right')}
            />
            <div
              className="absolute top-0 left-[35%] right-[35%] z-30 flex items-center justify-center"
              style={{ bottom: '80px' }}
              onClick={(e) => handleDoubleTap(e, 'center')}
            />
          </>
        )}

        {useEmbed ? (
          <iframe
            src={embedUrl}
            className="w-full h-full border-none"
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture"
            sandbox="allow-forms allow-scripts allow-pointer-lock allow-same-origin allow-top-navigation"
          />
        ) : (
          <>
<video
               key={isTranscodeChecking ? 'checking-transcode' : currentUrl}
               ref={videoRef}
               className="w-full h-full object-contain transition-transform duration-200"
               style={{ transform: `scale(${videoZoom})` }}
               playsInline
               preload="auto"
               onCanPlay={() => {
                 setLoading(false);
                 setIsBuffering(false);
                 setErrorType(null);
                 setRetryCount(0);
                 if (bufferingTimeoutRef.current) clearTimeout(bufferingTimeoutRef.current);
                 if (pendingSeekTimeRef.current !== null) {
                   const seekTo = pendingSeekTimeRef.current;
                   pendingSeekTimeRef.current = null;
                   if (videoRef.current) {
                     console.log(`DEBUG: Applying pending seek to ${seekTo}s`);
                     videoRef.current.currentTime = seekTo;
                   }
                 }
               }}
               onWaiting={() => {
                 // Only show buffering indicator if it actually takes a while (800ms)
                 if (bufferingTimeoutRef.current) clearTimeout(bufferingTimeoutRef.current);
                 bufferingTimeoutRef.current = setTimeout(() => {
                   setIsBuffering(true);
                 }, 800);
               }}
               onPlaying={() => {
                 setIsPlaying(true);
                 setLoading(false);
                 setIsBuffering(false);
                 if (bufferingTimeoutRef.current) clearTimeout(bufferingTimeoutRef.current);
               }}
               onPause={() => { setIsPlaying(false); syncSubtitles(); }}
               onSeeked={syncSubtitles}
               onTimeUpdate={handleTimeUpdate}
               onError={onPlayerError}
               onLoadedMetadata={() => {
                 if (videoRef.current) setDuration(videoRef.current.duration);
               }}
               crossOrigin={selectedSubtitle ? "anonymous" : undefined}
             >
              {selectedSubtitle && (
                <track
                  key={selectedSubtitle}
                  src={selectedSubtitle}
                  kind="subtitles"
                  srcLang="en"
                  label={subtitles.find(s => s.url === selectedSubtitle)?.language || 'Subtitles'}
                  default
                />
              )}
            </video>

            {!isPlaying && !loading && !errorType && currentUrl && (
              <div
                className="absolute inset-0 z-40 flex items-center justify-center cursor-pointer bg-black/20"
                onClick={(e) => { e.stopPropagation(); videoRef.current?.play().catch(() => { }); }}
              >
                {!showPauseInfo && (
                  <div className="w-24 h-24 bg-[#E50914] rounded-full flex items-center justify-center shadow-2xl scale-110 active:scale-95 transition-all">
                    <Play className="w-12 h-12 text-white fill-white ml-1" />
                  </div>
                )}
              </div>
            )}

            {/* Netflix-style Pause Info Overlay */}
            {showPauseInfo && !loading && !errorType && (
              <div
                className="absolute inset-0 z-[45] bg-gradient-to-r from-black/80 via-black/40 to-transparent flex items-center transition-all duration-700 animate-in fade-in slide-in-from-left-8 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); videoRef.current?.play().catch(() => { }); }}
              >
                <div className="max-w-lg px-8 md:px-16 space-y-4">
                  <p className="text-white/50 text-xs font-medium tracking-wide">You're watching</p>
                  <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">
                    {movie.title || movie.name}
                  </h2>
                  {isSeries && (
                    <p className="text-white/70 text-sm font-bold">Season {season}, Episode {episode}</p>
                  )}
                  <div className="flex items-center space-x-3 text-sm">
                    {movie.vote_average && (
                      <span className="text-green-400 font-bold">{Math.round(movie.vote_average * 10)}% Match</span>
                    )}
                    {(movie.release_date || movie.first_air_date) && (
                      <span className="text-white/50">{(movie.release_date || movie.first_air_date || '').split('-')[0]}</span>
                    )}
                    <span className="border border-white/30 px-1.5 py-0.5 rounded text-[10px] text-white/50 font-bold">HD</span>
                  </div>
                  {movie.overview && (
                    <p className="text-white/60 text-sm leading-relaxed line-clamp-4 max-w-md">
                      {movie.overview}
                    </p>
                  )}
                  <div className="flex items-center space-x-3 pt-2">
                    <div className="flex items-center space-x-2 px-5 py-2.5 bg-white rounded-sm">
                      <Play className="w-4 h-4 text-black fill-black" />
                      <span className="text-black font-bold text-sm">Resume</span>
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-8 right-8 md:right-16">
                  <span className="text-white/30 text-sm font-medium tracking-wide">Paused</span>
                </div>
              </div>
            )}

            {(loading || isBuffering) && !errorType && !useEmbed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] z-20 transition-all duration-500">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-2 border-white/5" />
                  <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-t-[#e50914] animate-spin" />
                </div>
                <p className="text-white/40 font-black text-[7px] uppercase tracking-[0.4em] mt-6 animate-pulse">
                  {loading ? 'Initializing' : 'Buffering'}
                </p>
              </div>
            )}

            {isSpeeding && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[100] bg-white/[0.03] backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5 flex items-center space-x-2 animate-pulse pointer-events-none">
                <Zap className="w-2.5 h-2.5 text-white/40 fill-white/40" />
                <span className="text-white/40 font-black text-[7px] uppercase tracking-[0.3em]">2X Forwarding</span>
              </div>
            )}

            {swipeFeedback && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[100] bg-white/[0.03] backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5 flex items-center space-x-2 pointer-events-none">
                {swipeFeedback.type === 'VOLUME' ? (
                  <Volume2 className="w-2.5 h-2.5 text-white/40 fill-white/40" />
                ) : swipeFeedback.type === 'BRIGHTNESS' ? (
                  <Monitor className="w-2.5 h-2.5 text-white/40 fill-white/40" />
                ) : (
                  <RotateCw className="w-2.5 h-2.5 text-white/40 fill-white/40" />
                )}
                <span className="text-white/40 font-black text-[7px] uppercase tracking-[0.3em]">{swipeFeedback.value}</span>
              </div>
            )}

            {/* Skip Intro Button */}
            {isPlaying && currentTime >= 10 && currentTime <= 90 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('MEDIUM');
                  if (videoRef.current) {
                    videoRef.current.currentTime = 90;
                    setCurrentTime(90);
                  }
                }}
                className="absolute bottom-24 right-8 z-[60] bg-black/80 hover:bg-black/95 text-white border border-white/20 hover:border-white/40 px-5 py-2.5 rounded shadow-2xl flex items-center space-x-2 transition-all hover:scale-105 active:scale-95 duration-200 cursor-pointer text-xs font-black uppercase tracking-wider"
              >
                <SkipForward className="w-3.5 h-3.5 fill-white" />
                <span>Skip Intro</span>
              </button>
            )}

            <div className={`pointer-events-none absolute inset-0 z-40 flex flex-col justify-between transition-opacity duration-300 ${showControls && !showPauseInfo ? 'opacity-100' : 'opacity-0'}`}>
              {/* Top Bar - Netflix Style */}
              <div className={`pointer-events-none ${showControls && !showPauseInfo ? 'pointer-events-auto' : ''} p-4 flex items-center justify-between transition-all duration-300 ${isLandscape ? 'pt-12 pl-12 pr-12' : 'pt-[max(1rem,env(safe-area-inset-top))]'}`}>
                <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="p-2 active:scale-95 transition-all text-white">
                  <ArrowLeft className="w-6 h-6" />
                </button>

                {/* Episode Title - Center */}
                {isSeries && (
                  <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none">
                    <p className="text-white text-[10px] font-black uppercase tracking-widest opacity-80 shadow-sm">S{season}:E{episode} "{movie.name}"</p>
                  </div>
                )}

                {/* Minimal Icon Controls - Top Right */}
                <div className="flex items-center space-x-4">


                  {/* Subtitle Icon */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowSubSelector(!showSubSelector); setShowQualitySelector(false); setShowEpisodeSelector(false); }}
                    className="p-2 text-white active:scale-95 transition-all"
                  >
                    <Languages className="w-5 h-5" />
                  </button>

                  {/* Quality Icon */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowQualitySelector(!showQualitySelector); setShowSubSelector(false); setShowEpisodeSelector(false); }}
                    className="p-2 text-white active:scale-95 transition-all"
                  >
                    <MonitorPlay className="w-5 h-5" />
                  </button>

                  {/* Download Icon */}
                  <button
                    onClick={(e) => { e.stopPropagation(); fetchDownloadLinks(); }}
                    className="p-2 text-white active:scale-95 transition-all"
                  >
                    <Download className="w-5 h-5" />
                  </button>

                  {/* Settings Icon */}
                  {isLandscape && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowSubSettings(!showSubSettings); setShowSubSelector(false); setShowQualitySelector(false); setShowEpisodeSelector(false); }}
                      className="p-2 text-white active:scale-95 transition-all"
                    >
                      <Settings2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>



              {/* Subtitle Selector Dropdown */}
              {showSubSelector && (
                <div className={`pointer-events-none ${showControls && !showPauseInfo ? 'pointer-events-auto' : ''} absolute top-20 right-4 w-64 bg-black/95 backdrop-blur-2xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 z-[100]`}>
                  <div className="p-3 border-b border-white/5">
                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Subtitles</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    <button
                      onClick={() => {
                        setSelectedSubtitle('');
                        setActiveCue('');
                        setShowSubSelector(false);
                        try {
                          localStorage.setItem('movie_night_preferred_subtitle_lang', 'off');
                        } catch (e) {}
                      }}
                      className={`w-full px-4 py-3 text-left transition-colors ${!selectedSubtitle ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'}`}
                    >
                      <span className="text-sm">Off</span>
                    </button>
                    {subtitles.length > 0 ? (
                      subtitles.map(s => {
                        const proxied = s.url;
                        const active = selectedSubtitle === proxied;
                        return (
                          <button
                            key={s.url}
                            onClick={() => {
                              setSelectedSubtitle(proxied);
                              setShowSubSelector(false);
                              try {
                                localStorage.setItem('movie_night_preferred_subtitle_lang', s.language);
                              } catch (e) {}
                            }}
                            className={`w-full px-4 py-3 text-left transition-colors ${active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'}`}
                          >
                            <span className="text-sm">{s.language}</span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-4 py-3 text-white/40 text-sm italic">
                        No subtitles available for this title
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quality Selector Dropdown */}
              {showQualitySelector && (
                <div className={`pointer-events-none ${showControls && !showPauseInfo ? 'pointer-events-auto' : ''} absolute top-20 right-4 w-56 bg-black/95 backdrop-blur-2xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 z-[100]`}>
                  <div className="p-3 border-b border-white/5">
                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Quality / Source</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {streamUrls.length > 0 ? (
                      streamUrls.map((stream, idx) => {
                        const isActive = selectedQuality === stream.quality || selectedStreamUrl === stream.url;
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              // Check if this is an HLS level switch
                              if (stream.url.startsWith('hls-level-')) {
                                const levelIndex = parseInt(stream.url.replace('hls-level-', ''));
                                const hls = (window as any).hls;
                                if (hls) {
                                  hls.currentLevel = levelIndex; // Force specific quality
                                  setSelectedQuality(stream.quality);
                                }
                              } else if (stream.quality.includes('Auto')) {
                                // Auto mode - let HLS decide
                                const hls = (window as any).hls;
                                if (hls) {
                                  hls.currentLevel = -1; // -1 means auto
                                  setSelectedQuality(stream.quality);
                                }
                              } else {
                                // Regular stream URL switch
                                setSelectedStreamUrl(stream.url);
                                setSelectedQuality(stream.quality);
                              }
                              setShowQualitySelector(false);
                            }}
                            className={`w-full px-4 py-3 text-left transition-colors flex items-center justify-between ${isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'}`}
                          >
                            <span className="text-sm">{stream.quality}</span>
                            {isActive && <Check className="w-4 h-4 text-[#E50914]" />}
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-4 py-3 text-white/40 text-sm italic">
                        Using default quality
                      </div>
                    )}
                    {/* Embed fallback option */}
                    <button
                      onClick={() => {
                        setUseEmbed(true);
                        setShowQualitySelector(false);
                      }}
                      className={`w-full px-4 py-3 text-left transition-colors flex items-center justify-between border-t border-white/5 ${useEmbed ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'}`}
                    >
                      <span className="text-sm">Backup Server (Embed)</span>
                      {useEmbed && <Check className="w-4 h-4 text-[#E50914]" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Center Play Controls - Absolute Center of Screen */}
              <div className={`pointer-events-none ${showControls && !showPauseInfo ? 'pointer-events-auto' : ''} absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center space-x-12 z-50`}>
                <button
                  onClick={(e) => { e.stopPropagation(); skip(-10); handleMouseMove(); }}
                  className="active:scale-90 transition-all flex items-center justify-center relative w-12 h-12 text-white/90 hover:text-white"
                >
                  <RotateCcw className="w-10 h-10" />
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold mt-0.5 pointer-events-none">10</span>
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); togglePlay(); handleMouseMove(); }}
                  className="w-16 h-16 text-white active:scale-90 transition-all flex items-center justify-center"
                >
                  {isPlaying ? <Pause className="w-14 h-14 fill-white" /> : <Play className="w-14 h-14 fill-white ml-1" />}
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); skip(10); handleMouseMove(); }}
                  className="active:scale-90 transition-all flex items-center justify-center relative w-12 h-12 text-white/90 hover:text-white"
                >
                  <RotateCw className="w-10 h-10" />
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold mt-0.5 pointer-events-none">10</span>
                </button>
              </div>

              <div className={`pointer-events-none ${showControls && !showPauseInfo ? 'pointer-events-auto' : ''} absolute bottom-0 left-0 right-0 px-5 py-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent`} style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 24px)` }}>
                <div className="flex flex-col space-y-3">
                  {/* Seek Bar */}
                  <div className="relative h-[16px] cursor-pointer flex items-center group">
                    {/* Gray/White Background Line - Total Duration (Always Visible) */}
                    <div className="absolute w-full h-[4px] bg-white/30 rounded-full group-hover:h-[6px] transition-all" />

                    {/* Red Progress Line - Watched Portion */}
                    <div
                      className="absolute h-[4px] bg-[#E50914] z-10 rounded-full pointer-events-none transition-all duration-100 group-hover:h-[6px]"
                      style={{ width: `${displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0}%` }}
                    />

                    {/* Red Circle Thumb */}
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#E50914] rounded-full z-20 pointer-events-none shadow-lg ${isSeeking ? 'scale-150' : 'scale-100'} group-hover:scale-125 transition-all duration-150`}
                      style={{ left: `${displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0}%`, transform: 'translateX(-50%) translateY(-50%)' }}
                    />

                    <input
                      type="range"
                      min={0}
                      max={displayDuration || 0}
                      step={0.1}
                      value={currentTime}
                      onInput={(e) => { e.stopPropagation(); handleSeek(e as any); }}
                      onChange={(e) => { e.stopPropagation(); handleSeek(e); }}
                      onMouseDown={(e) => { e.stopPropagation(); handleSeekStart(); }}
                      onMouseUp={(e) => { e.stopPropagation(); handleSeekEnd(e); }}
                      onTouchStart={(e) => { e.stopPropagation(); handleSeekStart(); }}
                      onTouchEnd={(e) => { e.stopPropagation(); handleSeekEnd(e); }}
                      onClick={handleSeekBarClick}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
                    />
                  </div>

                  {/* Bottom Row: Timestamp + Fullscreen + Action Buttons */}
                  <div className="flex items-center justify-between">
                    {/* Left: Timestamp + Fullscreen */}
                    <div className="flex items-center space-x-3">
                      <span className="player-timestamp text-xs font-medium text-white/90 tabular-nums">
                        {formatTime(currentTime)} / {formatTime(displayDuration)}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFullscreen(); handleMouseMove(); }}
                        className="text-white/80 hover:text-white transition-all active:scale-95"
                      >
                        <Maximize className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Right: Next Episode + Episodes Button */}
                    <div className="flex items-center space-x-3">
                      {computedIsSeries && hasNextEpisode && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleNextEpisode(); }}
                          className="flex items-center space-x-1.5 text-white/80 hover:text-white transition-all active:scale-95 group"
                        >
                          <SkipForward className="w-4 h-4 group-hover:text-[#E50914] transition-colors" />
                          <span className="text-xs font-medium">Next Episode</span>
                        </button>
                      )}
                      {computedIsSeries && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowEpisodeSelector(!showEpisodeSelector); }}
                          className="flex items-center space-x-1.5 text-white/80 hover:text-white transition-all active:scale-95"
                        >
                          <Monitor className="w-4 h-4" />
                          <span className="text-xs font-medium">Episodes</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>



            {/* Episode Selector Modal */}
            {showEpisodeSelector && isSeries && (
              <div
                className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
                onClick={() => {
                  setShowEpisodeSelector(false);
                  setSelectedSeasonInPanel(null);
                  setEpisodesInSeason(0);
                  setEpisodeSearch('');
                }}
              >
                <div
                  className="w-full max-w-4xl h-[80vh] flex flex-col bg-[#141414] rounded-2xl overflow-hidden border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header: Title + Season Select Dropdown + Search + Close */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border-b border-white/15 gap-4 bg-[#181818]">
                    <div className="flex items-center space-x-4">
                      <h3 className="text-white font-black text-xl tracking-tight hidden sm:inline-block">
                        {movie.title || movie.name}
                      </h3>
                      {/* Season Dropdown */}
                      <div className="relative">
                        <select
                          value={selectedSeasonInPanel || season}
                          onChange={(e) => handleSeasonSelect(Number(e.target.value))}
                          className="bg-[#242424] text-white text-sm font-bold py-2.5 px-5 pr-10 rounded border border-white/20 focus:outline-none focus:border-[#E50914] cursor-pointer appearance-none transition-colors"
                        >
                          {availableSeasonsData.map((s) => (
                            <option key={s.season} value={s.season}>
                              Season {s.season}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-white/60">
                          <ChevronRight className="w-4 h-4 rotate-90" />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <input
                        type="text"
                        placeholder="Filter episodes..."
                        value={episodeSearch}
                        onChange={(e) => setEpisodeSearch(e.target.value)}
                        className="bg-black/60 border border-white/10 rounded-lg px-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#E50914] w-full sm:w-48 transition-colors"
                      />
                      <button
                        onClick={() => {
                          setShowEpisodeSelector(false);
                          setSelectedSeasonInPanel(null);
                          setEpisodesInSeason(0);
                          setEpisodeSearch('');
                        }}
                        className="p-2 text-white/60 hover:text-white transition-colors bg-white/5 rounded-full hover:bg-white/10 flex-shrink-0"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Episodes List Container */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-[#141414]">
                    {isLoadingEpisodes ? (
                      <div className="h-full flex flex-col items-center justify-center py-20">
                        <div className="relative w-12 h-12">
                          <div className="w-12 h-12 rounded-full border-2 border-white/5" />
                          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-t-[#e50914] animate-spin" />
                        </div>
                        <p className="text-white/40 text-[9px] uppercase tracking-widest mt-4 animate-pulse">Loading Episodes</p>
                      </div>
                    ) : episodesDetails && episodesDetails.length > 0 ? (
                      episodesDetails
                        .filter((ep) => {
                          const searchTerm = episodeSearch.toLowerCase();
                          return (
                            searchTerm === '' ||
                            ep.episode_number.toString().includes(searchTerm) ||
                            (ep.name && ep.name.toLowerCase().includes(searchTerm)) ||
                            (ep.overview && ep.overview.toLowerCase().includes(searchTerm))
                          );
                        })
                        .map((ep) => {
                          const isEpisodeActive = season === (selectedSeasonInPanel || season) && episode === ep.episode_number;
                          const thumbUrl = ep.still_path
                            ? `https://image.tmdb.org/t/p/w300${ep.still_path}`
                            : movie.backdrop_path
                            ? `https://image.tmdb.org/t/p/w300${movie.backdrop_path}`
                            : null;

                          return (
                            <div
                              key={ep.episode_number}
                              onClick={() => handleEpisodeSelect(ep.episode_number)}
                              className={`flex flex-col md:flex-row items-start gap-4 p-4 rounded-xl cursor-pointer transition-all border ${isEpisodeActive ? 'bg-white/[0.06] border-white/20' : 'bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/5'}`}
                            >
                              {/* Left Column: Number & Thumbnail */}
                              <div className="flex items-center gap-4 w-full md:w-auto flex-shrink-0">
                                <span className={`text-2xl font-black ${isEpisodeActive ? 'text-[#E50914]' : 'text-white/30'} w-8 text-center`}>
                                  {ep.episode_number}
                                </span>
                                <div className="relative aspect-video w-40 sm:w-48 bg-zinc-900 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 group">
                                  {thumbUrl ? (
                                    <img
                                      src={thumbUrl}
                                      alt={ep.name}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950 p-2 text-center">
                                      <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">S{(selectedSeasonInPanel || season)}:E{ep.episode_number}</span>
                                    </div>
                                  )}
                                  {/* Hover Play Button Overlay */}
                                  <div className={`absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 z-10`}>
                                    <div className="w-10 h-10 bg-[#E50914] rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
                                      <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                                    </div>
                                  </div>
                                  {/* Current Episode Active Indicator */}
                                  {isEpisodeActive && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 border border-[#E50914] rounded-lg">
                                      <span className="text-[9px] font-black uppercase tracking-widest text-[#E50914] bg-black/60 px-2 py-1 rounded">Playing</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Right Column: Title, Metadata, Overview */}
                              <div className="flex-1 min-w-0 space-y-1 py-1">
                                <div className="flex items-baseline justify-between gap-4">
                                  <h4 className={`text-base font-bold truncate ${isEpisodeActive ? 'text-[#E50914]' : 'text-white'}`}>
                                    {ep.name || `Episode ${ep.episode_number}`}
                                  </h4>
                                  {ep.runtime && (
                                    <span className="text-xs text-white/40 flex-shrink-0 font-medium">
                                      {ep.runtime}m
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-white/50 leading-relaxed line-clamp-3">
                                  {ep.overview || "No overview available for this episode."}
                                </p>
                              </div>
                            </div>
                          );
                        })
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center py-20 text-white/40">
                        <AlertCircle className="w-8 h-8 mb-3 opacity-60" />
                        <span className="text-sm">No episodes found for this season</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Custom Subtitle Overlay */}
            {activeCue && (
              <div
                className="absolute left-1/2 -translate-x-1/2 z-[35] pointer-events-none text-center px-4 w-full sm:w-auto"
                style={{ bottom: `${isLandscape ? subSettings.bottom : 20}px` }}
              >
                <div
                  className={`inline-block px-3 py-1 rounded-lg font-bold subtitle-rendering ${subSettings.bgOpacity > 0 ? 'shadow-2xl backdrop-blur-md border border-white/10' : ''}`}
                  style={{
                    fontSize: `${isLandscape ? subSettings.fontSize : 14}px`,
                    backgroundColor: `rgba(0, 0, 0, ${subSettings.bgOpacity})`,
                    color: '#fff',
                    textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.2'
                  }}
                  dangerouslySetInnerHTML={{ __html: activeCue.replace(/\n/g, '<br/>') }}
                />
              </div>
            )}

            <style>{`
              .subtitle-rendering * {
                font-size: inherit !important;
                color: inherit !important;
                background: transparent !important;
                line-height: inherit !important;
              }
            `}</style>

            {/* Subtitle Settings Panel */}
            {showSubSettings && isLandscape && (
              <div
                className="absolute top-1/2 right-6 -translate-y-1/2 z-[60] bg-black/80 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/10 w-[240px] animate-in slide-in-from-right-4 duration-300"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-white font-black text-[10px] uppercase tracking-[0.2em] opacity-40">Sub Settings</h4>
                  <button onClick={() => setShowSubSettings(false)} className="text-white/40 hover:text-white"><Check className="w-4 h-4" /></button>
                </div>

                <div className="space-y-8">
                  <div>
                    <div className="flex justify-between mb-3">
                      <span className="text-white text-[9px] font-black uppercase tracking-widest opacity-60">Font Size</span>
                      <span className="text-white text-[9px] font-black">{subSettings.fontSize}px</span>
                    </div>
                    <input
                      type="range" min="10" max="72" step="1"
                      value={subSettings.fontSize}
                      onChange={(e) => setSubSettings({ ...subSettings, fontSize: parseInt(e.target.value) })}
                      className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#e50914]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-3">
                      <span className="text-white text-[9px] font-black uppercase tracking-widest opacity-60">Vertical Position</span>
                      <span className="text-white text-[9px] font-black">{subSettings.bottom}px</span>
                    </div>
                    <input
                      type="range" min="10" max="250" step="1"
                      value={subSettings.bottom}
                      onChange={(e) => setSubSettings({ ...subSettings, bottom: parseInt(e.target.value) })}
                      className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#e50914]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-3">
                      <span className="text-white text-[9px] font-black uppercase tracking-widest opacity-60">Bg Opacity</span>
                      <span className="text-white text-[9px] font-black">{Math.round(subSettings.bgOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range" min="0" max="1" step="0.1"
                      value={subSettings.bgOpacity}
                      onChange={(e) => setSubSettings({ ...subSettings, bgOpacity: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#e50914]"
                    />
                  </div>
                </div>
              </div>
            )}

            {errorType && (
              <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-center z-[70] animate-in fade-in duration-500">

                <div className="w-16 h-16 bg-[#e50914]/10 rounded-full flex items-center justify-center mb-6 border border-[#e50914]/20">
                  <AlertCircle className="w-8 h-8 text-[#e50914]" />
                </div>
                <h3 className="text-white font-black text-xl mb-2 uppercase tracking-tight">Source Busy</h3>
                <p className="text-white/40 text-[10px] uppercase tracking-widest mb-8 max-w-[280px]">

                </p>
                <div className="flex flex-col gap-3 w-full max-w-[220px]">

                  <button onClick={() => { triggerHaptic('MEDIUM'); setUseEmbed(true); setErrorType(null); setRetryCount(0); }} className="w-full py-4 bg-white/5 border border-white/10 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all">Use Backup Server (Contains Ads)</button>
                  <div className="flex gap-2">
                    <button onClick={() => { setRetryCount(0); setErrorType(null); setLoading(true); if (videoRef.current) { videoRef.current.load(); videoRef.current.play().catch(() => { }); } }} className="flex-1 py-3 text-white/40 font-bold text-[8px] uppercase active:scale-95 transition-all border border-white/5 rounded-xl">Retry</button>
                    <button onClick={() => onBack()} className="flex-1 py-3 text-white/40 font-bold text-[8px] uppercase active:scale-95 transition-all border border-white/5 rounded-xl">Go Home</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )
        }
      </div >
    );
  };

  const handleQualityChange = (q: string) => {
    setSelectedQuality(q);
    setLoading(true);
  };

  const fetchDownloadLinks = async () => {
    if (downloadLinks.length > 0) {
      setShowDownloadSelector(true);
      return;
    }

    setIsFetchingDownloads(true);
    const yearParam = year ? `&year=${year}` : '';
    try {
      const url = `${backendUrl}/api/downloads?title=${encodeURIComponent(titleToSearch)}&is_tv=${computedIsSeries}&season=${season}&episode=${episode}${yearParam}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDownloadLinks(data);
        setShowDownloadSelector(true);
      }
    } catch (err) {
      console.error("Download fetch error:", err);
    } finally {
      setIsFetchingDownloads(false);
    }
  };

  const handleDownload = (linkUrl: string, quality: string) => {
    const proxyUrl = `${backendUrl}/api/download/proxy?url=${encodeURIComponent(linkUrl)}&title=${encodeURIComponent(titleToSearch)}`;

    // Add to local history
    addDownload({
      id: `${movie.id}-${quality}-${Date.now()}`,
      title: titleToSearch,
      quality,
      url: proxyUrl,
      timestamp: Date.now(),
      status: 'processing',
      posterPath: movie.poster_path,
      season: computedIsSeries ? season : undefined,
      episode: computedIsSeries ? episode : undefined
    });

    // Trigger download
    const anchor = document.createElement('a');
    anchor.href = proxyUrl;
    anchor.download = `${titleToSearch}_${quality}.mp4`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    setShowDownloadSelector(false);
    triggerHaptic('MEDIUM');
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onTouchStart={resetControlsTimer}
      onTouchMove={resetControlsTimer}
      ref={containerRef}
      className={`fixed inset-0 h-[100dvh] w-screen z-50 bg-[#070707] overflow-hidden flex flex-col select-none ${isLandscape ? 'md:flex-row' : 'flex-col'}`}
    >

      <div className={`relative transition-all duration-500 overflow-hidden ${isLandscape ? 'w-full h-full' : 'w-full aspect-video flex-shrink-0 bg-black'}`}>
        {renderVideoPlayer()}
      </div>

      {!isLandscape && (
        <div className="flex-1 overflow-y-auto no-scrollbar bg-[#070707] px-6 py-8 pb-32">
          <div className="flex items-start justify-between mb-2">
            <h1 className="text-[clamp(1.25rem,5vw,2.5rem)] font-black text-white pr-4 leading-tight uppercase tracking-tight">{movie.title || movie.name}</h1>
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

          <div className="grid grid-cols-4 gap-4 mb-12">
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
            <button onClick={fetchDownloadLinks} disabled={isFetchingDownloads} className="flex flex-col items-center space-y-2 active:scale-90 transition-all disabled:opacity-50">
              <div className={`w-14 h-14 bg-white/[0.03] rounded-2xl flex items-center justify-center border border-white/5 ${isFetchingDownloads ? 'animate-pulse' : ''}`}>
                <Download className={`w-5 h-5 ${isFetchingDownloads ? 'text-[#e50914]' : 'text-gray-400'}`} />
              </div>
              <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">{isFetchingDownloads ? 'Loading...' : 'Download'}</span>
            </button>
            <button onClick={() => { triggerHaptic('LIGHT'); setShowSpecs(!showSpecs); }} className="flex flex-col items-center space-y-2 active:scale-90 transition-all">
              <div className={`w-14 h-14 bg-white/[0.03] rounded-2xl flex items-center justify-center border ${showSpecs ? 'border-[#e50914]/40 bg-[#e50914]/5' : 'border-white/5'}`}>
                <Settings2 className={`w-5 h-5 ${showSpecs ? 'text-[#e50914]' : 'text-gray-400'}`} />
              </div>
              <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Specs</span>
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
            <p className="text-gray-400 text-[clamp(0.85rem,2.5vw,1rem)] leading-relaxed font-medium">{movie.overview || "No overview available."}</p>
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
                  <div
                    key={similar.id}
                    className="group relative aspect-video bg-white/5 rounded-xl overflow-hidden active:scale-95 transition-all cursor-pointer"
                    onClick={() => {
                      triggerHaptic('MEDIUM');
                      if (onMovieChange) onMovieChange(similar);
                      else window.location.search = `? movie = ${similar.id} `;
                    }}
                  >
                    <img src={`https://image.tmdb.org/t/p/w200${similar.backdrop_path || similar.poster_path}`} className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/30 to-transparent">
                      <p className="text-white text-[8px] font-black uppercase truncate tracking-widest">{similar.title || similar.name}</p>
                    </div>
                  </div >
                ))}
              </div >
            </div >
          )}
        </div >
      )}

      {
        showWatchTogether && (
          <div className={`transition-all duration-500 ${isLandscape ? 'hidden' : 'fixed bottom-0 left-0 w-full z-40 pb-[env(safe-area-inset-bottom)]'}`}>
            <WatchTogether movie={movie} videoRef={videoRef} isPlaying={isPlaying} currentTime={currentTime} onSyncPlay={(p) => videoRef.current && (p ? videoRef.current.play() : videoRef.current.pause())} onSyncSeek={(t) => videoRef.current && (videoRef.current.currentTime = t)} onClose={() => setShowWatchTogether(false)} onChatToggle={() => { }} />
          </div>
        )
      }

      {/* Download Selector Popup - Global Overlay */}
      {showDownloadSelector && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-[#070707] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-white font-black text-xs uppercase tracking-widest">Select Download Quality</h3>
              <button onClick={() => setShowDownloadSelector(false)} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              {downloadLinks.length > 0 ? (
                downloadLinks.map((link, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleDownload(link.url, link.quality)}
                    className="w-full group py-4 px-6 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/20 rounded-2xl flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-[#e50914]" />
                      <span className="text-white font-black text-[10px] uppercase tracking-[0.2em]">{link.quality}</span>
                    </div>
                    <Download className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
                  </button>
                ))
              ) : (
                <p className="text-white/40 text-[9px] uppercase tracking-widest text-center py-6">No download links available for this mirror</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default Player;