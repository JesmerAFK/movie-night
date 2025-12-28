import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface NavbarProps {
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ activeCategory, setActiveCategory }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isVIP = localStorage.getItem('jmafk_vip') === 'true';

  const menuItems = ['Home', 'TV Shows', 'Movies', 'Cartoons'];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-[#141414] py-3' : 'bg-transparent py-5'} pt-[env(safe-area-inset-top)]`}>
      <div className="flex items-center px-6 md:px-12">
        {/* Logo */}
        <div
          className="text-[#e50914] text-2xl font-black italic tracking-tighter mr-8 cursor-pointer active:scale-95 transition-transform"
          onClick={() => setActiveCategory('Home')}
        >
          JMAFK
          {isVIP && <span className="ml-1 text-[8px] bg-yellow-500 text-black px-1 rounded-sm font-bold align-top">VIP</span>}
        </div>

        {/* Categories Dropdown (Mobile Optimized) */}
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center space-x-1 text-white text-sm font-bold group"
          >
            <span>{activeCategory === 'Home' ? 'Browse' : activeCategory}</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
              <div className="absolute top-full left-0 mt-4 w-48 bg-[#141414]/95 border border-white/10 backdrop-blur-xl rounded-lg shadow-2xl z-20 overflow-hidden animate-in slide-in-from-top-2 duration-300">
                {menuItems.map(item => (
                  <button
                    key={item}
                    onClick={() => {
                      setActiveCategory(item);
                      setIsMenuOpen(false);
                    }}
                    className={`w-full text-left px-5 py-4 text-sm font-bold transition-colors ${activeCategory === item ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
