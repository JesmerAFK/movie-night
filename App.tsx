import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Row from './components/Row';
import Modal from './components/Modal';
import Player from './components/Player';
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
  const [searchResults, setSearchResults] = useState<Movie[] | null>(null);

  // UI State
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [playingMovie, setPlayingMovie] = useState<Movie | null>(null);
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
        romanceData
      ] = await Promise.all([
        requests.fetchTrending(),
        requests.fetchTopRated(),
        requests.fetchActionMovies(),
        requests.fetchComedyMovies(),
        requests.fetchHorrorMovies(),
        requests.fetchRomanceMovies()
      ]);

      setTrending(trendingData);
      setTopRated(topRatedData);
      setAction(actionData);
      setComedy(comedyData);
      setHorror(horrorData);
      setRomance(romanceData);

      // Random featured movie
      if (trendingData.length > 0) {
        const random = trendingData[Math.floor(Math.random() * trendingData.length)];
        setFeaturedMovie(random);
      }
    };

    fetchAllData();
  }, []);

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

  const handlePlay = (movie: Movie) => {
    setSelectedMovie(null); // Close modal if open
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

          <div className="-mt-10 md:-mt-32 relative z-10 pl-4 md:pl-12 space-y-8">
            {activeCategory === 'Home' && (
              <>
                <Row title="Trending Now" movies={trending} onMovieClick={handleMovieClick} />
                <Row title="Top Rated" movies={topRated} onMovieClick={handleMovieClick} isLargeRow />
                <Row title="Action Thrillers" movies={action} onMovieClick={handleMovieClick} />
                <Row title="Comedies" movies={comedy} onMovieClick={handleMovieClick} />
                <Row title="Scary Movies" movies={horror} onMovieClick={handleMovieClick} />
                <Row title="Romance" movies={romance} onMovieClick={handleMovieClick} />
              </>
            )}

            {activeCategory === 'TV Shows' && (
              <>
                <Row title="Popular TV Shows" movies={trending.filter(m => m.first_air_date)} onMovieClick={handleMovieClick} isLargeRow />
                <Row title="Comedies" movies={comedy} onMovieClick={handleMovieClick} />
              </>
            )}

            {activeCategory === 'Movies' && (
              <>
                <Row title="Action Movies" movies={action} onMovieClick={handleMovieClick} isLargeRow />
                <Row title="Top Rated Movies" movies={topRated} onMovieClick={handleMovieClick} />
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
