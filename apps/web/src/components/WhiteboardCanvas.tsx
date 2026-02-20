import { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer, Rect, Ellipse, Line, Text, Group, Arrow, Transformer } from 'react-konva';
import Konva from 'konva';

interface BoardObject {
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
  strokeWidth?: number;
}

const STROKE_WIDTHS = [1, 2, 3, 5, 8, 12];

interface CursorData {
  userId: string;
  displayName: string;
  x: number;
  y: number;
  color: string;
}

type Tool = 'select' | 'sticky-note' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'text' | 'pan';

const SHAPE_COLORS = [
  '#ffffff', '#FF5722', '#E91E63', '#9C27B0',
  '#3F51B5', '#2196F3', '#03A9F4', '#009688',
  '#4CAF50', '#8BC34A', '#FFEB3B', '#FF9800',
];

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
  const [showColorPicker, setShowColorPicker] = useState<{ x: number; y: number; objId: string } | null>(null);
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

  // Update transformers when selection changes — lines/arrows get their own transformer
  useEffect(() => {
    if (!transformerRef.current || !lineTransformerRef.current || !stageRef.current) return;
    const stage = stageRef.current;

    const lineTypes = new Set(['line', 'arrow']);
    const lineIds = new Set(
      objects.filter((o) => lineTypes.has(o.type)).map((o) => o.id)
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

  // Close color picker when selection changes
  useEffect(() => {
    if (selectedIds.length !== 1) {
      setShowColorPicker(null);
    }
  }, [selectedIds]);

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

    if (e.evt.button === 1 || activeTool === 'pan' || spacePressed.current || (e.evt.button === 0 && e.evt.shiftKey && activeTool === 'select')) {
      isPanning.current = true;
      lastPointerPos.current = stage.getPointerPosition() || { x: 0, y: 0 };
      return;
    }

    const clickedOnEmpty = e.target === stage || e.target.getParent()?.name() === 'grid';

    if (clickedOnEmpty) {
      setShowColorPicker(null);
      if (activeTool === 'select') {
        onSelectionChange([]);
        isSelecting.current = true;
        const pos = getPointerPosition();
        selectionStart.current = pos;
        if (selectionRectRef.current) {
          selectionRectRef.current.setAttrs({
            x: pos.x, y: pos.y, width: 0, height: 0, visible: true,
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

    const pos = getPointerPosition();
    onCursorMove(pos.x, pos.y);

    if (isPanning.current) {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const dx = pointer.x - lastPointerPos.current.x;
      const dy = pointer.y - lastPointerPos.current.y;
      stage.position({ x: stage.x() + dx, y: stage.y() + dy });
      lastPointerPos.current = pointer;
      stage.batchDraw();
      return;
    }

    if (isSelecting.current && selectionRectRef.current) {
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

    // Show color picker for shapes (not sticky notes — they have their own panel)
    const obj = objects.find((o) => o.id === objId);
    if (obj && ['rectangle', 'circle', 'line', 'arrow'].includes(obj.type)) {
      const stage = stageRef.current;
      if (stage) {
        const node = stage.findOne(`#obj-${objId}`);
        if (node) {
          const clientRect = node.getClientRect();
          const stageBox = stage.container().getBoundingClientRect();
          // Position toolbar above-right of the object, well clear of it
          const toolbarHeight = (obj.type === 'line' || obj.type === 'arrow') ? 80 : 44;
          const topY = stageBox.top + clientRect.y - toolbarHeight - 12;
          const leftX = stageBox.left + clientRect.x + clientRect.width / 2;
          setShowColorPicker({
            x: Math.max(8, Math.min(leftX, window.innerWidth - 320)),
            y: Math.max(8, topY),
            objId,
          });
        }
      }
    } else {
      setShowColorPicker(null);
    }
  }, [activeTool, selectedIds, onSelectionChange, objects]);

  // Reposition the floating toolbar to track the object after drag/transform
  const repositionColorPicker = useCallback((objId: string) => {
    const obj = objects.find((o) => o.id === objId);
    if (!obj || !['rectangle', 'circle', 'line', 'arrow'].includes(obj.type)) return;
    const stage = stageRef.current;
    if (!stage) return;
    const node = stage.findOne(`#obj-${objId}`);
    if (!node) return;
    const clientRect = node.getClientRect();
    const stageBox = stage.container().getBoundingClientRect();
    const toolbarHeight = (obj.type === 'line' || obj.type === 'arrow') ? 80 : 44;
    const topY = stageBox.top + clientRect.y - toolbarHeight - 12;
    const leftX = stageBox.left + clientRect.x + clientRect.width / 2;
    setShowColorPicker({
      x: Math.max(8, Math.min(leftX, window.innerWidth - 320)),
      y: Math.max(8, topY),
      objId,
    });
  }, [objects]);

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>, objId: string) => {
    const node = e.target;
    onObjectUpdate(objId, { x: node.x(), y: node.y() });
    // Reposition toolbar instead of dismissing it
    if (showColorPicker?.objId === objId) {
      // Use requestAnimationFrame so the node position updates first
      requestAnimationFrame(() => repositionColorPicker(objId));
    }
  }, [onObjectUpdate, showColorPicker, repositionColorPicker]);

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
    if (showColorPicker?.objId === objId) {
      requestAnimationFrame(() => repositionColorPicker(objId));
    }
  }, [onObjectUpdate, showColorPicker, repositionColorPicker]);

  // Line/arrow transform handler — scales points instead of width/height
  const handleLineTransformEnd = useCallback((e: Konva.KonvaEventObject<Event>, obj: BoardObject) => {
    const node = e.target;
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const oldPoints = obj.points || [0, 0, obj.width, 0];
    const newPoints = oldPoints.map((p, i) => i % 2 === 0 ? p * sx : p * sy);
    onObjectUpdate(obj.id, {
      x: node.x(),
      y: node.y(),
      points: newPoints,
      width: Math.abs(newPoints[2] - newPoints[0]) || obj.width * sx,
      rotation: node.rotation(),
    });
    if (showColorPicker?.objId === obj.id) {
      requestAnimationFrame(() => repositionColorPicker(obj.id));
    }
  }, [onObjectUpdate, showColorPicker, repositionColorPicker]);

  // Open invisible text editor on sticky note / text
  const openTextEditor = useCallback((objId: string, obj: BoardObject) => {
    if (editingTextId) return;
    setEditingTextId(objId);
    setShowColorPicker(null);
    const stage = stageRef.current;
    if (!stage) return;
    const node = stage.findOne(`#obj-${objId}`);
    if (!node) return;

    const scale = stage.scaleX();
    const stageBox = stage.container().getBoundingClientRect();
    const absPos = node.getAbsolutePosition();

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.value = obj.text || '';
    textarea.placeholder = 'Enter text...';
    textarea.style.position = 'fixed';
    textarea.style.top = `${stageBox.top + absPos.y}px`;
    textarea.style.left = `${stageBox.left + absPos.x}px`;
    textarea.style.width = `${obj.width * scale}px`;
    textarea.style.height = `${obj.height * scale}px`;
    textarea.style.fontSize = `${(obj.fontSize || 16) * scale}px`;
    textarea.style.border = 'none';
    textarea.style.padding = `${12 * scale}px`;
    textarea.style.margin = '0';
    textarea.style.overflow = 'hidden';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.lineHeight = '1.4';
    textarea.style.fontFamily = 'sans-serif';
    textarea.style.zIndex = '1000';
    textarea.style.borderRadius = '4px';
    textarea.style.boxSizing = 'border-box';
    textarea.style.whiteSpace = 'pre-wrap';
    textarea.style.wordWrap = 'break-word';

    if (obj.type === 'sticky-note') {
      textarea.style.background = obj.color;
      textarea.style.color = '#333';
      textarea.style.caretColor = '#333';
    } else {
      // Text object — transparent background, white text
      textarea.style.background = 'transparent';
      textarea.style.color = obj.color || '#fff';
      textarea.style.caretColor = obj.color || '#fff';
    }

    textarea.focus();

    const handleBlur = () => {
      onObjectUpdate(objId, { text: textarea.value });
      if (textarea.parentNode) document.body.removeChild(textarea);
      setEditingTextId(null);
    };

    textarea.addEventListener('blur', handleBlur);
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') textarea.blur();
      e.stopPropagation();
    });
  }, [onObjectUpdate, editingTextId]);

  const renderObject = (obj: BoardObject) => {
    const isSelected = selectedIds.includes(obj.id);
    const draggable = activeTool === 'select';
    const isEditing = editingTextId === obj.id;
    const isTextable = obj.type === 'sticky-note' || obj.type === 'text';

    const commonProps = {
      id: `obj-${obj.id}`,
      x: obj.x,
      y: obj.y,
      rotation: obj.rotation || 0,
      draggable,
      onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
        handleObjectClick(e, obj.id);
        // Single-click on sticky notes / text opens editor
        if (activeTool === 'select' && isTextable && !isEditing) {
          openTextEditor(obj.id, obj);
        }
      },
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(e, obj.id),
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => handleTransformEnd(e, obj.id),
      onDblClick: () => {
        if (isTextable && !isEditing) openTextEditor(obj.id, obj);
      },
      onDblTap: () => {
        if (isTextable && !isEditing) openTextEditor(obj.id, obj);
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

      case 'text':
        return (
          <Group key={obj.id} {...commonProps}>
            <Rect
              width={obj.width}
              height={obj.height}
              fill="transparent"
              stroke={isSelected ? 'rgba(66,133,244,0.3)' : undefined}
              strokeWidth={isSelected ? 1 : 0}
              dash={isSelected ? [4, 4] : undefined}
            />
            {!isEditing && (
              <Text
                text={obj.text || 'Enter text...'}
                width={obj.width}
                height={obj.height}
                padding={12}
                fontSize={obj.fontSize || 20}
                fontFamily="sans-serif"
                fill={obj.text ? (obj.color || '#fff') : '#666'}
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
          <Ellipse
            key={obj.id}
            id={`obj-${obj.id}`}
            x={obj.x}
            y={obj.y}
            radiusX={obj.width / 2}
            radiusY={obj.height / 2}
            offsetX={-obj.width / 2}
            offsetY={-obj.height / 2}
            rotation={obj.rotation || 0}
            draggable={draggable}
            fill={obj.color}
            stroke={isSelected ? '#4285f4' : undefined}
            strokeWidth={isSelected ? 2 : 0}
            onClick={(e: Konva.KonvaEventObject<MouseEvent>) => handleObjectClick(e, obj.id)}
            onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(e, obj.id)}
            onTransformEnd={(e: Konva.KonvaEventObject<Event>) => {
              const node = e.target;
              const scaleX = node.scaleX();
              const scaleY = node.scaleY();
              node.scaleX(1);
              node.scaleY(1);
              const newWidth = Math.max(20, obj.width * scaleX);
              const newHeight = Math.max(20, obj.height * scaleY);
              onObjectUpdate(obj.id, {
                x: node.x(),
                y: node.y(),
                width: newWidth,
                height: newHeight,
                rotation: node.rotation(),
              });
            }}
          />
        );

      case 'line': {
        const lineStroke = obj.strokeWidth || 3;
        return (
          <Line
            key={obj.id}
            id={`obj-${obj.id}`}
            x={obj.x}
            y={obj.y}
            rotation={obj.rotation || 0}
            draggable={draggable}
            points={obj.points || [0, 0, obj.width, 0]}
            stroke={obj.color}
            strokeWidth={lineStroke}
            lineCap="round"
            lineJoin="round"
            hitStrokeWidth={Math.max(20, lineStroke + 10)}
            onClick={(e: Konva.KonvaEventObject<MouseEvent>) => handleObjectClick(e, obj.id)}
            onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(e, obj.id)}
            onTransformEnd={(e: Konva.KonvaEventObject<Event>) => handleLineTransformEnd(e, obj)}
          />
        );
      }

      case 'arrow': {
        const arrowStroke = obj.strokeWidth || 3;
        return (
          <Arrow
            key={obj.id}
            id={`obj-${obj.id}`}
            x={obj.x}
            y={obj.y}
            rotation={obj.rotation || 0}
            draggable={draggable}
            points={obj.points || [0, 0, obj.width, 0]}
            stroke={obj.color}
            fill={obj.color}
            strokeWidth={arrowStroke}
            pointerLength={Math.max(12, arrowStroke * 3)}
            pointerWidth={Math.max(10, arrowStroke * 2.5)}
            lineCap="round"
            lineJoin="round"
            hitStrokeWidth={Math.max(20, arrowStroke + 10)}
            onClick={(e: Konva.KonvaEventObject<MouseEvent>) => handleObjectClick(e, obj.id)}
            onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(e, obj.id)}
            onTransformEnd={(e: Konva.KonvaEventObject<Event>) => handleLineTransformEnd(e, obj)}
          />
        );
      }

      // Legacy types — render minimally so old data doesn't crash
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
          </Group>
        );

      case 'connector': {
        const fromObj = objects.find((o) => o.id === obj.fromId);
        const toObj = objects.find((o) => o.id === obj.toId);
        if (!fromObj || !toObj) return null;
        return (
          <Arrow
            key={obj.id}
            id={`obj-${obj.id}`}
            points={[fromObj.x + fromObj.width / 2, fromObj.y + fromObj.height / 2, toObj.x + toObj.width / 2, toObj.y + toObj.height / 2]}
            stroke={obj.color || '#fff'}
            strokeWidth={2}
            pointerLength={10}
            pointerWidth={10}
            fill={obj.color || '#fff'}
            onClick={(e: Konva.KonvaEventObject<MouseEvent>) => handleObjectClick(e, obj.id)}
            hitStrokeWidth={20}
          />
        );
      }

      default:
        return null;
    }
  };

  const [cursorOverride, setCursorOverride] = useState(false);

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
        <Layer name="grid" />

        <Layer>
          {objects.filter((o) => o.type === 'frame').map(renderObject)}
          {objects.filter((o) => o.type === 'connector').map(renderObject)}
          {objects.filter((o) => o.type !== 'frame' && o.type !== 'connector').map(renderObject)}

          <Rect
            ref={selectionRectRef}
            fill="rgba(66, 133, 244, 0.1)"
            stroke="#4285f4"
            strokeWidth={1}
            visible={false}
          />

          {/* Transformer for shapes (not lines/arrows) */}
          <Transformer
            ref={transformerRef}
            centeredScaling={true}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 20 || newBox.height < 20) return oldBox;
              return newBox;
            }}
            borderStroke="#4285f4"
            anchorFill="#fff"
            anchorStroke="#4285f4"
            anchorSize={8}
          />

          {/* Transformer for lines/arrows — 2 endpoint dots + rotation */}
          <Transformer
            ref={lineTransformerRef}
            enabledAnchors={['top-left', 'bottom-right']}
            borderEnabled={false}
            rotateEnabled={true}
            rotateAnchorOffset={20}
            anchorFill="#fff"
            anchorStroke="#4285f4"
            anchorSize={10}
            anchorCornerRadius={5}
            anchorStrokeWidth={2}
            keepRatio={false}
          />
        </Layer>

        {/* Cursors layer */}
        <Layer>
          {cursors.map((cursor) => (
            <Group key={cursor.userId} x={cursor.x} y={cursor.y}>
              <Line
                points={[0, 0, 0, 16, 4, 12, 8, 20, 12, 18, 8, 10, 14, 10]}
                fill={cursor.color}
                stroke="#fff"
                strokeWidth={1}
                closed
              />
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

      {/* Floating toolbar — color picker + thickness for lines/arrows */}
      {showColorPicker && (() => {
        const currentObj = objects.find((o) => o.id === showColorPicker.objId);
        const isLineType = currentObj && (currentObj.type === 'line' || currentObj.type === 'arrow');
        return (
          <div
            style={{
              position: 'fixed',
              top: showColorPicker.y,
              left: showColorPicker.x,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '8px 10px',
              background: '#1e1e2e',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              zIndex: 1000,
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setShowColorPicker(null)}
              style={{
                position: 'absolute',
                top: -8,
                right: -8,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#333',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#ccc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                lineHeight: 1,
                padding: 0,
                zIndex: 1001,
              }}
              title="Close"
            >
              ✕
            </button>

            {/* Color row */}
            <div style={{ display: 'flex', gap: '3px' }}>
              {SHAPE_COLORS.map((c) => {
                const isActive = currentObj?.color === c;
                return (
                  <button
                    key={c}
                    onClick={() => {
                      onObjectUpdate(showColorPicker.objId, { color: c });
                    }}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: c,
                      border: isActive ? '2px solid #4285f4' : '2px solid rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                      padding: 0,
                      outline: 'none',
                    }}
                  />
                );
              })}
            </div>

            {/* Thickness row — only for lines and arrows */}
            {isLineType && (
              <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                <span style={{ color: '#777', fontSize: '0.65rem', marginRight: '2px', whiteSpace: 'nowrap' }}>
                  Thickness
                </span>
                {STROKE_WIDTHS.map((sw) => {
                  const isActive = (currentObj?.strokeWidth || 3) === sw;
                  return (
                    <button
                      key={sw}
                      onClick={() => {
                        onObjectUpdate(showColorPicker.objId, { strokeWidth: sw });
                      }}
                      title={`${sw}px`}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '4px',
                        background: isActive ? 'rgba(66,133,244,0.3)' : 'transparent',
                        border: isActive ? '1px solid #4285f4' : '1px solid rgba(255,255,255,0.1)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: Math.max(2, sw),
                          background: currentObj?.color || '#fff',
                          borderRadius: sw > 4 ? '2px' : '1px',
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Zoom indicator */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12,
        background: 'rgba(22,22,30,0.8)', color: '#a0a0b0',
        padding: '0.3rem 0.6rem', borderRadius: '0.3rem', fontSize: '0.75rem',
        border: '1px solid rgba(255,255,255,0.1)',
        pointerEvents: 'none',
      }}>
        {Math.round((stageRef.current?.scaleX() || 1) * 100)}%
      </div>
    </div>
  );
}
