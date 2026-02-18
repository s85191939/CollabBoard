import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBoardObjects } from '../../hooks/useBoardObjects';

// Mock Firebase Firestore
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockWriteBatch = vi.fn(() => ({
  set: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
}));
const mockOnSnapshot = vi.fn(() => vi.fn()); // returns unsubscribe function
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
  query: (...args: unknown[]) => mockQuery(...args),
}));

vi.mock('../../lib/firebase', () => ({
  db: {},
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

describe('useBoardObjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty objects array initially', () => {
    const { result } = renderHook(() => useBoardObjects('board-123'));
    expect(result.current.objects).toEqual([]);
    expect(result.current.objectsMap.size).toBe(0);
  });

  it('sets up Firestore listener when boardId is provided', () => {
    renderHook(() => useBoardObjects('board-123'));
    expect(mockQuery).toHaveBeenCalled();
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it('does not set up listener when boardId is undefined', () => {
    renderHook(() => useBoardObjects(undefined));
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useBoardObjects('board-123'));
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('addObject calls setDoc with correct data', async () => {
    const { result } = renderHook(() => useBoardObjects('board-123'));

    await act(async () => {
      await result.current.addObject(
        { type: 'sticky-note', x: 100, y: 200, text: 'Hello' },
        'user-1'
      );
    });

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [, data] = mockSetDoc.mock.calls[0];
    expect(data.type).toBe('sticky-note');
    expect(data.x).toBe(100);
    expect(data.y).toBe(200);
    expect(data.text).toBe('Hello');
    expect(data.createdBy).toBe('user-1');
    expect(data.id).toBe('test-uuid-1234');
  });

  it('addObject returns null when boardId is undefined', async () => {
    const { result } = renderHook(() => useBoardObjects(undefined));

    let id: string | null = null;
    await act(async () => {
      id = await result.current.addObject(
        { type: 'rectangle', x: 0, y: 0 },
        'user-1'
      );
    });

    expect(id).toBeNull();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('addObject applies defaults for missing fields', async () => {
    const { result } = renderHook(() => useBoardObjects('board-123'));

    await act(async () => {
      await result.current.addObject({ type: 'circle' }, 'user-1');
    });

    const [, data] = mockSetDoc.mock.calls[0];
    expect(data.x).toBe(0);
    expect(data.y).toBe(0);
    expect(data.width).toBe(200);
    expect(data.height).toBe(200);
    expect(data.rotation).toBe(0);
    expect(data.color).toBe('#FFEB3B');
    expect(data.fontSize).toBe(16);
  });

  it('updateObject calls updateDoc with updatedAt timestamp', async () => {
    const { result } = renderHook(() => useBoardObjects('board-123'));

    await act(async () => {
      await result.current.updateObject('obj-1', { x: 300, y: 400 });
    });

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const [, updates] = mockUpdateDoc.mock.calls[0];
    expect(updates.x).toBe(300);
    expect(updates.y).toBe(400);
    expect(updates.updatedAt).toBeDefined();
    expect(typeof updates.updatedAt).toBe('number');
  });

  it('updateObject does nothing when boardId is undefined', async () => {
    const { result } = renderHook(() => useBoardObjects(undefined));

    await act(async () => {
      await result.current.updateObject('obj-1', { x: 100 });
    });

    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('deleteObject calls deleteDoc', async () => {
    const { result } = renderHook(() => useBoardObjects('board-123'));

    await act(async () => {
      await result.current.deleteObject('obj-1');
    });

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it('deleteObject does nothing when boardId is undefined', async () => {
    const { result } = renderHook(() => useBoardObjects(undefined));

    await act(async () => {
      await result.current.deleteObject('obj-1');
    });

    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('deleteObjects uses batch for multiple deletions', async () => {
    const batchDelete = vi.fn();
    const batchCommit = vi.fn().mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({
      set: vi.fn(),
      delete: batchDelete,
      commit: batchCommit,
    });

    const { result } = renderHook(() => useBoardObjects('board-123'));

    await act(async () => {
      await result.current.deleteObjects(['obj-1', 'obj-2', 'obj-3']);
    });

    expect(batchDelete).toHaveBeenCalledTimes(3);
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  it('addObjects uses batch for multiple creations', async () => {
    const batchSet = vi.fn();
    const batchCommit = vi.fn().mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({
      set: batchSet,
      delete: vi.fn(),
      commit: batchCommit,
    });

    const { result } = renderHook(() => useBoardObjects('board-123'));

    let ids: string[] = [];
    await act(async () => {
      ids = await result.current.addObjects(
        [
          { type: 'sticky-note', text: 'Note 1' },
          { type: 'rectangle', color: '#FF0000' },
        ],
        'user-1'
      );
    });

    expect(batchSet).toHaveBeenCalledTimes(2);
    expect(batchCommit).toHaveBeenCalledTimes(1);
    expect(ids).toHaveLength(2);
  });

  it('addObjects returns empty array when boardId is undefined', async () => {
    const { result } = renderHook(() => useBoardObjects(undefined));

    let ids: string[] = [];
    await act(async () => {
      ids = await result.current.addObjects(
        [{ type: 'sticky-note' }],
        'user-1'
      );
    });

    expect(ids).toEqual([]);
  });

  it('processes snapshot changes correctly', () => {
    // Capture the snapshot callback
    let snapshotCallback: (snapshot: unknown) => void;
    mockOnSnapshot.mockImplementation((_, callback: (snapshot: unknown) => void) => {
      snapshotCallback = callback;
      return vi.fn();
    });

    const { result } = renderHook(() => useBoardObjects('board-123'));

    // Simulate Firestore snapshot with added documents
    act(() => {
      snapshotCallback({
        docChanges: () => [
          {
            type: 'added',
            doc: {
              id: 'obj-1',
              data: () => ({ type: 'sticky-note', x: 0, y: 0, text: 'Test' }),
            },
          },
        ],
      });
    });

    expect(result.current.objects).toHaveLength(1);
    expect(result.current.objects[0].id).toBe('obj-1');
    expect(result.current.objects[0].type).toBe('sticky-note');
  });

  it('handles removed documents in snapshot', () => {
    let snapshotCallback: (snapshot: unknown) => void;
    mockOnSnapshot.mockImplementation((_, callback: (snapshot: unknown) => void) => {
      snapshotCallback = callback;
      return vi.fn();
    });

    const { result } = renderHook(() => useBoardObjects('board-123'));

    // Add an object first
    act(() => {
      snapshotCallback({
        docChanges: () => [
          {
            type: 'added',
            doc: {
              id: 'obj-1',
              data: () => ({ type: 'rectangle', x: 0, y: 0 }),
            },
          },
        ],
      });
    });

    expect(result.current.objects).toHaveLength(1);

    // Remove the object
    act(() => {
      snapshotCallback({
        docChanges: () => [
          {
            type: 'removed',
            doc: {
              id: 'obj-1',
              data: () => ({}),
            },
          },
        ],
      });
    });

    expect(result.current.objects).toHaveLength(0);
  });

  it('addObject includes points when provided (for lines)', async () => {
    const { result } = renderHook(() => useBoardObjects('board-123'));

    await act(async () => {
      await result.current.addObject(
        { type: 'line', points: [0, 0, 200, 100] },
        'user-1'
      );
    });

    const [, data] = mockSetDoc.mock.calls[0];
    expect(data.points).toEqual([0, 0, 200, 100]);
  });
});
