import { AssignedShow, ShowTimeState } from '../types/scanner';

export function getShowTimeState(show: Pick<AssignedShow, 'start_time' | 'end_time' | 'status'>): ShowTimeState {
    if (show.status === 'cancelled') return 'cancelled';

    const now = new Date().getTime();
    const start = new Date(show.start_time).getTime();
    const end = new Date(show.end_time).getTime();

    if (Number.isNaN(start) || Number.isNaN(end)) return 'upcoming';
    if (now < start) return 'upcoming';
    if (now >= start && now <= end) return 'ongoing';
    return 'past';
}

export function getShowBadgeLabel(state: ShowTimeState) {
    switch (state) {
        case 'ongoing': return 'Đang diễn ra';
        case 'upcoming': return 'Sắp diễn ra';
        case 'past': return 'Đã kết thúc';
        case 'cancelled': return 'Đã hủy';
        default: return 'Không rõ';
    }
}

export function formatDateTime(value: string) {
    return new Date(value).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}
