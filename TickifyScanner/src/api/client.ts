import { useScannerStore } from '../stores/useScannerStore';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.5:3000/api/v1';

type ApiOptions = RequestInit & { auth?: boolean };

type JsonResponse<T> = {
    data: T;
    response: Response;
};

export function getSessionCookieFromSetCookie(setCookieHeader: string | null): string | null {
    if (!setCookieHeader) return null;

    const sessionCookie = setCookieHeader
        .split(/,(?=\s*SessionID=)/)
        .map(cookie => cookie.trim())
        .find(cookie => cookie.startsWith('SessionID='));

    if (!sessionCookie) return null;
    return sessionCookie.split(';')[0];
}

async function requestJson<T>(path: string, options: ApiOptions = {}): Promise<JsonResponse<T>> {
    const sessionCookie = useScannerStore.getState().sessionCookie;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };

    if (options.auth !== false && sessionCookie) {
        // Backend xác thực bằng req.cookies.SessionID, không dùng Authorization Bearer nữa.
        headers.Cookie = sessionCookie;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
        credentials: 'include',
    });

    const text = await response.text();
    let data: any = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = { message: text };
    }

    if (!response.ok) {
        const message = data?.message || data?.error || 'Không thể kết nối tới server';
        throw new Error(message);
    }

    return { data: data as T, response };
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
    const { data } = await requestJson<T>(path, options);
    return data;
}

export async function apiFetchWithResponse<T>(path: string, options: ApiOptions = {}): Promise<JsonResponse<T>> {
    return requestJson<T>(path, options);
}
