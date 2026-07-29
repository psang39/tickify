const REDIS_UNAVAILABLE_MARKERS = [
    'econnrefused',
    'econnreset',
    'socket closed',
    'socket is closed',
    'client is closed',
    'the client is closed',
    'connection is closed',
    'connect timeout',
    'max retries per request',
];

export const isRedisUnavailableError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error || '');
    const normalizedMessage = message.toLowerCase();
    return REDIS_UNAVAILABLE_MARKERS.some(marker => normalizedMessage.includes(marker));
};
