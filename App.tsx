import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Row from './components/Row';
import Modal from './components/Modal';
import Player from './components/Player';
import AdContainer from './components/AdContainer';
import { Movie } from './types';
import { requests } from './services/api';

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

  // UI State
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [playingMovie, setPlayingMovie] = useState<Movie | null>(null);
  const [startSeason, setStartSeason] = useState(1);
  const [startEpisode, setStartEpisode] = useState(1);
  const [activeCategory, setActiveCategory] = useState('Home');
  const [myList, setMyList] = useState<Movie[]>([]);

  // Clear search results when category changes
  useEffect(() => {
    setSearchResults(null);
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

  // Update featured movie when category changes or data loads
  useEffect(() => {
    let pool: Movie[] = trending;

    if (activeCategory === 'TV Shows') pool = tvShows;
    else if (activeCategory === 'Movies') pool = topRated;
    else if (activeCategory === 'Cartoons') pool = animation;
    else pool = trending;

    if (pool.length > 0) {
      // Pick a random one from the first 10 for quality/relevance
      const subset = pool.slice(0, 10);
      setFeaturedMovie(subset[Math.floor(Math.random() * subset.length)]);
    }
  }, [activeCategory, trending, tvShows, topRated, animation]);

  const handleSearch = async (query: string) => {
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
    // Ad Trick: Pop-under on play if not VIP
    const isVIP = localStorage.getItem('jmafk_vip') === 'true';
    if (!isVIP) {
      window.open('https://www.effectivegatecpm.com/ui800ve1c?key=8d659d59e311fdf92c8e5ad584a75092', '_blank');
    }

    setSelectedMovie(null); // Close modal if open
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

  // If Playing, show Player View
  if (playingMovie) {
    return (
      <Player
        movie={playingMovie}
        onBack={() => setPlayingMovie(null)}
        initialSeason={startSeason}
        initialEpisode={startEpisode}
      />
    );
  }

  // Main Browsing View
  return (
    <div className="relative min-h-screen bg-[#141414] pb-20">
      <Navbar onSearch={handleSearch} activeCategory={activeCategory} setActiveCategory={setActiveCategory} />

      {/* If Searching, show Grid instead of Rows */}
      {searchResults ? (
        <div className="pt-24 px-4 md:px-12 min-h-screen">
          <h2 className="text-2xl font-bold mb-6 text-white">Search Results</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {searchResults.map(movie => (
              movie.poster_path && (
                <div
                  key={movie.id}
                  className="relative group cursor-pointer transition duration-200 ease-out hover:scale-105 hover:z-50"
                  onClick={() => handleMovieClick(movie)}
                >
                  <img
                    src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                    alt={movie.title}
                    className="rounded"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-white font-bold text-center px-2 text-xs md:text-sm">{movie.title}</p>
                  </div>
                </div>
              )
            ))}
            {searchResults.length === 0 && (
              <p className="text-gray-500">No results found.</p>
            )}
          </div>
        </div>
      ) : (
        <>
          <Hero
            movie={featuredMovie}
            onPlay={handlePlay}
            onMoreInfo={handleMovieClick}
          />

          <div className="-mt-8 sm:-mt-12 md:-mt-16 relative z-10 pl-4 md:pl-12 space-y-8 pt-4 md:pt-8">
            {activeCategory === 'Home' && (
              <>
                <Row title="Trending Now" movies={trending} onMovieClick={handleMovieClick} />
                <Row title="Top Rated" movies={topRated} onMovieClick={handleMovieClick} />
                <Row title="TV Shows" movies={tvShows} onMovieClick={handleMovieClick} isLargeRow />
                <AdContainer type="banner" />
                <Row title="Action Thrillers" movies={action} onMovieClick={handleMovieClick} />
                <Row title="Science Fiction" movies={sciFi} onMovieClick={handleMovieClick} />
                <Row title="Comedies" movies={comedy} onMovieClick={handleMovieClick} />
                <Row title="Animation" movies={animation} onMovieClick={handleMovieClick} />
                <Row title="Scary Movies" movies={horror} onMovieClick={handleMovieClick} />
                <AdContainer type="native" />
                <Row title="Mystery" movies={mystery} onMovieClick={handleMovieClick} />
                <Row title="Romance" movies={romance} onMovieClick={handleMovieClick} />
                <Row title="Documentaries" movies={documentaries} onMovieClick={handleMovieClick} />
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
                <Row title="Animation" movies={animation} onMovieClick={handleMovieClick} />
              </>
            )}

            {activeCategory === 'Cartoons' && (
              <>
                <Row title="Popular Animations" movies={animation} onMovieClick={handleMovieClick} isLargeRow />
                <Row title="Family Favorites" movies={family} onMovieClick={handleMovieClick} />
                <Row title="Trending Cartoons" movies={animation.filter(m => m.vote_average > 7)} onMovieClick={handleMovieClick} />
                <Row title="Sci-Fi & Fantasy" movies={sciFi.filter(m => m.genre_ids?.includes(14) || m.genre_ids?.includes(16))} onMovieClick={handleMovieClick} />
              </>
            )}

            {activeCategory === 'My List' && (
              <div className="pt-20">
                <h2 className="text-2xl font-bold mb-6 text-white px-4">My List</h2>
                {myList.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 px-4">
                    {myList.map(movie => (
                      <div
                        key={movie.id}
                        className="relative group cursor-pointer transition duration-200 ease-out hover:scale-105 hover:z-50"
                        onClick={() => handleMovieClick(movie)}
                      >
                        <img
                          src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                          alt={movie.title}
                          className="rounded"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 px-4">Your list is empty. Add some movies!</p>
                )}
              </div>
            )}
          </div>
        </>
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

      {/* Footer */}
      <footer className="mt-20 py-10 text-center text-gray-500 text-sm bg-black/50">
        <p className="mb-2">Movie Night by JMAFK</p>
        <p className="max-w-xl mx-auto px-4">
          Disclaimer: This site does not host any video files. All content is provided by non-affiliated third parties.
        </p>
      </footer>
    </div>
  );
};

export default App;
