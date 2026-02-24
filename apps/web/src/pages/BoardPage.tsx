import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBoardObjects, type BoardObject } from '../hooks/useBoardObjects';
import { useCursors } from '../hooks/useCursors';
import { usePresence } from '../hooks/usePresence';
import { WhiteboardCanvas } from '../components/WhiteboardCanvas';
import { Toolbar } from '../components/Toolbar';
import { PresenceBar } from '../components/PresenceBar';
import { AICommandInput } from '../components/AICommandInput';
import { PropertiesPanel } from '../components/PropertiesPanel';

export type Tool = 'select' | 'sticky-note' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'text' | 'pan';

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { objects, addObject, addObjects, updateObject, updateObjects, deleteObjects } = useBoardObjects(boardId);
  const { cursors, updateCursor, removeCursor } = useCursors(boardId, user?.uid);
  const { users, userColor } = usePresence(boardId, user);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAI, setShowAI] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const clipboard = useRef<BoardObject[]>([]);

  // Debounced batch update buffer — collects rapid object updates and flushes as one batch
  const pendingUpdates = useRef<Map<string, Partial<BoardObject>>>(new Map());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPendingUpdates = useCallback(() => {
    if (pendingUpdates.current.size === 0) return;
    const batch = Array.from(pendingUpdates.current.entries()).map(([id, changes]) => ({ id, changes }));
    pendingUpdates.current.clear();
    updateObjects(batch);
  }, [updateObjects]);

  const debouncedUpdate = useCallback((id: string, updates: Partial<BoardObject>) => {
    pendingUpdates.current.set(id, { ...(pendingUpdates.current.get(id) || {}), ...updates });
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flushPendingUpdates, 50);
  }, [flushPendingUpdates]);

  useEffect(() => {
    return () => {
      removeCursor();
    };
  }, [removeCursor]);

  const handleCanvasClick = useCallback((x: number, y: number) => {
    if (!user) return;
    if (activeTool === 'select' || activeTool === 'pan') return;

    const defaults: Record<string, Partial<BoardObject>> = {
      'sticky-note': { width: 200, height: 200, color: '#FFEB3B', text: '', fontSize: 16 },
      'rectangle': { width: 200, height: 150, color: '#2196F3' },
      'circle': { width: 200, height: 200, color: '#4CAF50' },
      'text': { width: 200, height: 200, color: '#ffffff', text: '', fontSize: 20 },
      'line': { width: 200, height: 0, color: '#ffffff', points: [0, 0, 200, 0], strokeWidth: 3 },
      'arrow': { width: 200, height: 0, color: '#ffffff', points: [0, 0, 200, 0], strokeWidth: 3 },
    };

    const d = defaults[activeTool] || {};
    addObject({
      type: activeTool as BoardObject['type'],
      x: x - (d.width || 200) / 2,
      y: y - (d.height || 200) / 2,
      ...d,
    }, user.uid);

    setActiveTool('select');
  }, [activeTool, addObject, user]);

  const handleObjectUpdate = useCallback((id: string, updates: Partial<BoardObject>) => {
    // Use debounced batch for position/size changes (high-frequency during drag)
    // Use immediate update for content changes (text, color) for instant feedback
    const isPositionUpdate = ('x' in updates || 'y' in updates || 'width' in updates || 'height' in updates || 'rotation' in updates)
      && !('text' in updates) && !('color' in updates) && !('strokeWidth' in updates);
    if (isPositionUpdate) {
      debouncedUpdate(id, updates);
    } else {
      updateObject(id, updates);
    }
  }, [updateObject, debouncedUpdate]);

  const handleDelete = useCallback(() => {
    if (selectedIds.length > 0) {
      deleteObjects(selectedIds);
      setSelectedIds([]);
    }
  }, [selectedIds, deleteObjects]);

  const handleDuplicate = useCallback(async () => {
    if (!user || selectedIds.length === 0) return;
    const toDuplicate = objects.filter((o) => selectedIds.includes(o.id));
    const newObjs = toDuplicate.map((obj) => ({
      ...obj,
      id: undefined as any,
      x: obj.x + 20,
      y: obj.y + 20,
    }));
    await addObjects(newObjs, user.uid);
  }, [selectedIds, objects, addObjects, user]);

  const handleCopy = useCallback(() => {
    if (selectedIds.length === 0) return;
    clipboard.current = objects.filter((o) => selectedIds.includes(o.id));
  }, [selectedIds, objects]);

  const handlePaste = useCallback(async () => {
    if (!user || clipboard.current.length === 0) return;
    const newObjs = clipboard.current.map((obj) => ({
      ...obj,
      id: undefined as any,
      x: obj.x + 30,
      y: obj.y + 30,
    }));
    const added = await addObjects(newObjs, user.uid);
    if (added) {
      // Move clipboard reference so next paste offsets further
      clipboard.current = clipboard.current.map((obj) => ({ ...obj, x: obj.x + 30, y: obj.y + 30 }));
    }
  }, [user, addObjects]);

  const handleCursorMove = useCallback((x: number, y: number) => {
    if (!user) return;
    updateCursor(x, y, user.displayName || 'Anonymous', userColor, user.photoURL || undefined);
  }, [user, updateCursor, userColor]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      handleDelete();
    }
    if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleDuplicate();
    }
    if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleCopy();
      return;
    }
    if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handlePaste();
      return;
    }
    if (e.key === 'Escape') {
      setSelectedIds([]);
      setActiveTool('select');
    }
    if (e.key === 'v' && !e.metaKey && !e.ctrlKey) setActiveTool('select');
    if (e.key === 'h') setActiveTool('pan');
    if (e.key === 'n') setActiveTool('sticky-note');
    if (e.key === 'r') setActiveTool('rectangle');
    if (e.key === 'c' && !e.metaKey && !e.ctrlKey) setActiveTool('circle');
    if (e.key === 'l') setActiveTool('line');
    if (e.key === 'a' && !e.metaKey && !e.ctrlKey) setActiveTool('arrow');
    if (e.key === 't') setActiveTool('text');
    if (e.key === '/') {
      e.preventDefault();
      setShowAI(true);
    }
  }, [handleDelete, handleDuplicate, handleCopy, handlePaste]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const executeAIActions = useCallback(async (actions: { action: string; params: any }[]) => {
    if (!user) return;

    // Separate actions into batched categories for performance
    const creates: (Partial<BoardObject> & { type: BoardObject['type'] })[] = [];
    const updates: { id: string; changes: Partial<BoardObject> }[] = [];
    const deletes: string[] = [];

    for (const { action, params } of actions) {
      switch (action) {
        case 'createStickyNote':
          creates.push({
            type: 'sticky-note',
            x: params.x ?? 0, y: params.y ?? 0,
            width: params.width ?? 200, height: params.height ?? 200,
            color: params.color ?? '#FFEB3B', text: params.text ?? '',
          });
          break;
        case 'createShape':
          creates.push({
            type: params.type === 'circle' ? 'circle' : 'rectangle',
            x: params.x ?? 0, y: params.y ?? 0,
            width: params.width ?? 200, height: params.height ?? 150,
            color: params.color ?? '#2196F3',
          });
          break;
        case 'createFrame':
          creates.push({
            type: 'frame',
            x: params.x ?? 0, y: params.y ?? 0,
            width: params.width ?? 400, height: params.height ?? 300,
            color: params.color ?? '#37474F', text: params.title ?? 'Frame',
          });
          break;
        case 'createText':
          creates.push({
            type: 'text',
            x: params.x ?? 0, y: params.y ?? 0,
            width: 300, height: 50,
            color: params.color ?? '#ffffff', text: params.text ?? '',
            fontSize: params.fontSize ?? 20,
          });
          break;
        case 'createConnector':
          creates.push({
            type: 'connector',
            x: 0, y: 0, width: 0, height: 0,
            color: params.color ?? '#ffffff',
            fromId: params.fromId, toId: params.toId,
          });
          break;
        case 'moveObject':
          updates.push({ id: params.objectId, changes: { x: params.x, y: params.y } });
          break;
        case 'resizeObject':
          updates.push({ id: params.objectId, changes: { width: params.width, height: params.height } });
          break;
        case 'updateText':
          updates.push({ id: params.objectId, changes: { text: params.newText } });
          break;
        case 'changeColor':
          updates.push({ id: params.objectId, changes: { color: params.color } });
          break;
        case 'deleteObject':
          deletes.push(params.objectId);
          break;
      }
    }

    // Execute all batches in parallel — single Firestore write per category
    const promises: Promise<any>[] = [];
    if (creates.length > 0) promises.push(addObjects(creates, user.uid));
    if (updates.length > 0) promises.push(updateObjects(updates));
    if (deletes.length > 0) promises.push(deleteObjects(deletes));
    await Promise.all(promises);
  }, [user, addObjects, updateObjects, deleteObjects]);

  const handleAICommand = useCallback(async (prompt: string) => {
    if (!user || !boardId) return;
    try {
      const token = await user.getIdToken();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/ai/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          boardId,
          prompt,
          boardState: objects,
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'AI command failed');
      }
      const result = await response.json();
      // Execute the AI actions on the board
      if (result.actions && result.actions.length > 0) {
        await executeAIActions(result.actions);
      }
      return result;
    } catch (error) {
      console.error('AI command error:', error);
      throw error;
    }
  }, [user, boardId, objects, executeAIActions]);

  const copyBoardId = () => {
    if (boardId) {
      navigator.clipboard.writeText(boardId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#1e1e2e', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.4rem 1rem', background: '#16161e', borderBottom: '1px solid rgba(255,255,255,0.08)',
        zIndex: 100, height: 44,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', color: '#a0a0b0', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            ← Back
          </button>
          <span style={{ color: '#fff', fontWeight: 600 }}>CollabBoard</span>
          <button
            onClick={copyBoardId}
            style={{
              background: copiedId ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.05)',
              border: copiedId ? '1px solid #4CAF50' : '1px solid rgba(255,255,255,0.1)',
              color: copiedId ? '#4CAF50' : '#a0a0b0', cursor: 'pointer', fontSize: '0.7rem', padding: '0.2rem 0.5rem',
              borderRadius: '0.2rem', transition: 'all 0.2s', fontFamily: 'monospace',
            }}
            title="Click to copy board ID"
          >
            {copiedId ? 'Copied!' : `ID: ${boardId}`}
          </button>
        </div>
        <PresenceBar users={users} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => setShowAI(!showAI)}
            style={{
              padding: '0.3rem 0.8rem', background: showAI ? '#7c3aed' : 'rgba(124,58,237,0.2)',
              color: '#fff', border: '1px solid #7c3aed', borderRadius: '0.3rem',
              cursor: 'pointer', fontSize: '0.85rem',
            }}
          >
            AI ✦
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        {/* Toolbar */}
        <Toolbar activeTool={activeTool} onToolChange={setActiveTool} />

        {/* Canvas */}
        <WhiteboardCanvas
          objects={objects}
          cursors={cursors}
          activeTool={activeTool}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onCanvasClick={handleCanvasClick}
          onObjectUpdate={handleObjectUpdate}
          onCursorMove={handleCursorMove}
          userColor={userColor}
        />

        {/* Properties Panel */}
        {selectedIds.length > 0 && (
          <PropertiesPanel
            objects={objects.filter((o) => selectedIds.includes(o.id))}
            onUpdate={handleObjectUpdate}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
          />
        )}

        {/* AI Command Input */}
        {showAI && (
          <AICommandInput
            onSubmit={handleAICommand}
            onClose={() => setShowAI(false)}
          />
        )}
      </div>
    </div>
  );
}
