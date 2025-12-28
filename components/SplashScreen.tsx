import React, { useEffect, useState } from 'react';

const SplashScreen: React.FC = () => {
    const [isVisible, setIsVisible] = useState(true);
    const [isFading, setIsFading] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsFading(true);
            setTimeout(() => setIsVisible(false), 800);
        }, 2500);

        return () => clearTimeout(timer);
    }, []);

    if (!isVisible) return null;

    return (
        <div className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-800 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
            <div className="flex flex-col items-center animate-in zoom-in duration-700">
                <div className="text-[#e50914] text-7xl font-black italic tracking-tighter mb-4 drop-shadow-[0_0_20px_rgba(229,9,20,0.5)]">
                    JMAFK
                </div>
                <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#e50914] animate-loading-bar" />
                </div>
            </div>
            <style>{`
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-loading-bar {
          animation: loading-bar 1.5s infinite linear;
        }
      `}</style>
        </div>
    );
};

export default SplashScreen;
