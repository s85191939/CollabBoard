import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCursors } from '../../hooks/useCursors';

// Mock Firebase
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockOnSnapshot = vi.fn(() => vi.fn());
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: (...args: unknown[]) => mockQuery(...args),
}));

vi.mock('../../lib/firebase', () => ({
  db: {},
}));

describe('useCursors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty cursors initially', () => {
    const { result } = renderHook(() => useCursors('board-123', 'user-1'));
    expect(result.current.cursors).toEqual([]);
  });

  it('sets up snapshot listener when boardId is provided', () => {
    renderHook(() => useCursors('board-123', 'user-1'));
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it('does not listen when boardId is undefined', () => {
    renderHook(() => useCursors(undefined, 'user-1'));
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useCursors('board-123', 'user-1'));
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('updateCursor calls setDoc with cursor data', () => {
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

    const { result } = renderHook(() => useCursors('board-123', 'user-1'));

    act(() => {
      result.current.updateCursor(100, 200, 'Test User', '#FF6B6B', 'https://photo.url');
    });

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [, data] = mockSetDoc.mock.calls[0];
    expect(data.userId).toBe('user-1');
    expect(data.x).toBe(100);
    expect(data.y).toBe(200);
    expect(data.displayName).toBe('Test User');
    expect(data.color).toBe('#FF6B6B');
  });

  it('updateCursor throttles to max 20 updates per second (50ms)', () => {
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    const { result } = renderHook(() => useCursors('board-123', 'user-1'));

    // First call — should go through
    act(() => {
      result.current.updateCursor(0, 0, 'User', '#fff');
    });
    expect(mockSetDoc).toHaveBeenCalledTimes(1);

    // Second call 10ms later — should be throttled
    vi.setSystemTime(new Date('2024-01-01T00:00:00.010Z'));
    act(() => {
      result.current.updateCursor(10, 10, 'User', '#fff');
    });
    expect(mockSetDoc).toHaveBeenCalledTimes(1); // still 1

    // Third call 60ms later — should go through
    vi.setSystemTime(new Date('2024-01-01T00:00:00.060Z'));
    act(() => {
      result.current.updateCursor(20, 20, 'User', '#fff');
    });
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
  });

  it('updateCursor does nothing when boardId is undefined', () => {
    const { result } = renderHook(() => useCursors(undefined, 'user-1'));

    act(() => {
      result.current.updateCursor(100, 200, 'User', '#fff');
    });

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('updateCursor does nothing when userId is undefined', () => {
    const { result } = renderHook(() => useCursors('board-123', undefined));

    act(() => {
      result.current.updateCursor(100, 200, 'User', '#fff');
    });

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('removeCursor calls deleteDoc', () => {
    const { result } = renderHook(() => useCursors('board-123', 'user-1'));

    act(() => {
      result.current.removeCursor();
    });

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it('removeCursor does nothing when boardId is undefined', () => {
    const { result } = renderHook(() => useCursors(undefined, 'user-1'));

    act(() => {
      result.current.removeCursor();
    });

    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('filters out own cursor from snapshot data', () => {
    let snapshotCallback: (snapshot: unknown) => void;
    mockOnSnapshot.mockImplementation((_, callback: (snapshot: unknown) => void) => {
      snapshotCallback = callback;
      return vi.fn();
    });

    const { result } = renderHook(() => useCursors('board-123', 'user-1'));

    act(() => {
      snapshotCallback({
        docChanges: () => [
          {
            type: 'added',
            doc: {
              id: 'user-1',
              data: () => ({ userId: 'user-1', x: 0, y: 0, displayName: 'Me', color: '#fff', lastUpdated: Date.now() }),
            },
          },
          {
            type: 'added',
            doc: {
              id: 'user-2',
              data: () => ({ userId: 'user-2', x: 100, y: 100, displayName: 'Other', color: '#f00', lastUpdated: Date.now() }),
            },
          },
        ],
      });
    });

    // Should only show user-2, not user-1 (self)
    expect(result.current.cursors).toHaveLength(1);
    expect(result.current.cursors[0].userId).toBe('user-2');
  });

  it('removes stale cursors older than 30 seconds', () => {
    let snapshotCallback: (snapshot: unknown) => void;
    mockOnSnapshot.mockImplementation((_, callback: (snapshot: unknown) => void) => {
      snapshotCallback = callback;
      return vi.fn();
    });

    const now = Date.now();
    const { result } = renderHook(() => useCursors('board-123', 'user-1'));

    act(() => {
      snapshotCallback({
        docChanges: () => [
          {
            type: 'added',
            doc: {
              id: 'user-2',
              data: () => ({ userId: 'user-2', x: 0, y: 0, displayName: 'Fresh', color: '#fff', lastUpdated: now }),
            },
          },
          {
            type: 'added',
            doc: {
              id: 'user-3',
              data: () => ({ userId: 'user-3', x: 0, y: 0, displayName: 'Stale', color: '#fff', lastUpdated: now - 60000 }),
            },
          },
        ],
      });
    });

    // Only user-2 should remain (user-3 is stale)
    expect(result.current.cursors).toHaveLength(1);
    expect(result.current.cursors[0].displayName).toBe('Fresh');
  });
});
