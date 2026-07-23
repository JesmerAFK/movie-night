import { BACKEND_URL as DEFAULT_BACKEND_URL } from '../constants';

const STORAGE_KEY_MODE = 'jmafk_backend_mode';
const STORAGE_KEY_CUSTOM_URL = 'jmafk_custom_backend_url';

export type BackendMode = 'local' | 'lan' | 'cloud';

export const getBackendMode = (): BackendMode => {
    return (localStorage.getItem(STORAGE_KEY_MODE) as BackendMode) || 'cloud';
};

export const setBackendMode = (mode: BackendMode) => {
    localStorage.setItem(STORAGE_KEY_MODE, mode);
};

export const getCustomBackendUrl = (): string => {
    return localStorage.getItem(STORAGE_KEY_CUSTOM_URL) || '';
};

export const setCustomBackendUrl = (url: string) => {
    localStorage.setItem(STORAGE_KEY_CUSTOM_URL, url.replace(/\/+$/, ''));
};

export const getBackendUrl = (): string => {
    const mode = getBackendMode();
    let url = DEFAULT_BACKEND_URL;
    switch (mode) {
        case 'local':
            url = 'http://127.0.0.1:8000';
            break;
        case 'lan':
            url = 'http://192.168.254.117:8000';
            break;
        case 'cloud':
            url = getCustomBackendUrl() || DEFAULT_BACKEND_URL;
            break;
        default:
            url = DEFAULT_BACKEND_URL;
    }
    return url.replace(/\/+$/, '');
};
