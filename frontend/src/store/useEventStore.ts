import { create } from 'zustand';
import axios from 'axios';

// Định nghĩa API base URL (thay bằng URL backend của bạn)
const api = axios.create({
    baseURL: 'http://localhost:3000/api', // Ví dụ backend chạy port 5000
    withCredentials: true // Nếu bạn dùng cookie/session
});
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('tickify_token'); // Thò tay vào kho lấy token
    if (token) {
        config.headers.Authorization = `Bearer ${token}`; // Đính kèm vào header
    }
    return config;
});
interface EventState {
    events: any[];
    isLoading: boolean;
    error: string | null;
    fetchEvents: () => Promise<void>;
    createEvent: (eventData: any) => Promise<boolean>;
}

export const useEventStore = create<EventState>((set) => ({
    events: [],
    isLoading: false,
    error: null,

    // Hàm LẤY dữ liệu thực tế từ Backend
    fetchEvents: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get('/events'); // Tùy chỉnh endpoint của bạn
            set({ events: response.data, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    // Hàm GỬI form tạo Event lên Backend
    createEvent: async (eventData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post('/events', eventData);
            // Cập nhật lại state sau khi tạo thành công
            set((state) => ({
                events: [response.data, ...state.events],
                isLoading: false
            }));
            return true;
        } catch (error: any) {
            set({ error: error.response?.data?.message || 'Lỗi tạo sự kiện', isLoading: false });
            return false;
        }
    }
}));