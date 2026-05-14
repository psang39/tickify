import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axiosClient';

// 1. HOOK LẤY DANH SÁCH (Thay cho fetchEvents)
export const useOrganizerEvents = (page = 1, limit = 10) => {
    return useQuery({
        // Nếu page đổi, TanStack tự động gọi lại API
        queryKey: ['organizer-events', page],
        queryFn: async () => {
            const response = await api.get(`/organizer/events?page=${page}&limit=${limit}`);
            return response.data;
        }
    });
};

// 2. HOOK TẠO SỰ KIỆN MỚI (Thay cho createEvent)
export const useCreateEvent = () => {
    const queryClient = useQueryClient();

    return useMutation({
        // Hàm bắn API
        mutationFn: async (eventData: any) => {
            const response = await api.post('/organizer/events', eventData);
            return response.data;
        },
        // MAGIC CỦA TANSTACK Ở ĐÂY:
        onSuccess: () => {
            // Ngay khi tạo thành công, ra lệnh cho TanStack "vứt bỏ" cache của danh sách cũ
            // TanStack sẽ tự động gọi lại cái API GET phía trên ngầm dưới background 
            // để cập nhật giao diện mà bạn không cần F5!
            queryClient.invalidateQueries({ queryKey: ['organizer-events'] });
        },
        onError: (error: any) => {
            alert(error.response?.data?.message || 'Có lỗi xảy ra khi tạo sự kiện');
        }
    });
};