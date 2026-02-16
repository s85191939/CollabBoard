import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';

interface BoardInfo {
  id: string;
  title: string;
  createdAt: any;
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  const [newBoardTitle, setNewBoardTitle] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'boards'),
      where('members', 'array-contains', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const boardList: BoardInfo[] = [];
      snapshot.forEach((doc) => {
        boardList.push({ id: doc.id, ...doc.data() } as BoardInfo);
      });
      setBoards(boardList);
    });
    return unsubscribe;
  }, [user]);

  const createBoard = async () => {
    if (!user) return;
    const title = newBoardTitle.trim() || 'Untitled Board';
    const docRef = await addDoc(collection(db, 'boards'), {
      title,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      members: [user.uid],
    });
    setNewBoardTitle('');
    navigate(`/board/${docRef.id}`);
  };

  const joinBoard = () => {
    const boardId = prompt('Enter board ID to join:');
    if (boardId) {
      navigate(`/board/${boardId}`);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', color: '#fff' }}>
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>CollabBoard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#a0a0b0' }}>{user?.displayName}</span>
          <img
            src={user?.photoURL || ''}
            alt=""
            style={{ width: 32, height: 32, borderRadius: '50%' }}
          />
          <button
            onClick={logout}
            style={{
              padding: '0.4rem 1rem', background: 'rgba(255,255,255,0.1)',
              color: '#fff', border: 'none', borderRadius: '0.3rem', cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </header>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <input
            value={newBoardTitle}
            onChange={(e) => setNewBoardTitle(e.target.value)}
            placeholder="Board title..."
            onKeyDown={(e) => e.key === 'Enter' && createBoard()}
            style={{
              flex: 1, padding: '0.7rem 1rem', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.4rem',
              color: '#fff', fontSize: '1rem',
            }}
          />
          <button
            onClick={createBoard}
            style={{
              padding: '0.7rem 1.5rem', background: '#4285f4', color: '#fff',
              border: 'none', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '1rem',
            }}
          >
            + New Board
          </button>
          <button
            onClick={joinBoard}
            style={{
              padding: '0.7rem 1.5rem', background: 'rgba(255,255,255,0.1)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '1rem',
            }}
          >
            Join Board
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
          {boards.map((board) => (
            <div
              key={board.id}
              onClick={() => navigate(`/board/${board.id}`)}
              style={{
                padding: '1.5rem', background: 'rgba(255,255,255,0.05)',
                borderRadius: '0.6rem', cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.1)',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#4285f4')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
            >
              <h3 style={{ marginBottom: '0.5rem' }}>{board.title}</h3>
              <p style={{ fontSize: '0.8rem', color: '#a0a0b0' }}>
                ID: {board.id.slice(0, 8)}...
              </p>
            </div>
          ))}
          {boards.length === 0 && (
            <p style={{ color: '#a0a0b0', gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
              No boards yet. Create one to get started!
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
