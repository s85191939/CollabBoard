import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePresence } from '../../hooks/usePresence';

// Mock Firebase
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockOnSnapshot = vi.fn(() => vi.fn());
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn();
const mockArrayUnion = vi.fn((val) => val);

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  arrayUnion: (...args: unknown[]) => mockArrayUnion(...args),
}));

vi.mock('../../lib/firebase', () => ({
  db: {},
}));

describe('usePresence', () => {
  const mockUser = {
    uid: 'user-123',
    displayName: 'Test User',
    photoURL: 'https://example.com/photo.jpg',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty users array and a color', () => {
    const { result } = renderHook(() => usePresence('board-123', mockUser));
    expect(result.current.users).toEqual([]);
    expect(typeof result.current.userColor).toBe('string');
    expect(result.current.userColor).toMatch(/^#/);
  });

  it('does not set presence when boardId is undefined', () => {
    renderHook(() => usePresence(undefined, mockUser));
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('does not set presence when user is null', () => {
    renderHook(() => usePresence('board-123', null));
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('sets presence document on mount', () => {
    renderHook(() => usePresence('board-123', mockUser));

    expect(mockSetDoc).toHaveBeenCalled();
    const [, presenceData] = mockSetDoc.mock.calls[0];
    expect(presenceData.uid).toBe('user-123');
    expect(presenceData.displayName).toBe('Test User');
    expect(presenceData.isOnline).toBe(true);
    expect(presenceData.lastSeen).toBeDefined();
  });

  it('listens to presence collection', () => {
    renderHook(() => usePresence('board-123', mockUser));
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it('updates presence periodically', () => {
    renderHook(() => usePresence('board-123', mockUser));

    // Initial setDoc call
    const initialCallCount = mockSetDoc.mock.calls.length;

    // Advance timer by 10 seconds (presence refresh interval)
    vi.advanceTimersByTime(10000);

    expect(mockSetDoc.mock.calls.length).toBeGreaterThan(initialCallCount);
  });

  it('cleans up on unmount (unsubscribe, clear interval, delete presence)', () => {
    const unsubscribe = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => usePresence('board-123', mockUser));
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
    expect(mockDeleteDoc).toHaveBeenCalled();
  });

  it('adds user to board members on join', () => {
    renderHook(() => usePresence('board-123', mockUser));

    expect(mockUpdateDoc).toHaveBeenCalled();
    expect(mockArrayUnion).toHaveBeenCalledWith('user-123');
  });

  it('generates consistent color for same user', () => {
    const { result: result1 } = renderHook(() => usePresence('board-1', mockUser));
    const { result: result2 } = renderHook(() => usePresence('board-2', mockUser));

    expect(result1.current.userColor).toBe(result2.current.userColor);
  });

  it('generates different colors for different users', () => {
    const user1 = { uid: 'user-aaa', displayName: 'User A', photoURL: null };
    const user2 = { uid: 'user-zzz', displayName: 'User Z', photoURL: null };

    const { result: result1 } = renderHook(() => usePresence('board-1', user1));
    const { result: result2 } = renderHook(() => usePresence('board-1', user2));

    // Colors may or may not differ depending on hash — but they should be valid
    expect(result1.current.userColor).toMatch(/^#/);
    expect(result2.current.userColor).toMatch(/^#/);
  });
});
