import axios from 'axios';

const normalizeApiUrl = (url: string) => url.trim().replace(/\/$/, '');

const resolveApiBaseUrl = () => {
    const envApiUrl = import.meta.env.VITE_API_URL;
    if (envApiUrl) {
        return normalizeApiUrl(envApiUrl);
    }

    // Production fallback: frontend and backend are served on the same domain
    // through Nginx, so API calls should go to https://tickify.tech/api/v1.
    if (typeof window !== 'undefined') {
        const { protocol, hostname, origin } = window.location;
        const isLocalhost = ['localhost', '127.0.0.1'].includes(hostname);

        if (!isLocalhost && protocol.startsWith('http')) {
            return `${origin}/api/v1`;
        }
    }

    return 'http://localhost:3000/api/v1';
};

export const API_BASE_URL = resolveApiBaseUrl();

export const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    timeout: 15000,
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('tickify_user');
        }

        if (error.response?.status === 403) {
            console.error('Bạn không có quyền truy cập vào tài nguyên này!');
        }

        return Promise.reject(error);
    }
);
