import { useScannerStore } from '../stores/useScannerStore';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://tickify.tech/api/v1';

type ApiOptions = RequestInit & { auth?: boolean };

export class ApiError extends Error {
    status: number;
    data: any;

    constructor(message: string, status: number, data: any) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

type JsonResponse<T> = {
    data: T;
    response: Response;
};

export function extractJwtFromCookieValue(value?: string | null): string | null {
    if (!value) return null;

    const trimmed = value.trim();

    // Accept a raw JWT, "Bearer <jwt>", "SessionID=<jwt>", or full Set-Cookie value.
    const withoutBearer = trimmed.replace(/^Bearer\s+/i, '').trim();
    const sessionMatch = withoutBearer.match(/(?:^|;|,|\s)SessionID=([^;,\s]+)/i);
    const candidate = sessionMatch ? sessionMatch[1] : withoutBearer;

    const token = candidate.replace(/^SessionID=/i, '').trim();
    return token.split('.').length === 3 ? token : null;
}

export function getSessionTokenFromSetCookie(setCookieHeader: string | null): string | null {
    return extractJwtFromCookieValue(setCookieHeader);
}

async function requestJson<T>(path: string, options: ApiOptions = {}): Promise<JsonResponse<T>> {
    const sessionToken = extractJwtFromCookieValue(useScannerStore.getState().sessionToken);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };

    if (options.auth !== false && sessionToken) {
        // React Native có thể giữ cookie cũ trong native cookie jar.
        // Gửi token sạch bằng cả Cookie và X-Session-Token để backend nhận ổn định.
        headers.Cookie = `SessionID=${sessionToken}`;
        headers['X-Session-Token'] = sessionToken;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
        // Không dùng include để tránh React Native tự gửi cookie SessionID cũ/bẩn.
        credentials: 'omit',
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
        throw new ApiError(message, response.status, data);
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
