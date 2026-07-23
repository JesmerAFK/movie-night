import React, { useEffect, useRef, useState } from 'react';
import { getBackendUrl } from '../services/backend';

interface SplashScreenProps {
    onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [showSkip, setShowSkip] = useState(false);
    const videoUrl = `${getBackendUrl()}/local_assets/intro.mp4`;

    useEffect(() => {
        // Attempt autoplay with sound. If blocked by browser/webview engine, fallback to muted.
        if (videoRef.current) {
            videoRef.current.play().catch(err => {
                console.warn("Autoplay with sound blocked. Retrying in muted mode...", err);
                if (videoRef.current) {
                    videoRef.current.muted = true;
                    videoRef.current.play().catch(muteErr => {
                        console.error("Muted autoplay failed, skipping intro video.", muteErr);
                        onComplete();
                    });
                }
            });
        }

        // 8-second safety fallback timeout to ensure the app doesn't softlock if the video fails to load or hang
        const safetyTimeout = setTimeout(() => {
            console.warn("Splash video exceeded safety timeout. Automatically completing.");
            onComplete();
        }, 8000);

        // Fade-in skip button after 1.5 seconds
        const skipTimer = setTimeout(() => {
            setShowSkip(true);
        }, 1500);

        return () => {
            clearTimeout(safetyTimeout);
            clearTimeout(skipTimer);
        };
    }, [onComplete]);

    return (
        <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center overflow-hidden animate-in fade-in duration-500">
            <video
                ref={videoRef}
                src={videoUrl}
                playsInline
                className="w-full h-full object-cover"
                onEnded={onComplete}
                onError={(e) => {
                    console.error("Splash video playback error:", e);
                    onComplete();
                }}
            />
            {showSkip && (
                <button
                    onClick={onComplete}
                    className="absolute bottom-8 right-8 z-[10000] px-6 py-2.5 bg-black/45 hover:bg-black/70 text-white/80 hover:text-white border border-white/10 hover:border-white/30 rounded-full backdrop-blur-md font-medium tracking-wider text-xs uppercase shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 animate-in fade-in slide-in-from-bottom-4 duration-500"
                >
                    Skip Intro
                </button>
            )}
        </div>
    );
};

export default SplashScreen;
