type Tool = 'select' | 'sticky-note' | 'rectangle' | 'circle' | 'line' | 'text' | 'frame' | 'connector' | 'pan';

interface Props {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
}

const tools: { id: Tool; label: string; icon: string; shortcut: string }[] = [
  { id: 'select', label: 'Select', icon: '↖', shortcut: 'V' },
  { id: 'pan', label: 'Pan', icon: '✋', shortcut: 'H' },
  { id: 'sticky-note', label: 'Sticky Note', icon: '📝', shortcut: 'N' },
  { id: 'rectangle', label: 'Rectangle', icon: '⬜', shortcut: 'R' },
  { id: 'circle', label: 'Circle', icon: '⭕', shortcut: 'C' },
  { id: 'line', label: 'Line', icon: '╱', shortcut: 'L' },
  { id: 'text', label: 'Text', icon: 'T', shortcut: 'T' },
  { id: 'frame', label: 'Frame', icon: '⬡', shortcut: 'F' },
];

export function Toolbar({ activeTool, onToolChange }: Props) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      padding: '0.5rem',
      background: '#16161e',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      zIndex: 50,
      width: 48,
    }}>
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onToolChange(tool.id)}
          title={`${tool.label} (${tool.shortcut})`}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: activeTool === tool.id ? '#4285f4' : 'transparent',
            color: activeTool === tool.id ? '#fff' : '#a0a0b0',
            border: 'none',
            borderRadius: '0.3rem',
            cursor: 'pointer',
            fontSize: tool.id === 'text' ? '0.9rem' : '1.1rem',
            fontWeight: tool.id === 'text' ? 700 : 400,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            if (activeTool !== tool.id) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
          }}
          onMouseLeave={(e) => {
            if (activeTool !== tool.id) e.currentTarget.style.background = 'transparent';
          }}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  );
}
