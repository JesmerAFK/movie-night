export interface HistoryItem {
    id: number;
    title: string;
    poster_path: string;
    timestamp: number;
    duration: number;
    season?: number;
    episode?: number;
    lastUpdated: number;
    isTV?: boolean;
}

const HISTORY_KEY = 'jmafk_history';

export const saveHistory = (item: Omit<HistoryItem, 'lastUpdated'>) => {
    try {
        const historyJson = localStorage.getItem(HISTORY_KEY);
        let history: HistoryItem[] = historyJson ? JSON.parse(historyJson) : [];

        // Remove existing entry for same movie/episode to avoid duplicates
        history = history.filter(h =>
            !(h.id === item.id && h.season === item.season && h.episode === item.episode)
        );

        // Add new entry at start
        history.unshift({
            ...item,
            lastUpdated: Date.now()
        });

        // Limit to 40 items
        history = history.slice(0, 40);

        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
        console.error('History save error:', e);
    }
};

export const getHistory = (): HistoryItem[] => {
    try {
        const historyJson = localStorage.getItem(HISTORY_KEY);
        return historyJson ? JSON.parse(historyJson) : [];
    } catch (e) {
        return [];
    }
};

export const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
};
