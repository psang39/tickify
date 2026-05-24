import axios from 'axios';

// Khởi tạo api client
export const api = axios.create({
    baseURL: 'http://localhost:3000/api/v1', // Lưu ý: Ở backend bạn đang dùng port 5000 nhé
    withCredentials: true
});

api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response) {
            const status = error.response.status;
            if (status === 401) {
                console.warn("Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");

                if (!window.location.pathname.includes('/login')) {
                    localStorage.removeItem('tickify_user');
                    window.location.href = '/login';
                }
            }

            if (status === 403) {
                console.error("Bạn không có quyền truy cập vào tài nguyên này!");
            }
        }

        return Promise.reject(error);
    }
);