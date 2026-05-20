import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. Định nghĩa kiểu dữ liệu cho 1 vé đã quét
export interface ScannedTicket {
    ticketId: string;
    scannedAt: string;
}

// 2. Định nghĩa cấu trúc của Store
interface ScannerState {
    offlineTickets: ScannedTicket[];
    addTicket: (ticketId: string) => void;
    removeTicket: (ticketId: string) => void;
    clearAllTickets: () => void;
}

export const useScannerStore = create<ScannerState>()(
    persist(
        (set, get) => ({
            offlineTickets: [],
            addTicket: (ticketId: string) => {
                const currentTickets = get().offlineTickets;
                const isExist = currentTickets.some(t => t.ticketId === ticketId);

                if (!isExist) {
                    set({
                        offlineTickets: [
                            ...currentTickets,
                            { ticketId, scannedAt: new Date().toISOString() }
                        ]
                    });
                }
            },

            removeTicket: (ticketId: string) => {
                set((state) => ({
                    offlineTickets: state.offlineTickets.filter(t => t.ticketId !== ticketId)
                }));
            },

            clearAllTickets: () => {
                set({ offlineTickets: [] });
            },
        }),
        {
            name: 'tickify-scanner-storage', // Tên key lưu trong ổ cứng điện thoại
            storage: createJSONStorage(() => AsyncStorage), // Sử dụng AsyncStorage
        }
    )
);