import axios from 'axios';

// Khởi tạo api client
export const api = axios.create({
    baseURL: 'http://localhost:3000/api/v1', // Lưu ý: Ở backend bạn đang dùng port 5000 nhé
    withCredentials: true
});

// Interceptor tự động đính kèm Token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('tickify_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});