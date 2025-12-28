import React, { useState, useEffect, useRef } from 'react';
import { X, Clock } from 'lucide-react';

interface SkippableAdProps {
    onSkip: () => void;
}

const SkippableAd: React.FC<SkippableAdProps> = ({ onSkip }) => {
    const [timeLeft, setTimeLeft] = useState(15);
    const [canSkip, setCanSkip] = useState(false);
    const adContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (timeLeft <= 0) {
            setCanSkip(true);
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft]);

    // Inject Adsterra Scripts
    useEffect(() => {
        if (adContainerRef.current) {
            // First Script: effectivegatecpm
            const script1 = document.createElement('script');
            script1.src = "https://pl28348626.effectivegatecpm.com/9e/eb/4b/9eeb4b1727575879fd5b73cc0b5f94ad.js";
            script1.async = true;
            document.body.appendChild(script1);

            // Second Part: atOptions and invoke.js
            const adDiv = document.createElement('div');
            adDiv.id = "adsterra-ad-container";
            adContainerRef.current.appendChild(adDiv);

            const scriptOptions = document.createElement('script');
            scriptOptions.innerHTML = `
                atOptions = {
                    'key' : '302258509d5c79be3848d8fe8d87a908',
                    'format' : 'iframe',
                    'height' : 250,
                    'width' : 300,
                    'params' : {}
                };
            `;
            adDiv.appendChild(scriptOptions);

            const scriptInvoke = document.createElement('script');
            scriptInvoke.src = "https://www.highperformanceformat.com/302258509d5c79be3848d8fe8d87a908/invoke.js";
            scriptInvoke.async = true;
            adDiv.appendChild(scriptInvoke);

            return () => {
                document.body.removeChild(script1);
                if (adContainerRef.current) {
                    adContainerRef.current.innerHTML = '';
                }
            }
        }
    }, []);

    return (
        <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center p-6 animate-in fade-in duration-500 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            {/* Background Gradient */}
            <div className="absolute inset-0">
                <div className="absolute inset-0 bg-gradient-to-t from-[#e50914]/20 via-black to-black" />
            </div>

            <div className="relative z-10 w-full max-w-2xl flex flex-col items-center text-center flex-1 justify-center">
                {/* Branding */}
                <div className="flex items-center space-x-2 mb-8">
                    <div className="bg-[#e50914] text-white px-3 py-1 rounded-md font-black italic tracking-tighter shadow-[0_0_15px_rgba(229,9,20,0.4)]">JMAFK</div>
                    <span className="text-gray-400 text-xs font-bold uppercase tracking-[0.2em]">Sponsored Content</span>
                </div>

                {/* Adsterra/Adastra Ad Placement Container */}
                <div className="w-full flex items-center justify-center mb-8">
                    <div
                        ref={adContainerRef}
                        className="bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden shadow-2xl min-w-[300px] min-h-[250px]"
                    >
                        {/* Ads will be injected here */}
                    </div>
                </div>

                <h2 className="text-xl md:text-2xl font-black text-white mb-4 tracking-tight leading-tight uppercase">
                    Support us by watching this <span className="text-[#e50914]">15s Preview</span>
                </h2>

                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.1em] mb-12 max-w-xs">
                    This ad helps us keep JMAFK Movie Night free for everyone.
                </p>

                {/* Footer / Skip Logic */}
                <div className="w-full flex flex-col items-center mt-auto">
                    {canSkip ? (
                        <button
                            onClick={onSkip}
                            className="group flex items-center space-x-3 bg-white text-black font-black px-12 py-5 rounded-3xl hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(255,255,255,0.2)]"
                        >
                            <span className="text-sm tracking-widest uppercase">Skip to Movie</span>
                            <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                        </button>
                    ) : (
                        <div className="flex items-center space-x-4 bg-white/5 backdrop-blur-2xl border border-white/10 px-8 py-5 rounded-3xl">
                            <Clock className="w-6 h-6 text-[#e50914] animate-pulse" />
                            <span className="text-white font-black text-sm tabular-nums uppercase tracking-widest">Available in {timeLeft}s</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SkippableAd;
