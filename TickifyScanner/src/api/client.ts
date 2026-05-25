import { useScannerStore } from '../stores/useScannerStore';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.5:3000/api/v1';

type ApiOptions = RequestInit & { auth?: boolean };

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
    const token = useScannerStore.getState().token;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };

    if (options.auth !== false && token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
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

    return data as T;
}
