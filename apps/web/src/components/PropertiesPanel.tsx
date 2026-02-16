interface BoardObject {
  id: string;
  type: 'sticky-note' | 'rectangle' | 'circle' | 'line' | 'text' | 'frame' | 'connector';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  text?: string;
  color: string;
  fontSize?: number;
}

const STICKY_COLORS = [
  '#FFEB3B', '#FF9800', '#E91E63', '#9C27B0',
  '#3F51B5', '#03A9F4', '#009688', '#4CAF50',
  '#8BC34A', '#FF5722', '#795548', '#607D8B',
];

interface Props {
  objects: BoardObject[];
  onUpdate: (id: string, updates: Partial<BoardObject>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function PropertiesPanel({ objects, onUpdate, onDelete, onDuplicate }: Props) {
  if (objects.length === 0) return null;
  const obj = objects[0];
  const multi = objects.length > 1;

  return (
    <div style={{
      width: 220,
      background: '#16161e',
      borderLeft: '1px solid rgba(255,255,255,0.08)',
      padding: '1rem',
      color: '#fff',
      fontSize: '0.85rem',
      overflowY: 'auto',
      zIndex: 50,
    }}>
      <div style={{ marginBottom: '1rem', fontWeight: 600 }}>
        {multi ? `${objects.length} objects` : obj.type}
      </div>

      {!multi && (
        <>
          {/* Position */}
          <div style={{ marginBottom: '0.8rem' }}>
            <label style={{ color: '#a0a0b0', fontSize: '0.75rem', display: 'block', marginBottom: '0.3rem' }}>Position</label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                type="number"
                value={Math.round(obj.x)}
                onChange={(e) => onUpdate(obj.id, { x: Number(e.target.value) })}
                style={inputStyle}
                placeholder="X"
              />
              <input
                type="number"
                value={Math.round(obj.y)}
                onChange={(e) => onUpdate(obj.id, { y: Number(e.target.value) })}
                style={inputStyle}
                placeholder="Y"
              />
            </div>
          </div>

          {/* Size */}
          <div style={{ marginBottom: '0.8rem' }}>
            <label style={{ color: '#a0a0b0', fontSize: '0.75rem', display: 'block', marginBottom: '0.3rem' }}>Size</label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                type="number"
                value={Math.round(obj.width)}
                onChange={(e) => onUpdate(obj.id, { width: Number(e.target.value) })}
                style={inputStyle}
                placeholder="W"
              />
              <input
                type="number"
                value={Math.round(obj.height)}
                onChange={(e) => onUpdate(obj.id, { height: Number(e.target.value) })}
                style={inputStyle}
                placeholder="H"
              />
            </div>
          </div>

          {/* Color */}
          <div style={{ marginBottom: '0.8rem' }}>
            <label style={{ color: '#a0a0b0', fontSize: '0.75rem', display: 'block', marginBottom: '0.3rem' }}>Color</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {STICKY_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => onUpdate(obj.id, { color: c })}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: c,
                    border: obj.color === c ? '2px solid #fff' : '2px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Font size for text-bearing objects */}
          {(obj.type === 'sticky-note' || obj.type === 'text') && (
            <div style={{ marginBottom: '0.8rem' }}>
              <label style={{ color: '#a0a0b0', fontSize: '0.75rem', display: 'block', marginBottom: '0.3rem' }}>Font Size</label>
              <input
                type="number"
                value={obj.fontSize || 16}
                onChange={(e) => onUpdate(obj.id, { fontSize: Number(e.target.value) })}
                style={inputStyle}
                min={8}
                max={72}
              />
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '1rem' }}>
        <button onClick={onDuplicate} style={btnStyle}>
          Duplicate
        </button>
        <button onClick={onDelete} style={{ ...btnStyle, background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderColor: '#ef4444' }}>
          Delete
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.3rem 0.5rem',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '0.3rem',
  color: '#fff',
  fontSize: '0.8rem',
  width: '100%',
};

const btnStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.4rem',
  background: 'rgba(255,255,255,0.05)',
  color: '#a0a0b0',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '0.3rem',
  cursor: 'pointer',
  fontSize: '0.8rem',
};
