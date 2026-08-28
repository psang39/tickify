export type ServerClockAnchor = {
  serverEpochMs: number;
  clientMonotonicMs: number;
};

export const monotonicNow = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
};

export const createServerClockAnchor = (
  serverTime: unknown,
  requestStartedAtMs: number,
  responseReceivedAtMs: number,
): ServerClockAnchor | null => {
  if (!serverTime) return null;

  const parsedServerTimeMs = new Date(serverTime as string).getTime();
  if (Number.isNaN(parsedServerTimeMs)) return null;

  const safeRequestStartedAtMs = Number.isFinite(requestStartedAtMs)
    ? requestStartedAtMs
    : responseReceivedAtMs;
  const roundTripMs = Math.max(0, responseReceivedAtMs - safeRequestStartedAtMs);

  return {
    // server_time is produced immediately before the response is sent. Half
    // the measured round trip is a practical estimate of transit time.
    serverEpochMs: parsedServerTimeMs + roundTripMs / 2,
    clientMonotonicMs: responseReceivedAtMs,
  };
};

export const estimatedServerNowMs = (
  anchor?: ServerClockAnchor | null,
  currentMonotonicMs: number = monotonicNow(),
): number => {
  if (!anchor) return Date.now();

  return anchor.serverEpochMs + Math.max(0, currentMonotonicMs - anchor.clientMonotonicMs);
};

export const createMonotonicDeadline = (
  remainingMs: number,
  currentMonotonicMs: number = monotonicNow(),
): number => currentMonotonicMs + Math.max(0, remainingMs);

export const remainingUntilDeadlineMs = (
  deadlineMs: number,
  currentMonotonicMs: number = monotonicNow(),
): number => Math.max(0, deadlineMs - currentMonotonicMs);
