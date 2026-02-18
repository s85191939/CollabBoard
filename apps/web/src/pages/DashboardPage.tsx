import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';

interface BoardInfo {
  id: string;
  title: string;
  createdBy: string;
  createdAt: any;
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [activeTab, setActiveTab] = useState<'my' | 'shared'>('my');

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

  const myBoards = boards.filter((b) => b.createdBy === user?.uid);
  const sharedBoards = boards.filter((b) => b.createdBy !== user?.uid);
  const displayedBoards = activeTab === 'my' ? myBoards : sharedBoards;

  const createBoard = async () => {
    if (!user) return;
    const title = newBoardTitle.trim();
    if (!title) return;
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

  const handleDeleteBoard = async (e: React.MouseEvent, boardId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this board? This cannot be undone.')) return;
    await deleteDoc(doc(db, 'boards', boardId));
  };

  const joinBoard = () => {
    const boardId = prompt('Enter board ID to join:');
    if (boardId) {
      navigate(`/board/${boardId}`);
    }
  };

  const canCreate = newBoardTitle.trim().length > 0;

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
            placeholder="Enter board title..."
            onKeyDown={(e) => e.key === 'Enter' && canCreate && createBoard()}
            style={{
              flex: 1, padding: '0.7rem 1rem', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.4rem',
              color: '#fff', fontSize: '1rem',
            }}
          />
          <button
            onClick={createBoard}
            disabled={!canCreate}
            style={{
              padding: '0.7rem 1.5rem',
              background: canCreate ? '#4285f4' : 'rgba(66,133,244,0.3)',
              color: canCreate ? '#fff' : 'rgba(255,255,255,0.4)',
              border: 'none', borderRadius: '0.4rem',
              cursor: canCreate ? 'pointer' : 'not-allowed',
              fontSize: '1rem', transition: 'all 0.2s',
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

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={() => setActiveTab('my')}
            style={{
              padding: '0.6rem 1.2rem', background: 'none', color: activeTab === 'my' ? '#fff' : '#a0a0b0',
              border: 'none', borderBottom: activeTab === 'my' ? '2px solid #4285f4' : '2px solid transparent',
              cursor: 'pointer', fontSize: '0.95rem', fontWeight: activeTab === 'my' ? 600 : 400,
              transition: 'all 0.2s',
            }}
          >
            My Boards ({myBoards.length})
          </button>
          <button
            onClick={() => setActiveTab('shared')}
            style={{
              padding: '0.6rem 1.2rem', background: 'none', color: activeTab === 'shared' ? '#fff' : '#a0a0b0',
              border: 'none', borderBottom: activeTab === 'shared' ? '2px solid #4285f4' : '2px solid transparent',
              cursor: 'pointer', fontSize: '0.95rem', fontWeight: activeTab === 'shared' ? 600 : 400,
              transition: 'all 0.2s',
            }}
          >
            Shared with Me ({sharedBoards.length})
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
          {displayedBoards.map((board) => (
            <div
              key={board.id}
              onClick={() => navigate(`/board/${board.id}`)}
              style={{
                padding: '1.5rem', background: 'rgba(255,255,255,0.05)',
                borderRadius: '0.6rem', cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.1)',
                transition: 'border-color 0.2s', position: 'relative',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#4285f4')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ marginBottom: '0.5rem', flex: 1 }}>{board.title}</h3>
                {board.createdBy === user?.uid && (
                  <button
                    onClick={(e) => handleDeleteBoard(e, board.id)}
                    title="Delete board"
                    style={{
                      background: 'none', border: 'none', color: '#a0a0b0',
                      cursor: 'pointer', fontSize: '1rem', padding: '0 0.2rem',
                      lineHeight: 1, transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#a0a0b0')}
                  >
                    x
                  </button>
                )}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#a0a0b0', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {board.id}
              </p>
            </div>
          ))}
          {displayedBoards.length === 0 && (
            <p style={{ color: '#a0a0b0', gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
              {activeTab === 'my' ? 'No boards yet. Create one to get started!' : 'No shared boards yet. Join a board using a board ID!'}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
