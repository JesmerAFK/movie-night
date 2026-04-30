import React from 'react';
import { Home, Search, Bookmark, User as UserIcon, Download } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface FooterNavProps {
    activeCategory: string;
    setActiveCategory: (cat: string) => void;
    isSearchOpen: boolean;
    setIsSearchOpen: (open: boolean) => void;
    user: FirebaseUser | null;
}

const FooterNav: React.FC<FooterNavProps> = ({ activeCategory, setActiveCategory, isSearchOpen, setIsSearchOpen, user }) => {
    return (
        <div className="fixed bottom-0 left-0 w-full z-[100] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden pointer-events-none">
            <div className="bg-black/95 border border-white/5 rounded-2xl h-16 flex items-center justify-around px-2 pointer-events-auto shadow-2xl backdrop-blur-xl">
                <button
                    onClick={() => { setActiveCategory('Home'); setIsSearchOpen(false); }}
                    className={`flex flex-col items-center space-y-1 ${activeCategory === 'Home' && !isSearchOpen ? 'text-[#E50914]' : 'text-white/40'}`}
                >
                    <Home className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Home</span>
                </button>

                <button
                    onClick={() => setIsSearchOpen(true)}
                    className={`flex flex-col items-center space-y-1 ${isSearchOpen ? 'text-[#E50914]' : 'text-white/40'}`}
                >
                    <Search className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Search</span>
                </button>

                <button
                    onClick={() => { setActiveCategory('My List'); setIsSearchOpen(false); }}
                    className={`flex flex-col items-center space-y-1 ${activeCategory === 'My List' && !isSearchOpen ? 'text-[#E50914]' : 'text-white/40'}`}
                >
                    <Bookmark className="w-6 h-6" />
                    <span className="text-[10px] font-medium">My List</span>
                </button>

                <button
                    onClick={() => { setActiveCategory('Downloads'); setIsSearchOpen(false); }}
                    className={`flex flex-col items-center space-y-1 ${activeCategory === 'Downloads' && !isSearchOpen ? 'text-[#E50914]' : 'text-white/40'}`}
                >
                    <Download className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Downloads</span>
                </button>

                <button
                    onClick={() => { setActiveCategory('Profile'); setIsSearchOpen(false); }}
                    className={`flex flex-col items-center space-y-1 ${activeCategory === 'Profile' ? 'text-[#E50914]' : 'text-white/40'}`}
                >
                    <div className={`w-6 h-6 rounded-full border-2 ${activeCategory === 'Profile' ? 'border-[#E50914]' : 'border-white/10'} flex items-center justify-center`}>
                        <UserIcon className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-[10px] font-medium">Profile</span>
                </button>
            </div>
        </div>
    );
};

export default FooterNav;
