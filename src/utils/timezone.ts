/**
 * PST Timezone Utilities
 * 
 * All dates in Capy-Era dashboards should be in PST (America/Los_Angeles)
 * to match Shopify/Meta/Google reporting.
 * 
 * Uses Intl API for correct timezone handling regardless of user's local timezone.
 * 
 * CRITICAL: Do NOT use manual offset math like:
 *   const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
 * This is WRONG and causes bugs when viewed from non-UTC timezones.
 */

export const PST_TIMEZONE = 'America/Los_Angeles';

export interface DateComponents {
  year: number;
  month: number;
  day: number;
  hours: number;
  mins: number;
  secs: number;
}

/**
 * Get date/time components in PST timezone.
 * Works correctly regardless of the user's local timezone.
 */
export function getPSTComponents(date: Date = new Date()): DateComponents {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: PST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
  
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hours: get('hour'),
    mins: get('minute'),
    secs: get('second'),
  };
}

/**
 * Get date in PST as YYYY-MM-DD string.
 */
export function getPSTDateString(date: Date = new Date()): string {
  const { year, month, day } = getPSTComponents(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Get a Date object whose local components match current PST time.
 * Used for display and comparison purposes.
 */
export function getNowPST(): Date {
  const { year, month, day, hours, mins, secs } = getPSTComponents();
  return new Date(year, month - 1, day, hours, mins, secs);
}

/**
 * Get start of today in PST.
 */
export function getTodayPST(): Date {
  const { year, month, day } = getPSTComponents();
  return new Date(year, month - 1, day, 0, 0, 0);
}

/**
 * Get yesterday's date range in PST.
 * Returns start (00:00:00) and end (23:59:59) of yesterday.
 */
export function getYesterdayPST(): { start: Date; end: Date } {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const { year, month, day } = getPSTComponents(yesterday);
  
  const start = new Date(year, month - 1, day, 0, 0, 0);
  const end = new Date(year, month - 1, day, 23, 59, 59);
  
  return { start, end };
}

/**
 * Format a date for Shopify API with PST timezone offset (-08:00).
 * The date object's local components should represent the PST time.
 */
export function formatDateForShopify(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  const secs = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${mins}:${secs}-08:00`;
}

/**
 * Format a date for display, always showing PST timezone.
 */
export function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric',
    timeZone: PST_TIMEZONE,
  });
}

/**
 * Debug helper: shows what dates will be queried.
 * Use this to verify timezone handling is correct.
 */
export function debugDateRange(start: Date, end: Date): string {
  const startShopify = formatDateForShopify(start);
  const endShopify = formatDateForShopify(end);
  return `Querying: ${startShopify} to ${endShopify}`;
}
