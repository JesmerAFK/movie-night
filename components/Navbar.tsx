import React, { useState, useEffect } from 'react';
import { ChevronDown, Search as SearchIcon, Download, X, Trash2, Flame, Tv, Film, Sparkles, HardDrive } from 'lucide-react';
import { getDownloads, removeDownload, DownloadItem } from '../services/downloadTracker';

interface NavbarProps {
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  onSearchClick: () => void;
  isSearchOpen: boolean;
}

const categoryMeta: Record<string, { icon: React.ReactNode; label: string }> = {
  'Home': { icon: <Flame className="w-3.5 h-3.5" />, label: 'Home' },
  'TV Shows': { icon: <Tv className="w-3.5 h-3.5" />, label: 'TV Shows' },
  'Movies': { icon: <Film className="w-3.5 h-3.5" />, label: 'Movies' },
  'Cartoons': { icon: <Sparkles className="w-3.5 h-3.5" />, label: 'Cartoons' },
  'Downloads': { icon: <HardDrive className="w-3.5 h-3.5" />, label: 'Downloads' },
};

const Navbar: React.FC<NavbarProps> = ({ activeCategory, setActiveCategory, onSearchClick, isSearchOpen }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDownloadsPanel, setShowDownloadsPanel] = useState(false);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);

  const menuItems = ['Home', 'TV Shows', 'Movies', 'Cartoons', 'Downloads'];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);

    // Refresh downloads when panel opens
    if (showDownloadsPanel) {
      setDownloads(getDownloads());
    }

    return () => window.removeEventListener('scroll', handleScroll);
  }, [showDownloadsPanel]);

  const handleDeleteDownload = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeDownload(id);
    setDownloads(getDownloads());
  };

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
        isScrolled
          ? 'bg-[#0a0a0a]/95 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] border-b border-white/[0.04]'
          : 'bg-gradient-to-b from-black/80 via-black/40 to-transparent'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
        {/* Top bar with logo and actions */}
        <div className="h-14 sm:h-16 flex items-center justify-between">
          <div
            className="text-[#E50914] text-2xl sm:text-3xl font-black tracking-[-0.05em] cursor-pointer active:scale-95 transition-transform select-none"
            onClick={() => setActiveCategory('Home')}
            style={{ textShadow: '0 0 40px rgba(229, 9, 20, 0.3)' }}
          >
            MOVIEBOX
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowDownloadsPanel(!showDownloadsPanel)}
              className={`p-2 rounded-xl transition-all duration-300 active:scale-90 ${
                showDownloadsPanel
                  ? 'bg-[#E50914] text-white shadow-lg shadow-red-600/30'
                  : 'text-white/50 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Download className="w-[18px] h-[18px]" />
            </button>

            <button
              onClick={onSearchClick}
              className={`p-2 rounded-xl transition-all duration-300 active:scale-90 ${
                isSearchOpen
                  ? 'bg-[#E50914] text-white shadow-lg shadow-red-600/30'
                  : 'text-white/50 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <SearchIcon className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        {/* Category tabs - Desktop */}
        <div className="hidden md:flex items-center space-x-1 pb-3 -mt-1">
          {menuItems.map((item) => {
            const isActive = activeCategory === item;
            const meta = categoryMeta[item];
            return (
              <button
                key={item}
                onClick={() => setActiveCategory(item)}
                className={`relative flex items-center space-x-2 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.08em] transition-all duration-300 ${
                  isActive
                    ? 'bg-white/[0.12] text-white shadow-[0_0_20px_rgba(229,9,20,0.15)] border border-white/[0.08]'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <span className={`transition-colors duration-300 ${isActive ? 'text-[#E50914]' : ''}`}>
                  {meta.icon}
                </span>
                <span>{meta.label}</span>
                {isActive && (
                  <span className="absolute -bottom-[13px] left-1/2 -translate-x-1/2 w-6 h-[2px] bg-[#E50914] rounded-full shadow-[0_0_8px_rgba(229,9,20,0.6)]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Category tabs - Mobile */}
        <div className="md:hidden flex items-center space-x-1 pb-2.5 -mt-0.5 overflow-x-auto no-scrollbar">
          {menuItems.map((item) => {
            const isActive = activeCategory === item;
            const meta = categoryMeta[item];
            return (
              <button
                key={item}
                onClick={() => setActiveCategory(item)}
                className={`relative flex-shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.06em] transition-all duration-300 ${
                  isActive
                    ? 'bg-white/[0.12] text-white border border-white/[0.08]'
                    : 'text-white/35 border border-transparent'
                }`}
              >
                <span className={`transition-colors duration-300 ${isActive ? 'text-[#E50914]' : ''}`}>
                  {meta.icon}
                </span>
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Downloads Panel */}
      {showDownloadsPanel && (
        <div className="absolute top-20 right-6 w-80 bg-[#0f0f0f]/95 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <span className="text-white font-black text-xs uppercase tracking-widest">Recent Downloads</span>
            <button onClick={() => setShowDownloadsPanel(false)} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="max-h-96 overflow-y-auto no-scrollbar p-3 space-y-2">
            {downloads.length > 0 ? (
              downloads.map((d) => (
                <div key={d.id} className="group relative flex items-center space-x-3 bg-white/[0.02] hover:bg-white/[0.05] p-3 rounded-xl border border-white/5 transition-all">
                  <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                    {d.posterPath && (
                      <img src={`https://image.tmdb.org/t/p/w92${d.posterPath}`} className="w-full h-full object-cover" alt="" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[10px] font-black uppercase tracking-wider truncate mb-1">
                      {d.title} {d.season && `S${d.season}E${d.episode}`}
                    </p>
                    <div className="flex items-center space-x-2">
                      <span className="bg-[#E50914] text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm">{d.quality}</span>
                      <span className="text-white/20 text-[8px] font-bold uppercase tracking-widest">
                        {d.status === 'processing' ? 'Processing' : d.status === 'completed' ? 'Completed' : 'Failed'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteDownload(d.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-white/20 hover:text-[#E50914] transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
              <div className="py-10 text-center">
                <p className="text-white/20 text-[9px] font-black uppercase tracking-widest">No downloads yet</p>
              </div>
            )}
          </div>
          {downloads.length > 0 && (
            <button
              onClick={() => { setActiveCategory('Downloads'); setShowDownloadsPanel(false); }}
              className="w-full py-4 text-[#E50914] text-[10px] font-black uppercase tracking-widest border-t border-white/5 hover:bg-white/5 transition-colors"
            >
              View Library
            </button>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
