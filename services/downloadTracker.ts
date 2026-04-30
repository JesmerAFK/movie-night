export interface DownloadItem {
    id: string;
    title: string;
    quality: string;
    url: string;
    timestamp: number;
    status: 'processing' | 'completed' | 'failed';
    posterPath?: string;
    season?: number;
    episode?: number;
}

const STORAGE_KEY = 'movie_night_downloads';

export const getDownloads = (): DownloadItem[] => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
};

export const addDownload = (item: DownloadItem) => {
    const downloads = getDownloads();
    downloads.unshift(item); // Add to front
    // Keep only last 50
    const limited = downloads.slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
};

export const removeDownload = (id: string) => {
    const downloads = getDownloads();
    const filtered = downloads.filter(d => d.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};
