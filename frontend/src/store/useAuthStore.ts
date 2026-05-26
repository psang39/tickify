import { create } from 'zustand';
import { api } from '@/lib/axiosClient';

interface User {
    id: string;
    first_name: string;
    last_name: string;
    username: string;
    email: string;
    role: 'Organizer' | 'Attendee' | 'Admin' | 'organizer' | 'attendee' | 'admin';
    is_verified?: boolean;
    company_name?: string;
    tax_id?: string;
    phone?: string;
    created_at?: string;
    updated_at?: string;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (userData: User) => void;
    logout: () => void;
    checkAuth: () => Promise<void>;
}

const getSavedUser = () => {
    try {
        const rawUser = localStorage.getItem('tickify_user');
        return rawUser ? JSON.parse(rawUser) : null;
    } catch {
        localStorage.removeItem('tickify_user');
        return null;
    }
};

const savedUser = getSavedUser();

export const useAuthStore = create<AuthState>((set) => ({
    user: savedUser,
    isAuthenticated: Boolean(savedUser),
    isLoading: false,

    login: (userData) => {
        localStorage.setItem('tickify_user', JSON.stringify(userData));
        set({ user: userData, isAuthenticated: true, isLoading: false });
    },

    logout: async () => {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.error('Lỗi gửi yêu cầu logout lên server:', error);
        } finally {
            localStorage.removeItem('tickify_user');
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },

    checkAuth: async () => {
        const currentUser = getSavedUser();

        if (!currentUser) {
            set({ user: null, isAuthenticated: false, isLoading: false });
            return;
        }

        set({ isLoading: true });

        try {
            const res = await api.get('/user/profile');
            const userData = res.data?.user || res.data?.data || res.data;

            if (userData && (userData.email || userData.role)) {
                localStorage.setItem('tickify_user', JSON.stringify(userData));
                set({ user: userData, isAuthenticated: true, isLoading: false });
                return;
            }

            throw new Error('Cấu trúc dữ liệu phản hồi không hợp lệ');
        } catch (error) {
            localStorage.removeItem('tickify_user');
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    }
}));
