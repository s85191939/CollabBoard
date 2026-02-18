import { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text, Group, Arrow, Transformer } from 'react-konva';
import Konva from 'konva';

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
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  fromId?: string;
  toId?: string;
  points?: number[];
}

interface CursorData {
  userId: string;
  displayName: string;
  x: number;
  y: number;
  color: string;
}

type Tool = 'select' | 'sticky-note' | 'rectangle' | 'circle' | 'line' | 'text' | 'frame' | 'connector' | 'pan';

interface Props {
  objects: BoardObject[];
  cursors: CursorData[];
  activeTool: Tool;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onCanvasClick: (x: number, y: number) => void;
  onObjectUpdate: (id: string, updates: Partial<BoardObject>) => void;
  onCursorMove: (x: number, y: number) => void;
  userColor: string;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

export function WhiteboardCanvas({
  objects,
  cursors,
  activeTool,
  selectedIds,
  onSelectionChange,
  onCanvasClick,
  onObjectUpdate,
  onCursorMove,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const lineTransformerRef = useRef<Konva.Transformer>(null);
  const selectionRectRef = useRef<Konva.Rect>(null);
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight - 44 });
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSelecting = useRef(false);
  const selectionStart = useRef({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPointerPos = useRef({ x: 0, y: 0 });
  const spacePressed = useRef(false);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setStageSize({ width: window.innerWidth, height: window.innerHeight - 44 });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Spacebar for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        spacePressed.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressed.current = false;
        isPanning.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Update transformer when selection changes — separate lines from shapes
  useEffect(() => {
    if (!transformerRef.current || !lineTransformerRef.current || !stageRef.current) return;
    const stage = stageRef.current;

    const lineIds = new Set(
      objects.filter((o) => o.type === 'line').map((o) => o.id)
    );

    const shapeNodes: Konva.Node[] = [];
    const lineNodes: Konva.Node[] = [];

    selectedIds.forEach((id) => {
      const node = stage.findOne(`#obj-${id}`);
      if (!node) return;
      if (lineIds.has(id)) {
        lineNodes.push(node);
      } else {
        shapeNodes.push(node);
      }
    });

    transformerRef.current.nodes(shapeNodes);
    lineTransformerRef.current.nodes(lineNodes);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedIds, objects]);

  const getPointerPosition = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pointer = stage.getPointerPosition();
    if (!pointer) return { x: 0, y: 0 };
    const transform = stage.getAbsoluteTransform().copy().invert();
    return transform.point(pointer);
  }, []);

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    // Pinch-to-zoom (ctrlKey is set on trackpad pinch) or mouse wheel zoom
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const scaleBy = 1.03;
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
      newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));

      stage.scale({ x: newScale, y: newScale });
      stage.position({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    } else {
      // Two-finger trackpad scroll = pan
      stage.position({
        x: stage.x() - e.evt.deltaX,
        y: stage.y() - e.evt.deltaY,
      });
    }
    stage.batchDraw();
  }, []);

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    // Middle mouse button, pan tool, spacebar+click, or shift+click for panning
    if (e.evt.button === 1 || activeTool === 'pan' || spacePressed.current || (e.evt.button === 0 && e.evt.shiftKey && activeTool === 'select')) {
      isPanning.current = true;
      lastPointerPos.current = stage.getPointerPosition() || { x: 0, y: 0 };
      return;
    }

    const clickedOnEmpty = e.target === stage || e.target.getParent()?.name() === 'grid';

    if (clickedOnEmpty) {
      if (activeTool === 'select') {
        // Start selection rectangle
        onSelectionChange([]);
        isSelecting.current = true;
        const pos = getPointerPosition();
        selectionStart.current = pos;
        if (selectionRectRef.current) {
          selectionRectRef.current.setAttrs({
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            visible: true,
          });
        }
      } else {
        const pos = getPointerPosition();
        onCanvasClick(pos.x, pos.y);
      }
    }
  }, [activeTool, onSelectionChange, onCanvasClick, getPointerPosition]);

  const handleMouseMove = useCallback((_e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    // Report cursor position for multiplayer
    const pos = getPointerPosition();
    onCursorMove(pos.x, pos.y);

    // Panning
    if (isPanning.current) {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const dx = pointer.x - lastPointerPos.current.x;
      const dy = pointer.y - lastPointerPos.current.y;
      stage.position({
        x: stage.x() + dx,
        y: stage.y() + dy,
      });
      lastPointerPos.current = pointer;
      stage.batchDraw();
      return;
    }

    // Selection rectangle
    if (isSelecting.current && selectionRectRef.current) {
      const pos = getPointerPosition();
      const x = Math.min(selectionStart.current.x, pos.x);
      const y = Math.min(selectionStart.current.y, pos.y);
      const w = Math.abs(pos.x - selectionStart.current.x);
      const h = Math.abs(pos.y - selectionStart.current.y);
      selectionRectRef.current.setAttrs({ x, y, width: w, height: h });
      selectionRectRef.current.getLayer()?.batchDraw();
    }
  }, [getPointerPosition, onCursorMove]);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;

    if (isSelecting.current && selectionRectRef.current) {
      isSelecting.current = false;
      const selRect = selectionRectRef.current.getClientRect();
      selectionRectRef.current.setAttrs({ visible: false });

      if (selRect.width > 5 && selRect.height > 5) {
        const selected = objects.filter((obj) => {
          const stage = stageRef.current;
          if (!stage) return false;
          const node = stage.findOne(`#obj-${obj.id}`);
          if (!node) return false;
          const nodeRect = node.getClientRect();
          return Konva.Util.haveIntersection(selRect, nodeRect);
        });
        onSelectionChange(selected.map((o) => o.id));
      }
    }
  }, [objects, onSelectionChange]);

  const handleObjectClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>, objId: string) => {
    if (activeTool !== 'select') return;
    e.cancelBubble = true;
    if (e.evt.shiftKey) {
      const isSelected = selectedIds.includes(objId);
      if (isSelected) {
        onSelectionChange(selectedIds.filter((id) => id !== objId));
      } else {
        onSelectionChange([...selectedIds, objId]);
      }
    } else {
      onSelectionChange([objId]);
    }
  }, [activeTool, selectedIds, onSelectionChange]);

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>, objId: string) => {
    const node = e.target;
    onObjectUpdate(objId, {
      x: node.x(),
      y: node.y(),
    });
  }, [onObjectUpdate]);

  const handleTransformEnd = useCallback((e: Konva.KonvaEventObject<Event>, objId: string) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    onObjectUpdate(objId, {
      x: node.x(),
      y: node.y(),
      width: Math.max(20, node.width() * scaleX),
      height: Math.max(20, node.height() * scaleY),
      rotation: node.rotation(),
    });
  }, [onObjectUpdate]);

  const handleTextDblClick = useCallback((objId: string, obj: BoardObject) => {
    setEditingTextId(objId);
    setEditingTextValue(obj.text || '');
    // Focus the textarea after React renders it
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        // Place cursor at end
        textareaRef.current.selectionStart = textareaRef.current.value.length;
        textareaRef.current.selectionEnd = textareaRef.current.value.length;
      }
    }, 0);
  }, []);

  const handleTextEditBlur = useCallback(() => {
    if (editingTextId) {
      onObjectUpdate(editingTextId, { text: editingTextValue });
      setEditingTextId(null);
      setEditingTextValue('');
    }
  }, [editingTextId, editingTextValue, onObjectUpdate]);

  const handleTextEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      // Cancel editing — revert
      setEditingTextId(null);
      setEditingTextValue('');
    }
    // Stop propagation so spacebar/other keys don't trigger canvas actions
    e.stopPropagation();
  }, []);

  // Compute the textarea overlay position/size for the currently-editing object
  const getEditingOverlayStyle = useCallback((): React.CSSProperties | null => {
    if (!editingTextId || !stageRef.current) return null;
    const editingObj = objects.find((o) => o.id === editingTextId);
    if (!editingObj) return null;

    const stage = stageRef.current;
    const node = stage.findOne(`#obj-${editingTextId}`);
    if (!node) return null;

    const absPos = node.getAbsolutePosition();
    const scale = stage.scaleX();
    const container = stage.container().getBoundingClientRect();

    const isStickyNote = editingObj.type === 'sticky-note';
    const isFrame = editingObj.type === 'frame';

    return {
      position: 'absolute' as const,
      top: `${container.top + absPos.y + (isFrame ? -20 * scale : 0)}px`,
      left: `${container.left + absPos.x}px`,
      width: `${editingObj.width * scale}px`,
      height: `${(isFrame ? 24 : editingObj.height) * scale}px`,
      fontSize: `${(editingObj.fontSize || (isStickyNote ? 16 : isFrame ? 14 : 20)) * scale}px`,
      fontFamily: 'sans-serif',
      fontWeight: isFrame ? 'bold' : 'normal',
      lineHeight: '1.4',
      padding: isStickyNote ? `${12 * scale}px` : isFrame ? `${4 * scale}px` : '0px',
      border: '2px solid #4285f4',
      borderRadius: '4px',
      background: isStickyNote ? editingObj.color : isFrame ? 'rgba(55,71,79,0.9)' : 'rgba(30,30,46,0.95)',
      color: isStickyNote ? '#333' : isFrame ? editingObj.color : '#fff',
      outline: 'none',
      resize: 'none' as const,
      overflow: 'hidden',
      zIndex: 1000,
      boxSizing: 'border-box' as const,
      margin: 0,
      whiteSpace: 'pre-wrap' as const,
      wordWrap: 'break-word' as const,
    };
  }, [editingTextId, objects]);

  const renderObject = (obj: BoardObject) => {
    const isSelected = selectedIds.includes(obj.id);
    const draggable = activeTool === 'select';
    const isEditing = editingTextId === obj.id;
    const commonProps = {
      id: `obj-${obj.id}`,
      x: obj.x,
      y: obj.y,
      rotation: obj.rotation || 0,
      draggable,
      onClick: (e: Konva.KonvaEventObject<MouseEvent>) => handleObjectClick(e, obj.id),
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(e, obj.id),
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => handleTransformEnd(e, obj.id),
      onDblClick: () => {
        if (obj.type === 'sticky-note' || obj.type === 'text' || obj.type === 'frame') {
          handleTextDblClick(obj.id, obj);
        }
      },
      onDblTap: () => {
        if (obj.type === 'sticky-note' || obj.type === 'text' || obj.type === 'frame') {
          handleTextDblClick(obj.id, obj);
        }
      },
    };

    switch (obj.type) {
      case 'sticky-note':
        return (
          <Group key={obj.id} {...commonProps}>
            <Rect
              width={obj.width}
              height={obj.height}
              fill={obj.color}
              cornerRadius={4}
              shadowColor="rgba(0,0,0,0.3)"
              shadowBlur={8}
              shadowOffset={{ x: 2, y: 2 }}
            />
            {!isEditing && (
              <Text
                text={obj.text || 'Enter text...'}
                width={obj.width}
                height={obj.height}
                padding={12}
                fontSize={obj.fontSize || 16}
                fontFamily="sans-serif"
                fill={obj.text ? '#333' : '#999'}
                fontStyle={obj.text ? 'normal' : 'italic'}
                wrap="word"
                align="left"
                verticalAlign="top"
              />
            )}
          </Group>
        );

      case 'rectangle':
        return (
          <Rect
            key={obj.id}
            {...commonProps}
            width={obj.width}
            height={obj.height}
            fill={obj.color}
            cornerRadius={2}
            stroke={isSelected ? '#4285f4' : undefined}
            strokeWidth={isSelected ? 2 : 0}
          />
        );

      case 'circle':
        return (
          <Circle
            key={obj.id}
            {...commonProps}
            x={obj.x + obj.width / 2}
            y={obj.y + obj.height / 2}
            radiusX={obj.width / 2}
            radiusY={obj.height / 2}
            fill={obj.color}
            stroke={isSelected ? '#4285f4' : undefined}
            strokeWidth={isSelected ? 2 : 0}
            // Override position for circle since center-based
            onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
              const node = e.target;
              onObjectUpdate(obj.id, {
                x: node.x() - obj.width / 2,
                y: node.y() - obj.height / 2,
              });
            }}
          />
        );

      case 'line':
        return (
          <Line
            key={obj.id}
            {...commonProps}
            points={obj.points || [0, 0, obj.width, 0]}
            stroke={obj.color}
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
            hitStrokeWidth={20}
            onTransformEnd={(e: Konva.KonvaEventObject<Event>) => {
              const node = e.target;
              const scaleX = node.scaleX();
              const scaleY = node.scaleY();
              node.scaleX(1);
              node.scaleY(1);
              const oldPoints = obj.points || [0, 0, obj.width, 0];
              const newPoints = oldPoints.map((p, i) => i % 2 === 0 ? p * scaleX : p * scaleY);
              onObjectUpdate(obj.id, {
                x: node.x(),
                y: node.y(),
                points: newPoints,
                width: Math.abs(newPoints[2] - newPoints[0]) || obj.width * scaleX,
                rotation: node.rotation(),
              });
            }}
          />
        );

      case 'text':
        return (
          <Group key={obj.id} {...commonProps}>
            {!isEditing && (
              <Text
                text={obj.text || 'Text'}
                fontSize={obj.fontSize || 20}
                fontFamily="sans-serif"
                fill={obj.color}
                width={obj.width}
              />
            )}
          </Group>
        );

      case 'frame':
        return (
          <Group key={obj.id} {...commonProps}>
            <Rect
              width={obj.width}
              height={obj.height}
              fill="rgba(55,71,79,0.15)"
              stroke={obj.color}
              strokeWidth={2}
              cornerRadius={8}
              dash={[8, 4]}
            />
            {!isEditing && (
              <Text
                text={obj.text || 'Frame'}
                fontSize={14}
                fontFamily="sans-serif"
                fill={obj.color}
                x={8}
                y={-20}
                fontStyle="bold"
              />
            )}
          </Group>
        );

      case 'connector':
        // Find connected objects
        const fromObj = objects.find((o) => o.id === obj.fromId);
        const toObj = objects.find((o) => o.id === obj.toId);
        if (!fromObj || !toObj) return null;
        const fromX = fromObj.x + fromObj.width / 2;
        const fromY = fromObj.y + fromObj.height / 2;
        const toX = toObj.x + toObj.width / 2;
        const toY = toObj.y + toObj.height / 2;
        return (
          <Arrow
            key={obj.id}
            id={`obj-${obj.id}`}
            points={[fromX, fromY, toX, toY]}
            stroke={obj.color || '#fff'}
            strokeWidth={2}
            pointerLength={10}
            pointerWidth={10}
            fill={obj.color || '#fff'}
            onClick={(e: Konva.KonvaEventObject<MouseEvent>) => handleObjectClick(e, obj.id)}
            hitStrokeWidth={20}
          />
        );

      default:
        return null;
    }
  };

  const [cursorOverride, setCursorOverride] = useState(false);

  // Update cursor when space is held
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorOverride(spacePressed.current);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const cursorStyle = cursorOverride || activeTool === 'pan' ? 'grab' : activeTool === 'select' ? 'default' : 'crosshair';

  return (
    <div style={{ flex: 1, cursor: cursorStyle, position: 'relative' }}>
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.evt.preventDefault()}
      >
        {/* Grid layer */}
        <Layer name="grid">
          {/* Subtle dot grid pattern rendered by canvas directly is more performant,
              but for now we keep it simple */}
        </Layer>

        {/* Objects layer */}
        <Layer>
          {/* Render frames first (behind other objects) */}
          {objects.filter((o) => o.type === 'frame').map(renderObject)}
          {/* Then connectors */}
          {objects.filter((o) => o.type === 'connector').map(renderObject)}
          {/* Then other objects */}
          {objects.filter((o) => o.type !== 'frame' && o.type !== 'connector').map(renderObject)}

          {/* Selection rectangle */}
          <Rect
            ref={selectionRectRef}
            fill="rgba(66, 133, 244, 0.1)"
            stroke="#4285f4"
            strokeWidth={1}
            visible={false}
          />

          {/* Transformer for shapes (not lines) */}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 20 || newBox.height < 20) return oldBox;
              return newBox;
            }}
            borderStroke="#4285f4"
            anchorFill="#fff"
            anchorStroke="#4285f4"
            anchorSize={8}
          />

          {/* Transformer for lines — only 2 endpoint anchors */}
          <Transformer
            ref={lineTransformerRef}
            enabledAnchors={['top-left', 'bottom-right']}
            borderEnabled={false}
            rotateEnabled={false}
            borderStroke="#4285f4"
            anchorFill="#fff"
            anchorStroke="#4285f4"
            anchorSize={10}
            anchorCornerRadius={5}
          />
        </Layer>

        {/* Cursors layer */}
        <Layer>
          {cursors.map((cursor) => (
            <Group key={cursor.userId} x={cursor.x} y={cursor.y}>
              {/* Cursor arrow */}
              <Line
                points={[0, 0, 0, 16, 4, 12, 8, 20, 12, 18, 8, 10, 14, 10]}
                fill={cursor.color}
                stroke="#fff"
                strokeWidth={1}
                closed
              />
              {/* Name label */}
              <Group x={16} y={14}>
                <Rect
                  width={Math.max(60, cursor.displayName.length * 7 + 12)}
                  height={20}
                  fill={cursor.color}
                  cornerRadius={3}
                />
                <Text
                  text={cursor.displayName}
                  fontSize={11}
                  fontFamily="sans-serif"
                  fill="#fff"
                  padding={4}
                  x={2}
                />
              </Group>
            </Group>
          ))}
        </Layer>
      </Stage>

      {/* Inline text editing overlay */}
      {editingTextId && (() => {
        const style = getEditingOverlayStyle();
        if (!style) return null;
        return (
          <textarea
            ref={textareaRef}
            value={editingTextValue}
            onChange={(e) => setEditingTextValue(e.target.value)}
            onBlur={handleTextEditBlur}
            onKeyDown={handleTextEditKeyDown}
            placeholder="Enter text..."
            style={style}
          />
        );
      })()}

      {/* Zoom indicator */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12,
        background: 'rgba(22,22,30,0.8)', color: '#a0a0b0',
        padding: '0.3rem 0.6rem', borderRadius: '0.3rem', fontSize: '0.75rem',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        {Math.round((stageRef.current?.scaleX() || 1) * 100)}%
      </div>
    </div>
  );
}
