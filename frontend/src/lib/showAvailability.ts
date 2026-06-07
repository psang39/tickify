export type FrontendShowAvailability = {
  timeState: 'cancelled' | 'upcoming' | 'ongoing' | 'past';
  saleState: 'coming_soon' | 'on_sale' | 'closed';
  bookingStatus: string;
  isBookable: boolean;
  canEnterWaitingRoom: boolean;
  isWaitingRoomOpen: boolean;
  waitingRoomOpensAt?: string;
  secondsUntilWaitingRoomOpen?: number | null;
  label: string;
  buttonLabel: string;
  message: string;
};

const WAITING_ROOM_OPEN_BEFORE_MS = 30 * 60 * 1000;

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
};

const computeTimeState = (show: any, now: Date) => {
  if (show?.status === 'cancelled') return 'cancelled' as const;
  const start = toDate(show?.start_time);
  const end = toDate(show?.end_time);
  if (start && now < start) return 'upcoming' as const;
  if (start && end && now >= start && now <= end) return 'ongoing' as const;
  return 'past' as const;
};

const computeSaleState = (show: any, now: Date, timeState?: FrontendShowAvailability['timeState']) => {
  const normalizedTimeState = timeState || computeTimeState(show, now);
  if (show?.status === 'cancelled' || normalizedTimeState === 'past' || normalizedTimeState === 'ongoing') return 'closed' as const;
  const saleStart = toDate(show?.sale_start);
  const saleEnd = toDate(show?.sale_end);
  if (saleStart && now < saleStart) return 'coming_soon' as const;
  if (saleStart && saleEnd && now >= saleStart && now <= saleEnd) return 'on_sale' as const;
  if (!saleStart && saleEnd && now <= saleEnd) return 'on_sale' as const;
  return 'closed' as const;
};

const computeBookingStatus = (
  show: any,
  timeState: FrontendShowAvailability['timeState'],
  saleState: FrontendShowAvailability['saleState']
) => {
  if (show?.status !== 'published') return show?.status === 'cancelled' ? 'cancelled' : 'draft';
  if (timeState === 'past') return 'past';
  if (timeState === 'ongoing') return 'ongoing';
  if (saleState === 'coming_soon') return 'coming_soon';
  if (saleState === 'closed') return 'closed';
  return 'on_sale';
};

export const getShowAvailability = (show: any, now: Date = new Date()): FrontendShowAvailability => {
  // Không dùng trực tiếp time_state/sale_state/booking_status từ API vì các field này là snapshot
  // tại thời điểm fetch. Trang EventDetail cần tự đổi trạng thái khi đến giờ mở phòng chờ/mở bán.
  const timeState = computeTimeState(show, now);
  const saleState = computeSaleState(show, now, timeState);
  const saleStart = toDate(show?.sale_start);
  const saleEnd = toDate(show?.sale_end);
  const waitingRoomOpenTime = saleStart ? new Date(saleStart.getTime() - WAITING_ROOM_OPEN_BEFORE_MS) : null;

  const isBookable = show?.status === 'published' && timeState === 'upcoming' && saleState === 'on_sale';
  const isWaitingRoomOpen = Boolean(
    show?.status === 'published' &&
    timeState === 'upcoming' &&
    saleStart &&
    waitingRoomOpenTime &&
    now >= waitingRoomOpenTime &&
    (!saleEnd || now <= saleEnd)
  );
  const canEnterWaitingRoom = isWaitingRoomOpen || isBookable;
  const bookingStatus = computeBookingStatus(show, timeState, saleState);

  const messageMap: Record<string, string> = {
    draft: 'Show diễn này chưa được công khai mở bán.',
    cancelled: 'Show diễn này đã bị hủy, hệ thống không nhận đặt vé mới.',
    past: 'Show diễn đã kết thúc, hệ thống không nhận đặt vé mới.',
    ongoing: 'Show diễn đang diễn ra, hệ thống đã đóng đặt vé.',
    coming_soon: 'Chưa tới thời gian mở bán vé. Vui lòng quay lại khi cổng bán vé mở.',
    closed: 'Thời gian mở bán vé đã kết thúc.',
    on_sale: 'Show đang mở bán. Bạn có thể chọn ghế và đặt vé.',
  };

  const labelMap: Record<string, string> = {
    draft: 'Chưa công bố',
    cancelled: 'Đã hủy',
    past: 'Đã kết thúc',
    ongoing: 'Đang diễn ra',
    coming_soon: 'Sắp mở bán',
    closed: 'Đã đóng bán',
    on_sale: 'Đang mở bán',
  };

  const buttonMap: Record<string, string> = {
    draft: 'Chưa mở',
    cancelled: 'Đã hủy',
    past: 'Đã kết thúc',
    ongoing: 'Đã đóng đặt vé',
    coming_soon: isWaitingRoomOpen ? 'Vào phòng chờ' : 'Sắp mở phòng chờ',
    closed: 'Hết giờ bán vé',
    on_sale: 'Đặt vé',
  };

  return {
    timeState,
    saleState,
    bookingStatus,
    isBookable,
    canEnterWaitingRoom,
    isWaitingRoomOpen,
    waitingRoomOpensAt: waitingRoomOpenTime?.toISOString(),
    secondsUntilWaitingRoomOpen: waitingRoomOpenTime ? Math.max(0, Math.ceil((waitingRoomOpenTime.getTime() - now.getTime()) / 1000)) : null,
    label: isWaitingRoomOpen && bookingStatus === 'coming_soon' ? 'Phòng chờ đã mở' : labelMap[bookingStatus] || 'Chưa thể đặt vé',
    buttonLabel: buttonMap[bookingStatus] || 'Chưa thể đặt vé',
    message: isWaitingRoomOpen && bookingStatus === 'coming_soon'
      ? 'Phòng chờ đã mở. Bạn có thể vào trước giờ bán vé để được xếp lượt ngẫu nhiên.'
      : messageMap[bookingStatus] || 'Show hiện chưa thể đặt vé.',
  };
};
