import { useState, useEffect } from 'react';
import { doc, setDoc, deleteDoc, collection, onSnapshot, query, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';

const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F0B27A', '#82E0AA',
];

export interface PresenceUser {
  uid: string;
  displayName: string;
  photoURL?: string;
  color: string;
  isOnline: boolean;
  lastSeen: number;
}

function getUserColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = ((hash << 5) - hash) + uid.charCodeAt(i);
    hash |= 0;
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

export function usePresence(boardId: string | undefined, user: { uid: string; displayName: string | null; photoURL: string | null } | null) {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const userColor = user ? getUserColor(user.uid) : '#ccc';

  useEffect(() => {
    if (!boardId || !user) return;

    // Set presence
    const presenceRef = doc(db, 'boards', boardId, 'presence', user.uid);
    const presenceData: PresenceUser = {
      uid: user.uid,
      displayName: user.displayName || 'Anonymous',
      photoURL: user.photoURL || undefined,
      color: userColor,
      isOnline: true,
      lastSeen: Date.now(),
    };
    setDoc(presenceRef, presenceData);

    // Update presence periodically
    const interval = setInterval(() => {
      setDoc(presenceRef, { ...presenceData, lastSeen: Date.now() });
    }, 10000);

    // Listen to all presence
    const q = query(collection(db, 'boards', boardId, 'presence'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList: PresenceUser[] = [];
      const now = Date.now();
      snapshot.forEach((doc) => {
        const data = doc.data() as PresenceUser;
        // Consider online if seen in last 30 seconds
        if (now - data.lastSeen < 30000) {
          userList.push(data);
        }
      });
      setUsers(userList);
    });

    // Cleanup on unmount
    return () => {
      clearInterval(interval);
      unsubscribe();
      deleteDoc(presenceRef);
    };
  }, [boardId, user, userColor]);

  // Also add member to board on join
  useEffect(() => {
    if (!boardId || !user) return;
    updateDoc(doc(db, 'boards', boardId), {
      members: arrayUnion(user.uid),
    }).catch(() => {
      // Board might not exist yet or user might not have permission
    });
  }, [boardId, user]);

  return { users, userColor };
}
