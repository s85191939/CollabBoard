import { useState, useEffect, useCallback } from 'react';
import {
  collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, writeBatch, query
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { v4 as uuidv4 } from 'uuid';

export interface BoardObject {
  id: string;
  type: 'sticky-note' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'text' | 'frame' | 'connector';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  text?: string;
  color: string;
  fontSize?: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  fromId?: string;
  toId?: string;
  points?: number[];
}

export function useBoardObjects(boardId: string | undefined) {
  const [objects, setObjects] = useState<Map<string, BoardObject>>(new Map());

  useEffect(() => {
    if (!boardId) return;
    const q = query(collection(db, 'boards', boardId, 'objects'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setObjects((prev) => {
        const next = new Map(prev);
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            next.set(change.doc.id, { id: change.doc.id, ...change.doc.data() } as BoardObject);
          } else if (change.type === 'removed') {
            next.delete(change.doc.id);
          }
        });
        return next;
      });
    });
    return unsubscribe;
  }, [boardId]);

  const addObject = useCallback(async (obj: Partial<BoardObject> & { type: BoardObject['type'] }, userId: string) => {
    if (!boardId) return null;
    const id = obj.id || uuidv4();
    const now = Date.now();
    const fullObj: BoardObject = {
      id,
      type: obj.type,
      x: obj.x ?? 0,
      y: obj.y ?? 0,
      width: obj.width ?? 200,
      height: obj.height ?? 200,
      rotation: obj.rotation ?? 0,
      text: obj.text ?? '',
      color: obj.color ?? '#FFEB3B',
      fontSize: obj.fontSize ?? 16,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      ...(obj.fromId !== undefined && { fromId: obj.fromId }),
      ...(obj.toId !== undefined && { toId: obj.toId }),
      ...(obj.points !== undefined && { points: obj.points }),
    };
    await setDoc(doc(db, 'boards', boardId, 'objects', id), fullObj);
    return id;
  }, [boardId]);

  const updateObject = useCallback(async (id: string, updates: Partial<BoardObject>) => {
    if (!boardId) return;
    await updateDoc(doc(db, 'boards', boardId, 'objects', id), {
      ...updates,
      updatedAt: Date.now(),
    });
  }, [boardId]);

  const deleteObject = useCallback(async (id: string) => {
    if (!boardId) return;
    await deleteDoc(doc(db, 'boards', boardId, 'objects', id));
  }, [boardId]);

  const deleteObjects = useCallback(async (ids: string[]) => {
    if (!boardId) return;
    const batch = writeBatch(db);
    ids.forEach((id) => {
      batch.delete(doc(db, 'boards', boardId, 'objects', id));
    });
    await batch.commit();
  }, [boardId]);

  const addObjects = useCallback(async (objs: (Partial<BoardObject> & { type: BoardObject['type'] })[], userId: string) => {
    if (!boardId) return [];
    const batch = writeBatch(db);
    const ids: string[] = [];
    const now = Date.now();
    objs.forEach((obj) => {
      const id = obj.id || uuidv4();
      ids.push(id);
      const fullObj: BoardObject = {
        id,
        type: obj.type,
        x: obj.x ?? 0,
        y: obj.y ?? 0,
        width: obj.width ?? 200,
        height: obj.height ?? 200,
        rotation: obj.rotation ?? 0,
        text: obj.text ?? '',
        color: obj.color ?? '#FFEB3B',
        fontSize: obj.fontSize ?? 16,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        ...(obj.fromId !== undefined && { fromId: obj.fromId }),
        ...(obj.toId !== undefined && { toId: obj.toId }),
        ...(obj.points !== undefined && { points: obj.points }),
      };
      batch.set(doc(db, 'boards', boardId, 'objects', id), fullObj);
    });
    await batch.commit();
    return ids;
  }, [boardId]);

  return {
    objects: Array.from(objects.values()),
    objectsMap: objects,
    addObject,
    addObjects,
    updateObject,
    deleteObject,
    deleteObjects,
  };
}
