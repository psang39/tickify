import { create } from 'zustand';
import axios from 'axios';
import { api } from '@/lib/axiosClient';


interface User {
    id: string;
    first_name: string;
    last_name: string;
    username: string;
    email: string;
    role: 'Organizer' | 'Attendee' | 'Admin';
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (userData: User) => void;
    logout: () => void;
    checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,



    login: (userData) => {
        localStorage.setItem('tickify_user', JSON.stringify(userData));
        set({ user: userData, isAuthenticated: true, isLoading: false });
    },



    logout: async () => {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.error("Lỗi gửi yêu cầu logout lên server:", error);
        } finally {
            localStorage.removeItem('tickify_user');
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },


    checkAuth: async () => {
        try {
            const res = await api.get('/user/profile');

            const userData = res.data?.user || res.data?.data || res.data;

            if (userData && (userData.email || userData.role)) {
                set({ user: userData, isAuthenticated: true, isLoading: false });
                console.log("Thông tin người dùng đã được cập nhật từ server:", userData);
                localStorage.setItem('tickify_user', JSON.stringify(userData));
            } else {
                throw new Error("Cấu trúc dữ liệu phản hồi không hợp lệ");
            }
        } catch (error) {
            console.error("Lỗi xác thực checkAuth:", error);
            localStorage.removeItem('tickify_user');
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    }
}));