import axios from 'axios';

export const api = axios.create({
    baseURL: 'http://localhost:3000/api/v1',
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