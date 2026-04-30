import { Capacitor, CapacitorHttp } from '@capacitor/core';

const MIRROR_HOSTS = [
    'moviebox.pk',
    'moviebox.ph',
    'moviebox.ws',
    'moviebox.io',
    'moviebox.nz',
    'netnaija.video',
    'mbfamily.co',
    'moviebox.org.in',
    'moviebox.vin'
];

interface MovieBoxItem {
    id: string;
    title: string;
    year: number;
    subjectType: string;
}

interface StreamFile {
    quality: string;
    url: string;
}

interface SubtitleFile {
    language: string;
    url: string;
}

const getHeaders = (host: string) => ({
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
    'x-app-id': 'moviebox-android',
    'x-platform': 'android',
    'x-app-version': '1.5.2',
    'Accept-Language': 'en-US,en;q=0.9',
});

const request = async (url: string, host: string) => {
    const options = {
        url,
        headers: getHeaders(host),
        connectTimeout: 5000,
        readTimeout: 5000,
    };

    if (Capacitor.isNativePlatform()) {
        const response = await CapacitorHttp.get(options);
        return response.data;
    } else {
        try {
            const response = await fetch(url, { headers: getHeaders(host) });
            return await response.json();
        } catch (e) {
            const resp = await fetch(url);
            return await resp.json();
        }
    }
}

const getScore = (query: string, item: any) => {
    const q = query.toLowerCase().trim();
    const t = (item.title || '').toLowerCase().trim();
    if (t === q) return 100;
    if (t.includes(q)) return 80;
    return 0;
};

export const moviebox = {
    search: async (title: string, isTV: boolean): Promise<MovieBoxItem[]> => {
        const type = isTV ? 'tv' : 'movie';
        const cleanTitle = title.replace(/[^a-zA-Z0-9 ]/g, '').trim();
        const queryVariants = [title];
        if (cleanTitle !== title) queryVariants.push(cleanTitle);

        const searchPromises = MIRROR_HOSTS.slice(0, 4).flatMap(host =>
            queryVariants.map(async (q) => {
                try {
                    const data = await request(`https://${host}/api/v1/search?q=${encodeURIComponent(q)}&type=${type}`, host);
                    const rawItems = (data.resData?.items || data.items || []);
                    return rawItems.map((item: any) => ({
                        ...item,
                        id: item.mid || item.id,
                        title: item.title || item.name,
                        score: getScore(title, { title: item.title || item.name })
                    }));
                } catch (err) {
                    return [];
                }
            })
        );

        const results = await Promise.all(searchPromises);
        const allItems = results.flat();

        const seen = new Set();
        const uniqueItems = allItems.filter(item => {
            const duplicate = seen.has(item.id);
            seen.add(item.id);
            return !duplicate && item.id;
        });

        return uniqueItems.sort((a, b) => b.score - a.score);
    },

    getFiles: async (itemId: string, season?: number, episode?: number): Promise<{ streams: StreamFile[], subtitles: SubtitleFile[] }> => {
        const filePromises = MIRROR_HOSTS.slice(0, 6).map(async (host) => {
            try {
                let url = `https://${host}/api/v1/movie/files?id=${itemId}`;
                if (season && episode) {
                    url = `https://${host}/api/v1/tv/files?id=${itemId}&s=${season}&e=${episode}`;
                }
                const data = await request(url, host);
                const resData = data.resData || data;

                if (resData && (resData.downloads?.length > 0 || resData.captions?.length > 0)) {
                    return resData;
                }
                return null;
            } catch (err) {
                return null;
            }
        });

        const results = await Promise.all(filePromises);
        const data = results.find(r => r !== null);

        if (!data) return { streams: [], subtitles: [] };

        const streams = (data.downloads || []).map((d: any) => ({
            quality: d.resolution || d.quality || 'Auto',
            url: d.url
        }));

        const subtitles = (data.captions || []).map((c: any) => ({
            language: c.lanName || c.lan || 'English',
            url: c.url
        }));

        return { streams, subtitles };
    }
};
