import React, { useState, useEffect } from 'react';
import { Search, Bell, User } from 'lucide-react';

interface NavbarProps {
  onSearch: (query: string) => void;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ onSearch, activeCategory, setActiveCategory }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const menuItems = ['Home', 'TV Shows', 'Movies', 'New & Popular', 'My List'];

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
          <div className="text-red-600 font-bold text-2xl md:text-3xl tracking-tighter cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            JMAFK
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
          <div className="flex items-center cursor-pointer">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
