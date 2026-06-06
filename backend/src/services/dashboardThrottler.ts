import redisClient from '../utils/redisClient';

const activeThrottlers = new Map<string, NodeJS.Timeout>();

const toNumber = (value: unknown) => {
  const normalized = Array.isArray(value) ? value[1] : value;
  const num = Number(normalized || 0);
  return Number.isFinite(num) ? num : 0;
};

const normalizeRedisValue = (value: unknown) => {
  return Array.isArray(value) ? value[1] : value;
};

const buildKeys = (eventId: string, showId: string) => ({
  holdingSetKey: `event:${eventId}:show:${showId}:holding_seats`,
  soldCountKey: `event:${eventId}:show:${showId}:sold_count`,
  revenueKey: `event:${eventId}:show:${showId}:total_revenue`,
  statusHashKey: `show:${showId}:seat_status`,
});

const countAndRepairActiveHolders = async (eventId: string, showId: string) => {
  const { holdingSetKey, statusHashKey } = buildKeys(eventId, showId);
  const seatIds = await redisClient.sMembers(holdingSetKey);

  if (!seatIds.length) {
    return {
      holdingSeatCount: 0,
      holdingUserCount: 0,
      staleHoldingSeatCount: 0,
    };
  }

  const pipeline = redisClient.multi();
  for (const seatId of seatIds) {
    pipeline.get(`event:${eventId}:show:${showId}:seat:${seatId}:lock`);
    pipeline.hGet(statusHashKey, seatId);
  }

  const results = await pipeline.exec();
  const activeUserIds = new Set<string>();
  const staleSeatIds: string[] = [];
  const staleHoldingStatusSeatIds: string[] = [];
  const repairHoldingStatusSeatIds: string[] = [];

  for (let i = 0; i < seatIds.length; i += 1) {
    const seatId = seatIds[i];
    const lockOwner = normalizeRedisValue(results?.[i * 2]);
    const seatStatus = normalizeRedisValue(results?.[i * 2 + 1]);

    if (lockOwner) {
      activeUserIds.add(String(lockOwner));
      if (seatStatus !== 'holding') repairHoldingStatusSeatIds.push(seatId);
      continue;
    }

    staleSeatIds.push(seatId);
    if (seatStatus === 'holding') staleHoldingStatusSeatIds.push(seatId);
  }

  if (staleSeatIds.length || staleHoldingStatusSeatIds.length || repairHoldingStatusSeatIds.length) {
    const cleanup = redisClient.multi();

    for (const seatId of staleSeatIds) {
      cleanup.sRem(holdingSetKey, seatId);
    }

    for (const seatId of staleHoldingStatusSeatIds) {
      cleanup.hDel(statusHashKey, seatId);
    }

    for (const seatId of repairHoldingStatusSeatIds) {
      cleanup.hSet(statusHashKey, seatId, 'holding');
    }

    await cleanup.exec();
  }

  return {
    holdingSeatCount: seatIds.length - staleSeatIds.length,
    holdingUserCount: activeUserIds.size,
    staleHoldingSeatCount: staleSeatIds.length,
  };
};

export const startAdminDashboardThrottler = (event_id: string, show_id: string) => {
  if (activeThrottlers.has(show_id)) return;

  const { soldCountKey, revenueKey } = buildKeys(event_id, show_id);
  const ADMIN_CHANNEL = `SHOW_${show_id}_ADMIN_DASHBOARD`;

  const intervalId = setInterval(async () => {
    try {
      const [{ holdingSeatCount, holdingUserCount, staleHoldingSeatCount }, soldCount, totalRevenue] = await Promise.all([
        countAndRepairActiveHolders(event_id, show_id),
        redisClient.get(soldCountKey),
        redisClient.get(revenueKey),
      ]);

      const dashboardData = {
        timestamp: new Date().toISOString(),
        holdingCount: holdingUserCount,
        holdingUserCount,
        holdingSeatCount,
        staleHoldingSeatCount,
        soldCount: toNumber(soldCount),
        totalRevenue: toNumber(totalRevenue),
      };

      await redisClient.publish(ADMIN_CHANNEL, JSON.stringify(dashboardData));
    } catch (error) {
      console.error(`[Dashboard Throttler] Lỗi sync show ${show_id}:`, error);
    }
  }, 2000);

  activeThrottlers.set(show_id, intervalId);
};

export const stopAdminDashboardThrottler = (show_id: string) => {
  const intervalId = activeThrottlers.get(show_id);
  if (!intervalId) return;
  clearInterval(intervalId);
  activeThrottlers.delete(show_id);
};
