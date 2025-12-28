import React from 'react';
import { Home, Search, Bookmark, User, UserCircle } from 'lucide-react';
import { auth } from '../services/firebase';
import { User as FirebaseUser } from 'firebase/auth';

interface FooterNavProps {
    activeCategory: string;
    setActiveCategory: (cat: string) => void;
    user: FirebaseUser | null;
    onAuthClick: () => void;
    isSearchOpen: boolean;
    setIsSearchOpen: (open: boolean) => void;
}

const FooterNav: React.FC<FooterNavProps> = ({
    activeCategory,
    setActiveCategory,
    user,
    onAuthClick,
    isSearchOpen,
    setIsSearchOpen
}) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414]/90 backdrop-blur-xl border-t border-white/5 px-6 pb-safe-bottom pt-3">
            <div className="flex items-center justify-between max-w-lg mx-auto">
                <button
                    onClick={() => {
                        setActiveCategory('Home');
                        setIsSearchOpen(false);
                    }}
                    className={`flex flex-col items-center space-y-1 transition-colors ${activeCategory === 'Home' && !isSearchOpen ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <Home className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Home</span>
                </button>

                <button
                    onClick={() => setIsSearchOpen(true)}
                    className={`flex flex-col items-center space-y-1 transition-colors ${isSearchOpen ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <Search className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Search</span>
                </button>

                <button
                    onClick={() => {
                        setActiveCategory('My List');
                        setIsSearchOpen(false);
                    }}
                    className={`flex flex-col items-center space-y-1 transition-colors ${activeCategory === 'My List' && !isSearchOpen ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <Bookmark className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">My List</span>
                </button>

                {user ? (
                    <button
                        onClick={() => {
                            setActiveCategory('Profile'); // We can add a profile category or modal
                            setIsSearchOpen(false);
                        }}
                        className={`flex flex-col items-center space-y-1 transition-colors ${activeCategory === 'Profile' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest">Me</span>
                    </button>
                ) : (
                    <button
                        onClick={onAuthClick}
                        className="flex flex-col items-center space-y-1 text-[#e50914] hover:text-red-400 transition-colors"
                    >
                        <UserCircle className="w-6 h-6" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Sign In</span>
                    </button>
                )}
            </div>

            <style>{`
        .pb-safe-bottom {
          padding-bottom: calc(env(safe-area-inset-bottom) + 0.75rem);
        }
      `}</style>
        </div>
    );
};

export default FooterNav;
