import type { Express } from 'express';
import type { Server } from 'node:http';

export interface TestHttpServer {
    baseUrl: string;
    close: () => Promise<void>;
}

export interface JsonResponse<T = any> {
    status: number;
    body: T;
    headers: Headers;
}

export const startTestHttpServer = async (app: Express): Promise<TestHttpServer> => {
    const server = await new Promise<Server>((resolve, reject) => {
        const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
        listeningServer.once('error', reject);
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
        server.close();
        throw new Error('Could not resolve test server address');
    }

    return {
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise<void>((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        }),
    };
};

export const requestJson = async <T = any>(
    baseUrl: string,
    path: string,
    options: RequestInit = {},
): Promise<JsonResponse<T>> => {
    const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            'content-type': 'application/json',
            ...(options.headers || {}),
        },
    });

    const rawBody = await response.text();
    let body: T;
    try {
        body = rawBody ? JSON.parse(rawBody) : {} as T;
    } catch {
        body = rawBody as T;
    }

    return {
        status: response.status,
        body,
        headers: response.headers,
    };
};

export const postJson = <T = any>(
    baseUrl: string,
    path: string,
    body: unknown,
    headers: Record<string, string> = {},
): Promise<JsonResponse<T>> => requestJson<T>(baseUrl, path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
});
