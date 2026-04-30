import { BACKEND_URL as DEFAULT_BACKEND_URL } from '../constants';

const STORAGE_KEY_MODE = 'jmafk_backend_mode';
const STORAGE_KEY_CUSTOM_URL = 'jmafk_custom_backend_url';

export type BackendMode = 'local' | 'lan' | 'cloud';

export const getBackendMode = (): BackendMode => {
    return (localStorage.getItem(STORAGE_KEY_MODE) as BackendMode) || 'local';
};

export const setBackendMode = (mode: BackendMode) => {
    localStorage.setItem(STORAGE_KEY_MODE, mode);
};

export const getCustomBackendUrl = (): string => {
    return localStorage.getItem(STORAGE_KEY_CUSTOM_URL) || '';
};

export const setCustomBackendUrl = (url: string) => {
    localStorage.setItem(STORAGE_KEY_CUSTOM_URL, url);
};

export const getBackendUrl = (): string => {
    const mode = getBackendMode();
    switch (mode) {
        case 'local':
            return 'http://127.0.0.1:8000';
        case 'lan':
            return 'http://192.168.254.117:8000';
        case 'cloud':
            return getCustomBackendUrl() || DEFAULT_BACKEND_URL;
        default:
            return DEFAULT_BACKEND_URL;
    }
};
