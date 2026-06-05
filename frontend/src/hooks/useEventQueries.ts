import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axiosClient';
import { useFeedbackStore } from '@/store/useFeedbackStore';

export const useOrganizerEvents = (page = 1, limit = 10) => {
    return useQuery({
        queryKey: ['organizer-events', page],
        queryFn: async () => {
            const response = await api.get(`/organizer/events?page=${page}&limit=${limit}`);
            return response.data;
        }
    });
};

export const useCreateEvent = () => {
    const queryClient = useQueryClient();

    return useMutation({
        
        mutationFn: async (eventData: any) => {
            const response = await api.post('/organizer/events', eventData);
            return response.data;
        },
        
        onSuccess: () => {
            
            
            
            queryClient.invalidateQueries({ queryKey: ['organizer-events'] });
        },
        onError: (error: any) => {
            useFeedbackStore.getState().showError(error.response?.data?.message || 'Có lỗi xảy ra khi tạo sự kiện');
        }
    });
};
