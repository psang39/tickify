import { create } from 'zustand';
import axios from 'axios';

// Định nghĩa kiểu dữ liệu cho User
interface User {
    id: string;
    first_name: string;
    last_name: string;
    username: string;
    email: string;
    role: 'organizer' | 'attendee' | 'admin';
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (userData: User, token: string) => void;
    logout: () => void;
    checkAuth: () => void; // Hàm này để check xem có token trong localStorage không khi f5 trang
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true, // Mặc định là true để chờ checkAuth chạy xong lúc mới load web

    // Hàm gọi khi API Login trả về thành công
    login: (userData, token) => {
        localStorage.setItem('tickify_token', token); // Lưu token vào trình duyệt
        localStorage.setItem('tickify_user', JSON.stringify(userData));
        set({ user: userData, isAuthenticated: true, isLoading: false });
    },

    // Hàm gọi khi nhấn Đăng xuất
    logout: () => {
        localStorage.removeItem('tickify_token');
        localStorage.removeItem('tickify_user');
        set({ user: null, isAuthenticated: false, isLoading: false });
    },

    // Hàm gọi 1 lần duy nhất ở App.tsx để giữ trạng thái đăng nhập khi người dùng F5/Reload trang
    checkAuth: () => {
        const token = localStorage.getItem('tickify_token');
        const userStr = localStorage.getItem('tickify_user');

        if (token && userStr) {
            set({ user: JSON.parse(userStr), isAuthenticated: true, isLoading: false });
        } else {
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    }
}));