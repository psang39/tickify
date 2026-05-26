import axios from 'axios';

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true
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