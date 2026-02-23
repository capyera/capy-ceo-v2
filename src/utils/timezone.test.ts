/**
 * Timezone utility tests
 * Run with: npx vitest run src/utils/timezone.test.ts
 * 
 * These tests verify PST calculations work correctly regardless of
 * the local timezone of the machine running the code.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getPSTComponents,
  getPSTDateString,
  getYesterdayPST,
  formatDateForShopify,
} from './timezone';

describe('PST Timezone Utilities', () => {
  describe('getPSTComponents', () => {
    it('correctly converts UTC midnight to PST (previous day)', () => {
      // Feb 11 00:00 UTC = Feb 10 16:00 PST
      const utcMidnight = new Date('2026-02-11T00:00:00Z');
      const components = getPSTComponents(utcMidnight);
      
      expect(components.year).toBe(2026);
      expect(components.month).toBe(2);
      expect(components.day).toBe(10); // Previous day in PST
      expect(components.hours).toBe(16);
    });

    it('correctly converts UTC noon to PST (same day)', () => {
      // Feb 11 20:00 UTC = Feb 11 12:00 PST
      const utcNoon = new Date('2026-02-11T20:00:00Z');
      const components = getPSTComponents(utcNoon);
      
      expect(components.year).toBe(2026);
      expect(components.month).toBe(2);
      expect(components.day).toBe(11);
      expect(components.hours).toBe(12);
    });

    it('handles year boundary correctly', () => {
      // Jan 1 2026 04:00 UTC = Dec 31 2025 20:00 PST
      const newYear = new Date('2026-01-01T04:00:00Z');
      const components = getPSTComponents(newYear);
      
      expect(components.year).toBe(2025);
      expect(components.month).toBe(12);
      expect(components.day).toBe(31);
    });
  });

  describe('getPSTDateString', () => {
    it('returns YYYY-MM-DD format', () => {
      const date = new Date('2026-02-11T20:00:00Z'); // Feb 11 12:00 PST
      const dateStr = getPSTDateString(date);
      
      expect(dateStr).toBe('2026-02-11');
    });

    it('pads single-digit months and days', () => {
      const date = new Date('2026-03-05T20:00:00Z'); // Mar 5 12:00 PST
      const dateStr = getPSTDateString(date);
      
      expect(dateStr).toBe('2026-03-05');
    });
  });

  describe('getYesterdayPST', () => {
    it('returns start at 00:00:00 and end at 23:59:59', () => {
      const { start, end } = getYesterdayPST();
      
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
      
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
    });

    it('start and end are same day', () => {
      const { start, end } = getYesterdayPST();
      
      expect(start.getFullYear()).toBe(end.getFullYear());
      expect(start.getMonth()).toBe(end.getMonth());
      expect(start.getDate()).toBe(end.getDate());
    });
  });

  describe('formatDateForShopify', () => {
    it('formats with -08:00 PST offset', () => {
      const date = new Date(2026, 1, 10, 0, 0, 0); // Feb 10 midnight (local)
      const formatted = formatDateForShopify(date);
      
      expect(formatted).toBe('2026-02-10T00:00:00-08:00');
    });

    it('pads all components correctly', () => {
      const date = new Date(2026, 0, 5, 8, 5, 3); // Jan 5, 08:05:03
      const formatted = formatDateForShopify(date);
      
      expect(formatted).toBe('2026-01-05T08:05:03-08:00');
    });
  });

  describe('Integration: Korea timezone simulation', () => {
    // This test simulates what happens when someone in Korea (UTC+9)
    // views the dashboard. The bug was that dates were ~17 hours off.
    
    it('Feb 12 05:19 KST should give yesterday as Feb 10 PST', () => {
      // Feb 12 05:19 KST = Feb 11 20:19 UTC = Feb 11 12:19 PST
      // So "yesterday" in PST should be Feb 10
      const koreaTime = new Date('2026-02-11T20:19:00Z'); // This is Feb 12 05:19 KST
      
      // Get yesterday relative to this timestamp
      const yesterday = new Date(koreaTime.getTime() - 24 * 60 * 60 * 1000);
      const { year, month, day } = getPSTComponents(yesterday);
      
      expect(year).toBe(2026);
      expect(month).toBe(2);
      expect(day).toBe(10); // Feb 10, not Feb 9 or Feb 11!
    });
  });
});
