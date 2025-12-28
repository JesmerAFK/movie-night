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
import { db, auth } from './services/firebase';
import { ref, get } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Users, Play, X, Search as SearchIcon } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';

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
  const [lobbyMovie, setLobbyMovie] = useState<Movie | null>(null);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // Android Back Button Handling
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

  // Load My List from localStorage
  useEffect(() => {
    const savedList = localStorage.getItem('jmafk_mylist');
    if (savedList) {
      setMyList(JSON.parse(savedList));
    }
  }, []);

  // Save My List to localStorage
  useEffect(() => {
    localStorage.setItem('jmafk_mylist', JSON.stringify(myList));
  }, [myList]);

  // Check for Room in URL and show lobby
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rid = params.get('room');
    if (rid) {
      const checkRoom = async () => {
        try {
          const snapshot = await get(ref(db, `rooms/${rid}`));
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
        requests.fetchFamily()
      ]);

      setTrending(trendingData);
      setTopRated(topRatedData);
      setAction(actionData);
      setComedy(comedyData);
      setHorror(horrorData);
      setRomance(romanceData);
      setSciFi(sciFiData);
      setAnimation(animationData);
      setMystery(mysteryData);
      setDocumentaries(docsData);
      setTVShows(tvData);
      setFamily(familyData);
    };

    fetchAllData();
  }, []);

  // Update featured movie
  useEffect(() => {
    let pool: Movie[] = trending;
    if (activeCategory === 'TV Shows') pool = tvShows;
    else if (activeCategory === 'Movies') pool = topRated;
    else if (activeCategory === 'Cartoons') pool = animation;
    else pool = trending;

    if (pool.length > 0) {
      const subset = pool.slice(0, 10);
      setFeaturedMovie(subset[Math.floor(Math.random() * subset.length)]);
    }
  }, [activeCategory, trending, tvShows, topRated, animation]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length === 0) {
      setSearchResults(null);
      return;
    }
    const results = await requests.searchMovies(query);
    setSearchResults(results);
  };

  const handleMovieClick = (movie: Movie) => {
    setSelectedMovie(movie);
  };

  const handlePlay = (movie: Movie, season?: number, episode?: number) => {
    setSelectedMovie(null);
    setStartSeason(season || 1);
    setStartEpisode(episode || 1);
    setPlayingMovie(movie);
  };

  const toggleMyList = (movie: Movie) => {
    setMyList(prev => {
      const isAlreadyAdded = prev.find(item => item.id === movie.id);
      if (isAlreadyAdded) {
        return prev.filter(item => item.id !== movie.id);
      } else {
        return [movie, ...prev];
      }
    });
  };

  if (playingMovie) {
    return (
      <Player
        movie={playingMovie}
        onBack={() => setPlayingMovie(null)}
        initialSeason={startSeason}
        initialEpisode={startEpisode}
        isAddedToList={!!myList.find(m => m.id === playingMovie.id)}
        onToggleList={() => toggleMyList(playingMovie)}
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-[#141414] overflow-x-hidden">
      <SplashScreen />

      <Navbar
        activeCategory={activeCategory}
        setActiveCategory={(cat) => {
          setActiveCategory(cat);
          setIsSearchOpen(false);
        }}
      />

      {/* Main Content Area */}
      <main className={`pb-32 transition-opacity duration-500 ${isSearchOpen ? 'pt-24' : ''}`}>
        {isSearchOpen ? (
          <div className="px-6 md:px-12 min-h-screen">
            <div className="relative mb-12">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search for movies, TV shows..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-white text-lg outline-none focus:border-[#e50914] transition-colors"
              />
            </div>

            {searchResults ? (
              <>
                <h2 className="text-xl font-black text-white mb-6 uppercase tracking-widest">Results</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {searchResults.map(movie => (
                    movie.poster_path && (
                      <div
                        key={movie.id}
                        className="relative aspect-[2/3] rounded-xl overflow-hidden group cursor-pointer active:scale-95 transition-all"
                        onClick={() => handleMovieClick(movie)}
                      >
                        <img
                          src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                          alt={movie.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                          <p className="text-white font-black text-xs uppercase text-center w-full">{movie.title || movie.name}</p>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center pt-20 text-center opacity-30">
                <SearchIcon className="w-20 h-20 text-gray-500 mb-4" />
                <p className="text-gray-500 font-bold uppercase tracking-[0.3em]">Type to explore</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <Hero
              movie={featuredMovie}
              onPlay={handlePlay}
              onMoreInfo={handleMovieClick}
            />

            <div className="-mt-16 sm:-mt-24 md:-mt-32 relative z-10 space-y-12">
              {activeCategory === 'Home' && (
                <>
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

              {activeCategory === 'TV Shows' && (
                <>
                  <Row title="Popular TV Shows" movies={tvShows} onMovieClick={handleMovieClick} isLargeRow />
                  <Row title="Trending" movies={trending.filter(m => m.first_air_date)} onMovieClick={handleMovieClick} />
                  <Row title="Mystery & Thriller" movies={mystery} onMovieClick={handleMovieClick} />
                </>
              )}

              {activeCategory === 'Movies' && (
                <>
                  <Row title="Action Movies" movies={action} onMovieClick={handleMovieClick} isLargeRow />
                  <Row title="Top Rated Movies" movies={topRated} onMovieClick={handleMovieClick} />
                  <Row title="Sci-Fi & Fantasy" movies={sciFi} onMovieClick={handleMovieClick} />
                </>
              )}

              {activeCategory === 'Cartoons' && (
                <>
                  <Row title="Popular Animations" movies={animation} onMovieClick={handleMovieClick} isLargeRow />
                  <Row title="Family Favorites" movies={family} onMovieClick={handleMovieClick} />
                </>
              )}

              {activeCategory === 'My List' && (
                <div className="pt-24 px-6 min-h-screen">
                  <h2 className="text-2xl font-black mb-10 text-white uppercase tracking-widest text-center">My List</h2>
                  {myList.length > 0 ? (
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-6">
                      {myList.map(movie => (
                        <div
                          key={movie.id}
                          className="relative aspect-[2/3] rounded-2xl overflow-hidden group cursor-pointer active:scale-105 transition-all shadow-2xl border border-white/5"
                          onClick={() => handleMovieClick(movie)}
                        >
                          <img
                            src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                            alt={movie.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 opacity-30">
                      <Play className="w-16 h-16 mb-4 rotate-90" />
                      <p className="text-gray-500 font-bold uppercase tracking-widest">Nothing yet</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Navigation Footer */}
      <FooterNav
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        user={user}
        onAuthClick={() => setShowAuthModal(true)}
        isSearchOpen={isSearchOpen}
        setIsSearchOpen={setIsSearchOpen}
      />

      {/* Lobby Join Overlay */}
      {lobbyMovie && joiningRoomId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
          <div className="bg-[#181818] w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl border border-white/5 animate-in zoom-in duration-500">
            <div className="relative aspect-video">
              <img
                src={`https://image.tmdb.org/t/p/original${lobbyMovie.backdrop_path || lobbyMovie.poster_path}`}
                className="w-full h-full object-cover"
                alt="Movie Backdrop"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#181818] to-transparent" />
            </div>
            <div className="p-10 text-center">
              <div className="bg-[#e50914] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(229,9,20,0.5)]">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-black text-white mb-4">Join Party?</h2>
              <p className="text-gray-400 mb-8 italic text-sm">Someone invited you to watch <b>{lobbyMovie.title || lobbyMovie.name}</b></p>
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => { handlePlay(lobbyMovie); setLobbyMovie(null); }}
                  className="w-full bg-[#e50914] hover:bg-[#b81d24] text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-red-600/20 active:scale-95 uppercase tracking-widest"
                >
                  Join Room
                </button>
                <button
                  onClick={() => { setLobbyMovie(null); window.history.pushState({}, '', '/'); }}
                  className="w-full bg-white/5 text-white font-bold py-4 rounded-2xl active:scale-95 transition-all text-sm uppercase"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {selectedMovie && (
        <Modal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          onPlay={handlePlay}
          isAddedToList={!!myList.find(m => m.id === selectedMovie.id)}
          onToggleList={() => toggleMyList(selectedMovie)}
        />
      )}

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
};

export default App;
