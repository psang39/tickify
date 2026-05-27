import { apiFetch, apiFetchWithResponse, getSessionCookieFromSetCookie } from './client';
import { AssignedShow, ScannedTicket, StaffUser } from '../types/scanner';

export async function loginStaff(email: string, password: string) {
    const { data, response } = await apiFetchWithResponse<{ token?: string; user: StaffUser }>('/auth/login', {
        auth: false,
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });

    const setCookie = response.headers.get('set-cookie');
    const sessionCookie = getSessionCookieFromSetCookie(setCookie) || (data.token ? `SessionID=${data.token}` : null);

    if (!sessionCookie) {
        throw new Error('Server không trả về SessionID cookie sau khi đăng nhập.');
    }

    return { user: data.user, sessionCookie };
}

export async function logoutStaff() {
    return apiFetch<{ message?: string }>('/auth/logout', {
        method: 'POST',
    });
}

export async function getAssignedShows() {
    return apiFetch<{ docs: AssignedShow[] }>('/staff/my-shows?limit=50');
}

export async function getShowPublicKey(showId: string) {
    return apiFetch<{ data: { public_key: string } }>(`/staff/shows/${showId}/public-key`);
}

export async function onlineCheckIn(showId: string, qrData: string) {
    return apiFetch<{
        message: string;
        status: string;
        ticketInfo?: { ticket_id: string; check_in_time?: string };
    }>(`/staff/shows/${showId}/check-in`, {
        method: 'POST',
        body: JSON.stringify({ qrData, deviceId: 'tickify-scanner-app' }),
    });
}

export async function syncOfflineTickets(showId: string, tickets: ScannedTicket[]) {
    return apiFetch<{
        message: string;
        successCount: number;
        failedCount: number;
        results: Array<{ ticketId: string; success: boolean; reason?: string; check_in_time?: string }>;
    }>(`/staff/shows/${showId}/sync-checkins`, {
        method: 'POST',
        body: JSON.stringify({
            tickets: tickets.map(ticket => ({ ticketId: ticket.ticketId, scannedAt: ticket.scannedAt })),
            deviceId: 'tickify-scanner-app',
        }),
    });
}
