import { useState, useRef, useEffect } from 'react';

interface Props {
  onSubmit: (prompt: string) => Promise<any>;
  onClose: () => void;
}

export function AICommandInput({ onSubmit, onClose }: Props) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await onSubmit(prompt.trim());
      setResult(res?.message || 'Command executed successfully');
      setPrompt('');
    } catch (err: any) {
      setError(err?.message || 'Command failed');
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'Add a yellow sticky note that says "User Research"',
    'Create a SWOT analysis template',
    'Arrange sticky notes in a grid',
    'Create a blue rectangle',
    'Build a retrospective board',
    'Add 3 sticky notes for brainstorming',
  ];

  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 600,
      maxWidth: 'calc(100vw - 120px)',
      background: '#1e1e2e',
      borderRadius: '0.75rem',
      border: '1px solid rgba(124,58,237,0.3)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      zIndex: 200,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.6rem 1rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{ color: '#7c3aed', fontSize: '0.85rem', fontWeight: 600 }}>
          AI Assistant
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#a0a0b0',
            cursor: 'pointer',
            fontSize: '1.1rem',
          }}
        >
          ×
        </button>
      </div>

      {/* Suggestions */}
      {!prompt && !result && !error && (
        <div style={{ padding: '0.5rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => setPrompt(s)}
              style={{
                padding: '0.3rem 0.6rem',
                background: 'rgba(124,58,237,0.1)',
                color: '#a78bfa',
                border: '1px solid rgba(124,58,237,0.2)',
                borderRadius: '1rem',
                cursor: 'pointer',
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Result/Error */}
      {result && (
        <div style={{ padding: '0.6rem 1rem', color: '#4ade80', fontSize: '0.85rem' }}>
          {result}
        </div>
      )}
      {error && (
        <div style={{ padding: '0.6rem 1rem', color: '#ef4444', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', padding: '0.5rem' }}>
        <input
          ref={inputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask AI to create, arrange, or modify objects... (press / to focus)"
          disabled={loading}
          style={{
            flex: 1,
            padding: '0.6rem 1rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '0.4rem 0 0 0.4rem',
            color: '#fff',
            fontSize: '0.9rem',
            outline: 'none',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          style={{
            padding: '0.6rem 1.2rem',
            background: loading ? '#555' : '#7c3aed',
            color: '#fff',
            border: 'none',
            borderRadius: '0 0.4rem 0.4rem 0',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          {loading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
