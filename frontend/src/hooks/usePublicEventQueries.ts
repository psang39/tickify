import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axiosClient';
import { createServerClockAnchor, monotonicNow } from '@/lib/serverClock';

const unwrapApiPayload = (payload: any) => {
    const value = payload?.data || payload?.docs || payload;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch (_error) {
            return value;
        }
    }
    return value;
};

export const usePublicEvents = (params: Record<string, any> = {}) => {
    return useQuery({
        queryKey: ['public-events', params],
        queryFn: async () => {
            const response = await api.get('/events/search', { params });
            return unwrapApiPayload(response.data) || [];
        }
    });
};

export const usePublicEventDetail = (eventId?: string) => {
    return useQuery({
        queryKey: ['public-event-detail', eventId],
        enabled: Boolean(eventId),
        queryFn: async () => {
            const response = await api.get(`/events/${eventId}`);
            return unwrapApiPayload(response.data);
        }
    });
};

export const usePublicEventShows = (eventId?: string, page = 1, limit = 4) => {
    return useQuery({
        queryKey: ['public-event-shows', eventId, page, limit],
        enabled: Boolean(eventId),
        queryFn: async () => {
            const requestStartedAtMs = monotonicNow();
            const response = await api.get(`/events/${eventId}/shows`, {
                params: { page, limit }
            });
            const responseReceivedAtMs = monotonicNow();

            return {
                ...response.data,
                serverClockAnchor: createServerClockAnchor(
                    response.data?.server_time,
                    requestStartedAtMs,
                    responseReceivedAtMs,
                ),
            };
        }
    });
};
