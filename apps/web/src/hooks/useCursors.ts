import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc, deleteDoc, collection, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface CursorData {
  userId: string;
  displayName: string;
  photoURL?: string;
  x: number;
  y: number;
  color: string;
  lastUpdated: number;
}

export function useCursors(boardId: string | undefined, userId: string | undefined) {
  const [cursors, setCursors] = useState<Map<string, CursorData>>(new Map());
  const throttleRef = useRef<number>(0);

  useEffect(() => {
    if (!boardId) return;
    const q = query(collection(db, 'boards', boardId, 'cursors'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCursors((prev) => {
        const next = new Map(prev);
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data() as CursorData;
            // Don't store own cursor
            if (data.userId !== userId) {
              next.set(change.doc.id, data);
            }
          } else if (change.type === 'removed') {
            next.delete(change.doc.id);
          }
        });
        // Clean stale cursors (older than 30 seconds)
        const now = Date.now();
        for (const [key, cursor] of next) {
          if (now - cursor.lastUpdated > 30000) {
            next.delete(key);
          }
        }
        return next;
      });
    });
    return unsubscribe;
  }, [boardId, userId]);

  const updateCursor = useCallback((x: number, y: number, displayName: string, color: string, photoURL?: string) => {
    if (!boardId || !userId) return;
    const now = Date.now();
    // Throttle to max 20 updates per second
    if (now - throttleRef.current < 50) return;
    throttleRef.current = now;

    setDoc(doc(db, 'boards', boardId, 'cursors', userId), {
      userId,
      displayName,
      photoURL: photoURL || null,
      x,
      y,
      color,
      lastUpdated: now,
    });
  }, [boardId, userId]);

  const removeCursor = useCallback(() => {
    if (!boardId || !userId) return;
    deleteDoc(doc(db, 'boards', boardId, 'cursors', userId));
  }, [boardId, userId]);

  return {
    cursors: Array.from(cursors.values()),
    updateCursor,
    removeCursor,
  };
}
