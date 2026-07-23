import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Row from './components/Row';
import Modal from './components/Modal';
import Player from './components/Player';
import AuthModal from './components/Auth/AuthModal';
import FooterNav from './components/FooterNav';
import SplashScreen from './components/SplashScreen';
import { Movie } from './types';
import { requests } from './services/api';
import { rtdb, auth } from './services/firebase';
import { ref, get } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { BACKEND_URL as DEFAULT_BACKEND_URL } from './constants';
import { getBackendUrl, getBackendMode, setBackendMode, setCustomBackendUrl, getCustomBackendUrl, BackendMode } from './services/backend';
import { Users, Play, X, Search as SearchIcon, User as UserIcon, Clock, ChevronRight, Bookmark, Settings, LogOut, Trash2, Star, ChevronDown, Download, Activity, Globe, Wifi, Database, Info } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';
import { getHistory, HistoryItem, clearHistory } from './services/history';
import { getDownloads, removeDownload, DownloadItem } from './services/downloadTracker';

const App: React.FC = () => {
  const [featuredMovie, setFeaturedMovie] = useState<Movie | null>(null);
  const [trending, setTrending] = useState<Movie[]>([]);
  const [topRated, setTopRated] = useState<Movie[]>([]);
  const [action, setAction] = useState<Movie[]>([]);
  const [comedy, setComedy] = useState<Movie[]>([]);
  const [horror, setHorror] = useState<Movie[]>([]);
  const [romance, setRomance] = useState<Movie[]>([]);
  const [sciFi, setSciFi] = useState<Movie[]>([]);
  const [animation, setAnimation] = useState<Movie[]>([]);
  const [mystery, setMystery] = useState<Movie[]>([]);
  const [documentaries, setDocumentaries] = useState<Movie[]>([]);
  const [tvShows, setTVShows] = useState<Movie[]>([]);
  const [family, setFamily] = useState<Movie[]>([]);

  const [searchResults, setSearchResults] = useState<Movie[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // UI State
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [playingMovie, setPlayingMovie] = useState<Movie | null>(null);
  const [startSeason, setStartSeason] = useState(1);
  const [startEpisode, setStartEpisode] = useState(1);
  const [activeCategory, setActiveCategory] = useState('Home');
  const [myList, setMyList] = useState<Movie[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [lobbyMovie, setLobbyMovie] = useState<Movie | null>(null);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [videoFinished, setVideoFinished] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [backendMode, setBackendModeState] = useState<BackendMode>(getBackendMode());
  const [customBackendUrl, setCustomBackendUrlState] = useState<string>(getCustomBackendUrl());
  const [currentBackendUrl, setCurrentBackendUrl] = useState<string>(getBackendUrl());

  // Splash Screen Synchronization
  useEffect(() => {
    if (videoFinished && dataLoaded) {
      setShowSplash(false);
    }
  }, [videoFinished, dataLoaded]);

  // Check Backend Connectivity
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${currentBackendUrl}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        setBackendStatus(res.ok ? 'online' : 'offline');
      } catch (e) {
        setBackendStatus('offline');
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 10000);
    return () => clearInterval(interval);
  }, [currentBackendUrl]);

  const handleUpdateBackend = (mode: BackendMode, customUrl?: string) => {
    setBackendMode(mode);
    setBackendModeState(mode);
    if (customUrl !== undefined) {
      setCustomBackendUrl(customUrl);
      setCustomBackendUrlState(customUrl);
    }
    const newUrl = getBackendUrl();
    setCurrentBackendUrl(newUrl);
  };
  useEffect(() => {
    const backListener = CapApp.addListener('backButton', () => {
      if (playingMovie) {
        setPlayingMovie(null);
      } else if (selectedMovie) {
        setSelectedMovie(null);
      } else if (isSearchOpen) {
        setIsSearchOpen(false);
        setSearchResults(null);
      } else if (activeCategory !== 'Home') {
        setActiveCategory('Home');
      } else {
        CapApp.exitApp();
      }
    });

    return () => {
      backListener.then(l => l.remove());
    };
  }, [playingMovie, selectedMovie, isSearchOpen, activeCategory]);

  // Auth Listener
  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
  }, []);

  // Clear search results when category changes
  useEffect(() => {
    if (activeCategory !== 'Search') {
      setSearchResults(null);
      setSearchQuery('');
    }
  }, [activeCategory]);

  // Load Lists from localStorage
  useEffect(() => {
    const savedList = localStorage.getItem('jmafk_mylist');
    if (savedList) setMyList(JSON.parse(savedList));
    setHistory(getHistory());
  }, [playingMovie]); // Reload history when closing player

  // Save My List to localStorage
  useEffect(() => {
    localStorage.setItem('jmafk_mylist', JSON.stringify(myList));
  }, [myList]);

  // Load downloads when switching to Downloads category
  useEffect(() => {
    if (activeCategory === 'Downloads') {
      setDownloads(getDownloads());
    }
  }, [activeCategory]);

  const handleDeleteDownload = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeDownload(id);
    setDownloads(getDownloads());
  };

  // Check for Room in URL and show lobby
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rid = params.get('room');
    if (rid) {
      const checkRoom = async () => {
        try {
          const snapshot = await get(ref(rtdb, `rooms/${rid}`));
          if (snapshot.exists()) {
            const roomData = snapshot.val();
            const type = roomData.isTV ? 'tv' : 'movie';
            let movieDetails = await requests.fetchDetails(roomData.movieId, type);
            if (!movieDetails) {
              movieDetails = await requests.fetchDetails(roomData.movieId, type === 'tv' ? 'movie' : 'tv');
            }
            if (movieDetails) {
              setLobbyMovie(movieDetails);
              setJoiningRoomId(rid);
            }
          }
        } catch (err) {
          console.error("Firebase Room Error:", err);
        }
      };
      checkRoom();
    }
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [
          trendingData,
          topRatedData,
          actionData,
          comedyData,
          horrorData,
          romanceData,
          sciFiData,
          animationData,
          mysteryData,
          docsData,
          tvData,
          familyData
        ] = await Promise.all([
          requests.fetchTrending(),
          requests.fetchTopRated(),
          requests.fetchActionMovies(),
          requests.fetchComedyMovies(),
          requests.fetchHorrorMovies(),
          requests.fetchRomanceMovies(),
          requests.fetchSciFi(),
          requests.fetchAnimation(),
          requests.fetchMystery(),
          requests.fetchDocumentaries(),
          requests.fetchTVShows(),
          requests.fetchFamilyMovies(),
        ]);

        setTrending(trendingData || []);
        setTopRated(topRatedData || []);
        if (trendingData?.length) {
          setFeaturedMovie(trendingData[Math.floor(Math.random() * trendingData.length)]);
        }
        setAction(actionData || []);
        setComedy(comedyData || []);
        setHorror(horrorData || []);
        setRomance(romanceData || []);
        setSciFi(sciFiData || []);
        setAnimation(animationData || []);
        setMystery(mysteryData || []);
        setDocumentaries(docsData || []);
        setTVShows(tvData || []);
        setFamily(familyData || []);
      } catch (err) {
        console.error("Critical Data Fetch Error:", err);
      } finally {
        setDataLoaded(true);
      }
    };

    fetchAllData();
  }, []);

  const handleMovieClick = (movie: Movie) => {
    handlePlay(movie);
  };

  const handlePlay = (movie: Movie, seasonIdx = 1, epIdx = 1) => {
    setStartSeason(seasonIdx);
    setStartEpisode(epIdx);
    setPlayingMovie(movie);
    setSelectedMovie(null);
  };

  const toggleMyList = (movie: Movie) => {
    if (myList.find(m => m.id === movie.id)) {
      setMyList(myList.filter(m => m.id !== movie.id));
    } else {
      setMyList([...myList, movie]);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const results = await requests.search(query);
      setSearchResults(results);
    } else {
      setSearchResults(null);
    }
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setVideoFinished(true)} />;
  }

  if (playingMovie) {
    return (
      <Player
        movie={playingMovie}
        onBack={() => setPlayingMovie(null)}
        initialSeason={startSeason}
        initialEpisode={startEpisode}
        isAddedToList={!!myList.find(m => m.id === playingMovie.id)}
        onToggleList={() => toggleMyList(playingMovie)}
        onMovieChange={(m) => setPlayingMovie(m)}
        backendUrl={currentBackendUrl.replace(/\/+$/, '')}
      />
    );
  }

  if (lobbyMovie) {
    return (
      <div className="fixed inset-0 z-50 bg-[#070707] flex flex-col items-center justify-center p-8 text-center">
        <div className="relative w-64 aspect-[2/3] rounded-sm overflow-hidden shadow-2xl mb-8 border border-white/10">
          <img src={`https://image.tmdb.org/t/p/w500${lobbyMovie.poster_path}`} className="w-full h-full object-cover" alt="" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070707] to-transparent" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2 uppercase tracking-tight">{lobbyMovie.title || lobbyMovie.name}</h2>
        <p className="text-gray-500 mb-10 max-w-md font-medium">You've been invited to watch this with friends.</p>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button
            onClick={() => {
              setPlayingMovie(lobbyMovie);
              setLobbyMovie(null);
            }}
            className="w-full py-4 bg-[#e50914] text-white font-bold rounded-sm shadow-lg shadow-red-600/20 active:scale-95 transition-all uppercase tracking-widest text-sm"
          >
            Join Room
          </button>
          <button
            onClick={() => setLobbyMovie(null)}
            className="w-full py-4 bg-white/5 text-white/60 font-bold rounded-sm active:scale-95 transition-all uppercase tracking-widest text-xs"
          >
            Decline
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#141414] min-h-screen w-full text-white font-sans selection:bg-[#e50914] selection:text-white pb-32 overflow-x-hidden">
      <Navbar
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        onSearchClick={() => { setIsSearchOpen(!isSearchOpen); if (isSearchOpen) { setSearchResults(null); setSearchQuery(''); } }}
        isSearchOpen={isSearchOpen}
      />

      <main>
        {isSearchOpen && (
          <div className="pt-28 px-6 md:px-12 animate-in fade-in duration-500 min-h-screen">
            <div className="relative mb-12">
              <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search movies, shows, actors..."
                className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-5 pl-16 pr-8 text-white text-lg placeholder:text-gray-600 focus:outline-none focus:border-[#e50914]/50 focus:bg-white/10 transition-all font-medium"
              />
              {searchQuery && (
                <button onClick={() => handleSearch('')} className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {searchResults ? (
              <>
                <h2 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.4em] mb-8">Matches Found ({searchResults.length})</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-10 px-2 pb-32">
                  {searchResults.map((movie) => (
                    <div key={movie.id} onClick={() => handleMovieClick(movie)} className="cursor-pointer group relative transition-all duration-500 hover:scale-110 hover:z-50 hover:shadow-2xl">
                      <div className="relative aspect-[2/3] rounded-sm overflow-hidden shadow-lg border-2 border-transparent group-hover:border-[#e50914] transition-all">
                        <img
                          src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                          className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500"
                          alt={movie.title || movie.name}
                        />
                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/40 to-transparent">
                          <p className="text-[9px] font-bold text-white uppercase truncate tracking-widest">{movie.title || movie.name}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="pb-32">
                <div className="flex items-center space-x-3 mb-8">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#e50914] animate-pulse" />
                  <h2 className="text-[10px] font-bold text-white uppercase tracking-[0.4em]">Trending Now</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-10 px-2">
                  {trending.slice(0, 12).map((movie) => (
                    <div key={movie.id} onClick={() => handleMovieClick(movie)} className="cursor-pointer group relative transition-all duration-500 hover:scale-110 hover:z-50 hover:shadow-2xl">
                      <div className="relative aspect-[2/3] rounded-sm overflow-hidden shadow-lg border-2 border-transparent group-hover:border-[#e50914] transition-all">
                        <img
                          src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                          className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500"
                          alt=""
                        />
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[8px] font-bold text-yellow-500">★ {movie.vote_average?.toFixed(1)}</span>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/40 to-transparent">
                          <p className="text-[9px] font-bold text-white uppercase truncate tracking-widest">{movie.title || movie.name}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {searchQuery && searchResults?.length === 0 && (
                  <div className="flex flex-col items-center justify-center pt-20 text-center opacity-20">
                    <SearchIcon className="w-20 h-20 mb-6" />
                    <p className="text-sm font-bold uppercase tracking-[0.3em]">No results found for "{searchQuery}"</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!isSearchOpen && (
          <div className="relative">
            {activeCategory === 'Home' && featuredMovie && (
              <Hero movie={featuredMovie} onPlay={() => handlePlay(featuredMovie)} onMoreInfo={handleMovieClick} />
            )}

            <div className="-mt-16 sm:-mt-24 md:-mt-32 relative z-10 space-y-12">
              {activeCategory === 'Home' && (
                <>
                  {history.length > 0 && (
                    <div className="px-6 md:px-12">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center">
                          <Clock className="w-3 h-3 mr-2 text-[#e50914]" />
                          Continue Watching
                        </h2>
                        <button
                          onClick={() => {
                            clearHistory();
                            setHistory([]);
                          }}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 active:scale-95 transition-all text-[9px] font-bold uppercase tracking-wider"
                        >
                          <Trash2 className="w-3 h-3 text-[#e50914]" />
                          <span>Clear Cache</span>
                        </button>
                      </div>
                      <div className="flex space-x-2 overflow-x-scroll no-scrollbar py-4 px-2">
                        {history.map((item) => (
                          <div
                            key={`${item.id}-${item.season}-${item.episode}`}
                            onClick={() => requests.fetchDetails(item.id, item.isTV ? 'tv' : 'movie').then(m => m && handlePlay(m, item.season, item.episode))}
                            className="relative min-w-[130px] sm:min-w-[150px] md:min-w-[170px] lg:min-w-[190px] aspect-[2/3] cursor-pointer transition-all duration-300 ease-out hover:z-50 hover:scale-105 group/item mx-1"
                          >
                            <img src={`https://image.tmdb.org/t/p/w342${item.poster_path}`} alt={item.title} className="rounded-lg object-cover shadow-lg w-full h-full border border-white/[0.06]" loading="lazy" />
                            
                            {/* Hover Overlay */}
                            <div className="absolute inset-0 rounded-lg overflow-hidden opacity-0 group-hover/item:opacity-100 transition-all duration-300 pointer-events-none">
                              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-10 h-10 bg-[#e50914] rounded-full flex items-center justify-center shadow-lg">
                                  <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                                </div>
                              </div>
                            </div>
                            
                            {/* Progress Bar always visible at bottom */}
                            <div className="absolute bottom-0 left-0 w-full h-1.5 bg-white/20 rounded-b-lg overflow-hidden">
                              <div className="h-full bg-[#e50914]" style={{ width: `${(item.timestamp / (item.duration || 1)) * 100}%` }} />
                            </div>

                            {/* Title below card */}
                            <div className="mt-2 text-center absolute -bottom-10 w-full">
                              <p className="text-white font-bold text-xs truncate drop-shadow-lg px-1">{item.title}</p>
                              {item.isTV && <p className="text-[10px] text-white/60 uppercase mt-0.5 font-bold">S{item.season} E{item.episode}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <Row title="Trending Now" movies={trending} onMovieClick={handleMovieClick} />
                  <Row title="Top Rated" movies={topRated} onMovieClick={handleMovieClick} />
                  <Row title="TV Shows" movies={tvShows} onMovieClick={handleMovieClick} isLargeRow />
                  <Row title="Action Thrillers" movies={action} onMovieClick={handleMovieClick} />
                  <Row title="Science Fiction" movies={sciFi} onMovieClick={handleMovieClick} />
                  <Row title="Comedies" movies={comedy} onMovieClick={handleMovieClick} />
                  <Row title="Animation" movies={animation} onMovieClick={handleMovieClick} />
                  <Row title="Scary Movies" movies={horror} onMovieClick={handleMovieClick} />
                </>
              )}

              {activeCategory === 'Profile' && (
                <div className="pt-28 px-6 md:px-12 min-h-screen pb-40">
                  {/* Profile Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 bg-white/5 p-8 rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
                    <div className="flex items-center space-x-6">
                      <div className="relative">
                        <div className="w-20 h-20 bg-gradient-to-br from-[#e50914] to-red-900 rounded-sm flex items-center justify-center shadow-2xl shadow-red-600/30">
                          <UserIcon className="w-10 h-10 text-white" />
                        </div>
                        {user && <div className="absolute -top-2 -right-2 bg-yellow-500 w-6 h-6 rounded-lg flex items-center justify-center border-4 border-[#070707]"><Star className="w-3 h-3 text-white fill-current" /></div>}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white uppercase tracking-tight">{user ? (user.displayName || 'Watcher') : 'Guest Account'}</h2>
                        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">{user ? user.email : 'Sign in to unlock sync'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {user ? (
                        <>
                          <button onClick={() => setActiveCategory('Settings')} className="p-4 bg-white/5 rounded-sm border border-white/5 hover:bg-white/10 transition-all"><Settings className="w-5 h-5 text-gray-400" /></button>
                          <button onClick={() => auth.signOut()} className="flex items-center space-x-2 px-6 py-4 bg-white/5 hover:bg-[#e50914] group rounded-sm border border-white/5 transition-all text-[10px] font-bold uppercase tracking-widest">
                            <LogOut className="w-4 h-4 text-gray-400 group-hover:text-white" />
                            <span>Sign Out</span>
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setShowAuthModal(true)} className="px-8 py-4 bg-[#e50914] text-white font-bold rounded-sm shadow-lg shadow-red-600/20 active:scale-95 transition-all uppercase tracking-widest text-[10px]">Sign In</button>
                      )}
                    </div>
                  </div>

                  {/* Backend Settings */}
                  <div className="mb-12 bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-md">
                    <h3 className="text-base font-semibold text-white mb-8 flex items-center">
                      <Database className="w-3.5 h-3.5 mr-3" />
                      Server Configuration
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <button
                        onClick={() => handleUpdateBackend('local')}
                        className={`flex flex-col items-start p-6 rounded-sm border-2 transition-all ${backendMode === 'local' ? 'bg-[#e50914]/10 border-[#e50914] shadow-[0_0_30px_rgba(229,9,20,0.1)]' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                      >
                        <Wifi className={`w-6 h-6 mb-4 ${backendMode === 'local' ? 'text-[#e50914]' : 'text-gray-500'}`} />
                        <span className="text-white font-bold text-[10px] uppercase tracking-widest mb-1">Local Host</span>
                        <span className="text-gray-500 text-[9px] font-bold uppercase">127.0.0.1:8000</span>
                      </button>

                      <button
                        onClick={() => handleUpdateBackend('lan')}
                        className={`flex flex-col items-start p-6 rounded-sm border-2 transition-all ${backendMode === 'lan' ? 'bg-blue-500/10 border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.1)]' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                      >
                        <Settings className={`w-6 h-6 mb-4 ${backendMode === 'lan' ? 'text-blue-500' : 'text-gray-500'}`} />
                        <span className="text-white font-bold text-[10px] uppercase tracking-widest mb-1">Static LAN</span>
                        <span className="text-gray-500 text-[9px] font-bold uppercase">192.168.254.117:8000</span>
                      </button>

                      <button
                        onClick={() => handleUpdateBackend('cloud')}
                        className={`flex flex-col items-start p-6 rounded-sm border-2 transition-all ${backendMode === 'cloud' ? 'bg-purple-500/10 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.1)]' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                      >
                        <Globe className={`w-6 h-6 mb-4 ${backendMode === 'cloud' ? 'text-purple-500' : 'text-gray-500'}`} />
                        <span className="text-white font-bold text-[10px] uppercase tracking-widest mb-1">Cloud / Tunnel</span>
                        <span className="text-gray-500 text-[9px] font-bold uppercase">External URL</span>
                      </button>
                    </div>

                    {backendMode === 'cloud' && (
                      <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <label className="text-[9px] font-bold text-white/20 uppercase tracking-[0.3em] ml-2">Custom Server URL</label>
                        <div className="relative group">
                          <input
                            type="text"
                            value={customBackendUrl}
                            onChange={(e) => handleUpdateBackend('cloud', e.target.value)}
                            placeholder="https://your-tunnel.trycloudflare.com"
                            className="w-full bg-white/5 border border-white/10 rounded-sm px-6 py-4 text-white text-sm focus:outline-none focus:border-purple-500 focus:bg-white/10 transition-all font-medium"
                          />
                          <Activity className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500/50" />
                        </div>
                        <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest ml-2 flex items-center gap-2">
                           <Info className="w-3 h-3" />
                           Changes are saved automatically and applied instantly
                        </p>
                      </div>
                    )}
                  </div>

                  {/* History Section */}
                  <section className="mt-16">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-base font-semibold text-white mb-6 flex items-center">
                        <Clock className="w-4 h-4 mr-3 text-[#e50914]" />
                        Watch History
                      </h3>
                      {history.length > 0 && (
                        <button onClick={() => { clearHistory(); setHistory([]); }} className="text-[9px] font-bold text-gray-600 uppercase hover:text-red-500 transition-colors flex items-center">
                          <Trash2 className="w-3 h-3 mr-1.5" />
                          Clear All
                        </button>
                      )}
                    </div>
                    {history.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {history.map((item) => (
                          <div key={`${item.id}-${item.season}-${item.episode}`} className="group cursor-pointer" onClick={() => requests.fetchDetails(item.id, item.isTV ? 'tv' : 'movie').then(m => m && handlePlay(m, item.season, item.episode))}>
                            <div className="relative aspect-video rounded-sm overflow-hidden border border-white/5 bg-white/5 mb-3">
                              <img src={`https://image.tmdb.org/t/p/w300${item.poster_path}`} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-500" />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                <Play className="w-8 h-8 fill-white text-white" />
                              </div>
                              <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10">
                                <div className="h-full bg-[#e50914]" style={{ width: `${(item.timestamp / (item.duration || 1)) * 100}%` }} />
                              </div>
                            </div>
                            <h4 className="text-[10px] font-bold text-white uppercase truncate tracking-widest">{item.title}</h4>
                            <p className="text-[8px] font-bold text-gray-600 uppercase mt-1">{item.isTV ? `Season ${item.season} • Episode ${item.episode}` : 'Movie'}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white/[0.02] border border-dashed border-white/5 rounded-sm p-12 text-center">
                        <p className="text-gray-600 text-[10px] uppercase font-bold tracking-widest">No movies watched yet</p>
                      </div>
                    )}
                  </section>

                  {/* My List Section */}
                  <section className="mt-16">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-base font-semibold text-white mb-6 flex items-center">
                        <Bookmark className="w-4 h-4 mr-3 text-[#e50914]" />
                        My Library
                      </h3>
                      <span className="text-[9px] font-bold text-gray-600 uppercase">{myList.length} Items</span>
                    </div>
                    {myList.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-10 px-2 pb-32">
                        {myList.map((movie) => (
                          <div key={movie.id} onClick={() => handleMovieClick(movie)} className="cursor-pointer group relative transition-all duration-500 hover:scale-110 hover:z-50 hover:shadow-2xl">
                            <div className="relative aspect-[2/3] rounded-sm overflow-hidden shadow-lg border-2 border-transparent group-hover:border-[#e50914] transition-all">
                              <img src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`} className="w-full h-full object-cover" />
                              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/40 to-transparent">
                                <p className="text-[9px] font-bold text-white uppercase truncate tracking-wider">{movie.title || movie.name}</p>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleMyList(movie); }}
                                className="absolute top-2 right-2 p-2 bg-black/60 backdrop-blur-md rounded-sm border border-white/10 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 group/btn"
                              >
                                <X className="w-3 h-3 text-white" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white/[0.02] border border-dashed border-white/5 rounded-sm p-12 text-center">
                        <p className="text-gray-600 text-[10px] uppercase font-bold tracking-widest">Your list is empty</p>
                      </div>
                    )
                    }
                  </section>
                </div>
              )}

              {activeCategory === 'Cartoons' && (
                <div className="pt-28 animate-in fade-in duration-500 min-h-screen">
                  {/* Category Hero Banner */}
                  <div className="relative h-48 md:h-64 mb-8 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-900/60 via-pink-900/40 to-[#141414]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
                    {animation[0]?.backdrop_path && <img src={`https://image.tmdb.org/t/p/w1280${animation[0].backdrop_path}`} className="w-full h-full object-cover opacity-30" alt="" />}
                    <div className="absolute bottom-8 left-6 md:left-12 z-10">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-8 h-8 bg-[#e50914] rounded-lg flex items-center justify-center">
                          <Star className="w-4 h-4 text-white fill-white" />
                        </div>
                        <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight">Cartoons & Animation</h2>
                      </div>
                      <p className="text-white/40 text-xs font-medium ml-11">{animation.length} titles available</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-10 px-6 md:px-12 pb-32">
                    {animation.map(movie => (
                      <div key={movie.id} onClick={() => handleMovieClick(movie)} className="cursor-pointer group relative transition-all duration-500 hover:scale-105 hover:z-50">
                        <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-lg border border-white/[0.06] group-hover:border-[#e50914]/50 group-hover:shadow-[0_8px_30px_rgba(229,9,20,0.15)] transition-all duration-500">
                          <img src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
                          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/60 to-transparent">
                            <p className="text-[9px] font-bold text-white uppercase truncate tracking-widest">{movie.title || movie.name}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeCategory === 'My List' && (
                <div className="pt-28 px-6 md:px-12 animate-in fade-in duration-500 min-h-screen">
                  <div className="flex items-center justify-between mb-10">
                    <h2 className="text-base font-semibold text-white mb-6 flex items-center">
                      <Bookmark className="w-4 h-4 mr-3 text-[#e50914]" />
                      Your Added Titles
                    </h2>
                    <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{myList.length} Items</span>
                  </div>
                  {myList.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                      {myList.map(movie => (
                        <div key={movie.id} onClick={() => handleMovieClick(movie)} className="cursor-pointer group">
                          <div className="relative aspect-[2/3] rounded-lg overflow-hidden border border-white/[0.06] bg-white/5 transition-all duration-500 group-hover:scale-[1.02] shadow-xl group-hover:border-[#e50914]/40 group-hover:shadow-[0_8px_30px_rgba(229,9,20,0.15)]">
                            <img src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`} className="w-full h-full object-cover" alt="" />
                            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/60 to-transparent">
                              <p className="text-[8px] font-bold text-white uppercase truncate tracking-widest">{movie.title || movie.name}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center pt-20 text-center opacity-20">
                      <Bookmark className="w-20 h-20 mb-6" />
                      <p className="text-sm font-bold uppercase tracking-[0.3em]">Your library is empty</p>
                    </div>
                  )}
                </div>
              )}

              {activeCategory === 'TV Shows' && (
                <div className="pt-28 animate-in fade-in duration-500 min-h-screen">
                  {/* Category Hero Banner */}
                  <div className="relative h-48 md:h-64 mb-4 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-900/60 via-indigo-900/40 to-[#141414]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
                    {tvShows[0]?.backdrop_path && <img src={`https://image.tmdb.org/t/p/w1280${tvShows[0].backdrop_path}`} className="w-full h-full object-cover opacity-30" alt="" />}
                    <div className="absolute bottom-8 left-6 md:left-12 z-10">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-8 h-8 bg-[#e50914] rounded-lg flex items-center justify-center">
                          <Play className="w-4 h-4 text-white fill-white" />
                        </div>
                        <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight">TV Shows</h2>
                      </div>
                      <p className="text-white/40 text-xs font-medium ml-11">Binge-worthy series for every mood</p>
                    </div>
                  </div>
                  <div className="space-y-12 pb-40">
                    <Row title="Popular TV Shows" movies={tvShows} onMovieClick={handleMovieClick} isLargeRow={true} />
                    <Row title="Trending" movies={trending.filter(m => m.first_air_date)} onMovieClick={handleMovieClick} />
                    <Row title="Mystery & Thriller" movies={mystery} onMovieClick={handleMovieClick} />
                  </div>
                </div>
              )}

              {activeCategory === 'Movies' && (
                <div className="pt-28 animate-in fade-in duration-500 min-h-screen">
                  {/* Category Hero Banner */}
                  <div className="relative h-48 md:h-64 mb-4 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-900/60 via-orange-900/40 to-[#141414]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
                    {trending[0]?.backdrop_path && <img src={`https://image.tmdb.org/t/p/w1280${trending[0].backdrop_path}`} className="w-full h-full object-cover opacity-30" alt="" />}
                    <div className="absolute bottom-8 left-6 md:left-12 z-10">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-8 h-8 bg-[#e50914] rounded-lg flex items-center justify-center">
                          <Play className="w-4 h-4 text-white fill-white" />
                        </div>
                        <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight">Movies</h2>
                      </div>
                      <p className="text-white/40 text-xs font-medium ml-11">Blockbusters and hidden gems</p>
                    </div>
                  </div>
                  <div className="space-y-12 pb-40">
                    <Row title="Upcoming Movies" movies={trending} onMovieClick={handleMovieClick} isLargeRow={true} />
                    <Row title="Action & Adventure" movies={action} onMovieClick={handleMovieClick} />
                    <Row title="Documentaries" movies={documentaries} onMovieClick={handleMovieClick} />
                  </div>
                </div>
              )}

              {activeCategory === 'Top Rated' && (
                <div className="pt-28 animate-in fade-in duration-500 min-h-screen">
                  {/* Category Hero Banner */}
                  <div className="relative h-48 md:h-64 mb-8 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-900/60 via-amber-900/40 to-[#141414]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
                    {topRated[0]?.backdrop_path && <img src={`https://image.tmdb.org/t/p/w1280${topRated[0].backdrop_path}`} className="w-full h-full object-cover opacity-30" alt="" />}
                    <div className="absolute bottom-8 left-6 md:left-12 z-10">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                          <Star className="w-4 h-4 text-white fill-white" />
                        </div>
                        <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight">Top Rated</h2>
                      </div>
                      <p className="text-white/40 text-xs font-medium ml-11">Critically acclaimed masterpieces</p>
                    </div>
                  </div>
                  <div className="px-6 md:px-12 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 pb-40">
                    {topRated.map(movie => (
                      <div key={movie.id} onClick={() => handleMovieClick(movie)} className="cursor-pointer group">
                        <div className="relative aspect-[2/3] rounded-lg overflow-hidden border border-white/[0.06] bg-white/5 transition-all duration-500 group-hover:scale-[1.02] shadow-xl group-hover:border-[#e50914]/40 group-hover:shadow-[0_8px_30px_rgba(229,9,20,0.15)]">
                          <img src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
                        </div>
                        <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-white transition-colors truncate">{movie.title || movie.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeCategory === 'Downloads' && (
                <div className="pt-28 px-6 md:px-12 animate-in fade-in duration-500 min-h-screen pb-40">
                  <div className="flex items-center justify-between mb-10">
                    <h2 className="text-base font-semibold text-white mb-6 flex items-center">
                      <Download className="w-4 h-4 mr-3 text-[#e50914]" />
                      Download Library
                    </h2>
                    <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{downloads.length} Movies</span>
                  </div>

                  {downloads.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                      {downloads.map((d) => (
                        <div key={d.id} className="group relative bg-white/[0.02] border border-white/5 rounded-sm overflow-hidden hover:border-[#e50914]/40 transition-all duration-500">
                          <div className="relative aspect-[2/3] overflow-hidden">
                            {d.posterPath && (
                              <img src={`https://image.tmdb.org/t/p/w342${d.posterPath}`} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700" alt="" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-transparent to-transparent opacity-60" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                              <a
                                href={d.url}
                                download
                                className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all"
                              >
                                <Play className="w-5 h-5 fill-current ml-1" />
                              </a>
                            </div>
                            <button
                              onClick={(e) => handleDeleteDownload(d.id, e)}
                              className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-[#e50914] text-white/40 hover:text-white rounded-sm backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all border border-white/5"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="p-4">
                            <h3 className="text-[10px] font-bold text-white uppercase truncate tracking-widest mb-1">{d.title}</h3>
                            <div className="flex items-center justify-between">
                              <span className="text-[8px] font-bold text-gray-600 uppercase">
                                {d.season ? `S${d.season} E${d.episode}` : 'Movie'}
                              </span>
                              <span className="bg-white/5 text-white/40 text-[7px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-widest">{d.quality}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center pt-24 text-center opacity-20">
                      <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-8 border border-white/5">
                        <Download className="w-10 h-10" />
                      </div>
                      <p className="text-sm font-bold uppercase tracking-[0.3em] mb-2">No downloaded movies</p>
                      <p className="text-[10px] uppercase tracking-widest text-gray-600">Start downloading to build your library</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Backend Status Dot */}
      <div className="fixed top-4 right-20 z-[60] flex items-center gap-2 px-2 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/5">
        <div className={`w-1.5 h-1.5 rounded-full ${backendStatus === 'online' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : backendStatus === 'checking' ? 'bg-yellow-500' : 'bg-red-500'}`} />
        <span className="text-[8px] font-bold text-white/40 tracking-widest uppercase">{backendStatus === 'online' ? 'Server Live' : 'Server Off'}</span>
      </div>

      {selectedMovie && (
        <Modal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          onPlay={handlePlay}
          isAddedToList={!!myList.find(m => m.id === selectedMovie.id)}
          onToggleList={() => toggleMyList(selectedMovie)}
        />
      )}

      <FooterNav
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        user={user}
        onAuthClick={() => setShowAuthModal(true)}
        isSearchOpen={isSearchOpen}
        setIsSearchOpen={setIsSearchOpen}
      />

      {showAuthModal && <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />}
    </div>
  );
};

export default App;
