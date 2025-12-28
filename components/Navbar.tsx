import React, { useState, useEffect } from 'react';
import { Search, Bell, User } from 'lucide-react';

interface NavbarProps {
  onSearch: (query: string) => void;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  onAuthClick: () => void;
}

import { auth } from '../services/firebase';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';

const Navbar: React.FC<NavbarProps> = ({ onSearch, activeCategory, setActiveCategory, onAuthClick }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [clickCount, setClickCount] = useState(0);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const isVIP = localStorage.getItem('jmafk_vip') === 'true';

  const menuItems = ['Home', 'TV Shows', 'Movies', 'Cartoons', 'My List'];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogoClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount === 7) {
      const current = localStorage.getItem('jmafk_vip') === 'true';
      localStorage.setItem('jmafk_vip', (!current).toString());
      alert(current ? 'VIP Mode Disabled 🔴' : 'VIP Mode Enabled! 🟢 (No Ads)');
      window.location.reload();
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 100) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onSearch(val);
  };

  return (
    <nav className={`fixed top-0 w-full z-50 transition-colors duration-300 ${isScrolled ? 'bg-[#141414]' : 'bg-transparent backdrop-gradient-top'}`}>
      <div className="flex items-center justify-between px-4 md:px-12 py-4">
        <div className="flex items-center space-x-8">
          {/* Logo */}
          <div
            className="text-red-600 text-2xl md:text-3xl font-extrabold cursor-pointer tracking-tighter select-none flex items-center gap-2"
            onClick={handleLogoClick}
          >
            JMAFK
            {isVIP && <span className="text-[10px] bg-yellow-500 text-black px-1.5 py-0.5 rounded-full font-bold shadow-glow">VIP</span>}
          </div>

          {/* Desktop Menu */}
          <ul className="hidden md:flex space-x-4 text-sm">
            {menuItems.map(item => (
              <li
                key={item}
                onClick={() => setActiveCategory(item)}
                className={`${activeCategory === item ? 'text-white font-bold' : 'text-gray-300'} hover:text-white cursor-pointer transition`}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center space-x-6 text-white">
          <div className={`flex items-center border-white transition-all duration-300 ${isSearchOpen ? 'bg-black/80 border border-white/50 px-2 py-1' : ''}`}>
            <Search
              className="w-5 h-5 cursor-pointer hover:text-gray-300"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
            />
            <input
              type="text"
              placeholder="Titles, people, genres"
              className={`bg-transparent text-sm ml-2 outline-none text-white placeholder-gray-400 transition-all duration-300 ${isSearchOpen ? 'w-40 md:w-60 opacity-100' : 'w-0 opacity-0'}`}
              value={query}
              onChange={handleSearchChange}
            />
          </div>
          <Bell className="w-5 h-5 hidden sm:block cursor-pointer hover:text-gray-300" />

          <div className="flex items-center space-x-4">
            {user ? (
              <div className="group relative">
                <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center cursor-pointer">
                  <User className="w-5 h-5" />
                </div>
                <div className="absolute right-0 top-full pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <div className="bg-black/95 border border-white/10 p-4 rounded min-w-[200px] shadow-2xl">
                    <p className="text-white font-bold text-sm mb-1 truncate">{user.displayName || 'Watcher'}</p>
                    <p className="text-gray-400 text-[10px] mb-4 truncate">{user.email}</p>
                    <button
                      onClick={() => signOut(auth)}
                      className="w-full py-2 hover:bg-white/5 text-white text-xs border-t border-white/10 transition-colors"
                    >
                      Sign out of JMAFK
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={onAuthClick}
                className="bg-[#e50914] text-white px-4 py-1.5 rounded text-xs md:text-sm font-bold active:scale-95 transition-all shadow-lg shadow-red-600/20"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
