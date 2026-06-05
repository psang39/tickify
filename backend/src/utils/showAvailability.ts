export type ShowTimeState = 'cancelled' | 'upcoming' | 'ongoing' | 'past';
export type ShowSaleState = 'coming_soon' | 'on_sale' | 'closed';
export type ShowBookingStatus =
  | 'draft'
  | 'cancelled'
  | 'past'
  | 'ongoing'
  | 'coming_soon'
  | 'closed'
  | 'on_sale';

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
};

const secondsUntil = (date: Date | null, now: Date): number | null => {
  if (!date) return null;
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 1000));
};

export const computeShowAvailability = (show: any, now: Date = new Date()) => {
  const status = show?.status;
  const saleStart = toDate(show?.sale_start);
  const saleEnd = toDate(show?.sale_end);
  const startTime = toDate(show?.start_time);
  const endTime = toDate(show?.end_time);

  let time_state: ShowTimeState;
  if (status === 'cancelled') time_state = 'cancelled';
  else if (startTime && now < startTime) time_state = 'upcoming';
  else if (startTime && endTime && now >= startTime && now <= endTime) time_state = 'ongoing';
  else time_state = 'past';

  let sale_state: ShowSaleState;
  if (status === 'cancelled') sale_state = 'closed';
  else if (saleStart && now < saleStart) sale_state = 'coming_soon';
  else if (saleEnd && now <= saleEnd) sale_state = 'on_sale';
  else sale_state = 'closed';

  let booking_status: ShowBookingStatus = 'on_sale';
  let booking_message = 'Show đang mở bán. Bạn có thể chọn ghế và đặt vé.';

  if (status !== 'published') {
    booking_status = status === 'cancelled' ? 'cancelled' : 'draft';
    booking_message = status === 'cancelled'
      ? 'Show diễn này đã bị hủy, hệ thống không nhận đặt vé mới.'
      : 'Show diễn này chưa được công khai mở bán.';
  } else if (time_state === 'past') {
    booking_status = 'past';
    booking_message = 'Show diễn đã kết thúc, hệ thống không nhận đặt vé mới.';
  } else if (time_state === 'ongoing') {
    booking_status = 'ongoing';
    booking_message = 'Show diễn đang diễn ra, hệ thống đã đóng đặt vé.';
  } else if (sale_state === 'coming_soon') {
    booking_status = 'coming_soon';
    booking_message = 'Chưa tới thời gian mở bán vé. Vui lòng quay lại khi cổng bán vé mở.';
  } else if (sale_state === 'closed') {
    booking_status = 'closed';
    booking_message = 'Thời gian mở bán vé đã kết thúc.';
  }

  const is_bookable = status === 'published' && time_state === 'upcoming' && sale_state === 'on_sale';

  return {
    time_state,
    sale_state,
    booking_status,
    booking_message,
    is_bookable,
    server_time: now.toISOString(),
    seconds_until_sale_start: secondsUntil(saleStart, now),
    seconds_until_sale_end: secondsUntil(saleEnd, now),
    seconds_until_show_start: secondsUntil(startTime, now),
  };
};

export const attachShowAvailability = <T extends Record<string, any>>(show: T): T & ReturnType<typeof computeShowAvailability> => {
  const plainShow = typeof (show as any)?.toObject === 'function'
    ? (show as any).toObject({ virtuals: true })
    : show;

  return {
    ...plainShow,
    ...computeShowAvailability(plainShow),
  };
};
