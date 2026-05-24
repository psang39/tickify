import { create } from 'zustand';

type FeedbackType = 'success' | 'error';

interface FeedbackState {
    type: FeedbackType | null;
    message: string | null;
    showSuccess: (message: string) => void;
    showError: (message: string) => void;
    closeFeedback: () => void;
}

export const useFeedbackStore = create<FeedbackState>((set) => ({
    type: null,
    message: null,
    showSuccess: (message) => set({ type: 'success', message }),
    showError: (message) => set({ type: 'error', message }),
    closeFeedback: () => set({ type: null, message: null })
}));
