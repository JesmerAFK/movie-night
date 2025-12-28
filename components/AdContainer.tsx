import React, { useEffect, useState } from 'react';

export const useVIP = () => {
    const [isVIP, setIsVIP] = useState(() => localStorage.getItem('jmafk_vip') === 'true');

    const toggleVIP = (val: boolean) => {
        localStorage.setItem('jmafk_vip', val ? 'true' : 'false');
        setIsVIP(val);
        window.location.reload(); // Reload to clear/init ad scripts
    };

    return { isVIP, toggleVIP };
};

interface AdProps {
    type: 'banner' | 'social' | 'native';
}

const AdContainer: React.FC<AdProps> = ({ type }) => {
    const { isVIP } = useVIP();

    useEffect(() => {
        if (isVIP) return;

        if (type === 'banner') {
            const script = document.createElement('script');
            script.src = "//www.highperformanceformat.com/302258509d5c79be3848d8fe8d87a908/invoke.js";
            script.async = true;
            (window as any).atOptions = {
                'key': '302258509d5c79be3848d8fe8d87a908',
                'format': 'iframe',
                'height': 250,
                'width': 300,
                'params': {}
            };
            document.getElementById('ad-banner-300')?.appendChild(script);
        }

        if (type === 'native') {
            const script = document.createElement('script');
            script.src = "https://pl28348629.effectivegatecpm.com/f6b15604ce5e482e36ae08ba2b763682/invoke.js";
            script.async = true;
            script.setAttribute('data-cfasync', 'false');
            document.getElementById('container-f6b15604ce5e482e36ae08ba2b763682')?.appendChild(script);
        }
    }, [type, isVIP]);

    if (isVIP) return null;

    if (type === 'banner') {
        return <div id="ad-banner-300" className="flex justify-center my-4 overflow-hidden rounded bg-black/20 min-h-[250px]"></div>;
    }

    if (type === 'native') {
        return <div id="container-f6b15604ce5e482e36ae08ba2b763682" className="my-6"></div>;
    }

    return null;
};

export default AdContainer;
