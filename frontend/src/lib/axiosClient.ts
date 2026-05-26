import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

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
