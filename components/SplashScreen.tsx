import React from 'react';

const SplashScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center overflow-hidden animate-in fade-in duration-500">
            <div className="relative animate-in zoom-in duration-1000">
                <h1 className="text-white text-5xl font-black tracking-tighter">
                    <span className="text-[#E50914]">M</span>OVIE<span className="text-[#E50914]">B</span>OX
                </h1>
                <div className="mt-4 flex justify-center">
                    <div className="w-12 h-0.5 bg-[#E50914] animate-pulse" />
                </div>
            </div>
        </div>
    );
};

export default SplashScreen;
