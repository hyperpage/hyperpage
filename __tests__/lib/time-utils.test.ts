import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTimeAgo, findTimestamp, sortDataByTime } from '../../lib/time-utils';

// Mock Date.now to ensure consistent test results
const mockNow = new Date('2025-01-15T10:00:00Z').getTime();

describe('getTimeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(mockNow));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "X seconds ago" for recent timestamps', () => {
    const recentDate = new Date(mockNow - 45 * 1000); // 45 seconds ago
    expect(getTimeAgo(recentDate)).toBe('45 seconds ago');
  });

  it('returns "X minutes ago" for timestamps within an hour', () => {
    const minutesAgo = new Date(mockNow - 23 * 60 * 1000); // 23 minutes ago
    expect(getTimeAgo(minutesAgo)).toBe('23 minutes ago');
  });

  it('returns "X hours ago" for timestamps within a day', () => {
    const hoursAgo = new Date(mockNow - 5 * 60 * 60 * 1000); // 5 hours ago
    expect(getTimeAgo(hoursAgo)).toBe('5 hours ago');
  });

  it('returns "X days ago" for timestamps within a week', () => {
    const daysAgo = new Date(mockNow - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    expect(getTimeAgo(daysAgo)).toBe('3 days ago');
  });

  it('returns formatted date for timestamps older than a week', () => {
    const oldDate = new Date(mockNow - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    const result = getTimeAgo(oldDate);
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // Date format
  });
});

describe('findTimestamp', () => {
  it('finds timestamp in updated_at field (GitHub style)', () => {
    const item = { updated_at: '2025-01-15T09:30:00Z' };
    expect(findTimestamp(item)).toBe('2025-01-15T09:30:00Z');
  });

  it('finds timestamp in created_at field (GitLab style)', () => {
    const item = { created_at: '2025-01-15T08:45:00Z' };
    expect(findTimestamp(item)).toBe('2025-01-15T08:45:00Z');
  });

  it('prioritizes GitHub-style fields over alternatives', () => {
    const item = {
      updated_at: '2025-01-15T09:30:00Z',
      updated: '2025-01-14T09:30:00Z'
    };
    expect(findTimestamp(item)).toBe('2025-01-15T09:30:00Z');
  });

  it('returns undefined when no timestamp field is found', () => {
    const item = { title: 'Some item', status: 'open' };
    expect(findTimestamp(item)).toBeUndefined();
  });

  it('ignores non-string timestamp fields', () => {
    const item = {
      updated_at: 1234567890, // number, not string
      title: 'Some item'
    };
    expect(findTimestamp(item)).toBeUndefined();
  });

  it('handles all supported timestamp field names', () => {
    const testFields = [
      'updated_at', 'created_at', 'updated', 'created',
      'timestamp', 'updatedDate', 'createdDate'
    ];

    testFields.forEach(field => {
      const item = { [field]: '2025-01-15T10:00:00Z' };
      expect(findTimestamp(item)).toBe('2025-01-15T10:00:00Z');
    });
  });
});

describe('sortDataByTime', () => {
  it('sorts data with most recent items first', () => {
    const data = [
      { id: 1, updated_at: '2025-01-15T08:00:00Z' }, // oldest
      { id: 2, updated_at: '2025-01-15T10:00:00Z' }, // newest
      { id: 3, updated_at: '2025-01-15T09:00:00Z' }  // middle
    ];

    const sorted = sortDataByTime(data);
    expect(sorted[0].id).toBe(2); // newest first
    expect(sorted[1].id).toBe(3); // middle second
    expect(sorted[2].id).toBe(1); // oldest last
  });

  it('prioritizes items with timestamps over those without', () => {
    const data = [
      { id: 1, title: 'No timestamp' },
      { id: 2, updated_at: '2025-01-15T10:00:00Z' }
    ];

    const sorted = sortDataByTime(data);
    expect(sorted[0].id).toBe(2); // timestamp item first
    expect(sorted[1].id).toBe(1); // no timestamp second
  });

  it('maintains original order for items without timestamps', () => {
    const data = [
      { id: 1, title: 'First without timestamp' },
      { id: 2, title: 'Second without timestamp' }
    ];

    const sorted = sortDataByTime(data);
    expect(sorted[0].id).toBe(1); // maintains original order
    expect(sorted[1].id).toBe(2);
  });

  it('handles different timestamp field names correctly', () => {
    const data = [
      { id: 1, created: '2025-01-15T09:00:00Z' },     // older (Jira style)
      { id: 2, updated_at: '2025-01-15T10:00:00Z' }  // newer (GitHub style)
    ];

    const sorted = sortDataByTime(data);
    expect(sorted[0].id).toBe(2); // newer timestamp first
    expect(sorted[1].id).toBe(1);
  });
});
