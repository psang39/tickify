const VIETNAM_TIMEZONE_OFFSET = '+07:00';
const LOCAL_DATE_TIME_WITHOUT_TIMEZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;

export const parseClientDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = LOCAL_DATE_TIME_WITHOUT_TIMEZONE.test(raw)
    ? `${raw}${VIETNAM_TIMEZONE_OFFSET}`
    : raw;

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};
