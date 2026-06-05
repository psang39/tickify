export type FrontendShowAvailability = {
  timeState: 'cancelled' | 'upcoming' | 'ongoing' | 'past';
  saleState: 'coming_soon' | 'on_sale' | 'closed';
  bookingStatus: string;
  isBookable: boolean;
  label: string;
  buttonLabel: string;
  message: string;
};

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

const computeSaleState = (show: any, now: Date) => {
  if (show?.status === 'cancelled') return 'closed' as const;
  const saleStart = toDate(show?.sale_start);
  const saleEnd = toDate(show?.sale_end);
  if (saleStart && now < saleStart) return 'coming_soon' as const;
  if (saleEnd && now <= saleEnd) return 'on_sale' as const;
  return 'closed' as const;
};

export const getShowAvailability = (show: any): FrontendShowAvailability => {
  const now = new Date();
  const timeState = show?.time_state || computeTimeState(show, now);
  const saleState = show?.sale_state || computeSaleState(show, now);
  const backendBookable = typeof show?.is_bookable === 'boolean' ? show.is_bookable : undefined;
  const isBookable = backendBookable ?? (show?.status === 'published' && timeState === 'upcoming' && saleState === 'on_sale');
  const bookingStatus = show?.booking_status || (() => {
    if (show?.status !== 'published') return show?.status === 'cancelled' ? 'cancelled' : 'draft';
    if (timeState === 'past') return 'past';
    if (timeState === 'ongoing') return 'ongoing';
    if (saleState === 'coming_soon') return 'coming_soon';
    if (saleState === 'closed') return 'closed';
    return 'on_sale';
  })();

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
    coming_soon: 'Sắp mở bán',
    closed: 'Hết giờ bán vé',
    on_sale: 'Xem vé',
  };

  return {
    timeState,
    saleState,
    bookingStatus,
    isBookable,
    label: labelMap[bookingStatus] || 'Chưa thể đặt vé',
    buttonLabel: buttonMap[bookingStatus] || 'Chưa thể đặt vé',
    message: show?.booking_message || messageMap[bookingStatus] || 'Show hiện chưa thể đặt vé.',
  };
};
