import { create } from 'zustand';
import { api } from '@/lib/axiosClient';

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

    fetchEvents: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.get('/events');
            set({ events: response.data, isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    createEvent: async (eventData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await api.post('/events', eventData);
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
