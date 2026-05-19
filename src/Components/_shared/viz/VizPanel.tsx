import { Component, createSignal, onMount, onCleanup } from 'solid-js';
import type { PanelState } from './vizStore';
import { vizStore } from './vizStore';

export interface VizPanelProps {
  panel: PanelState;
}

export const VizPanel: Component<VizPanelProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;

  const [isDragging, setIsDragging] = createSignal(false);
  const [isResizing, setIsResizing] = createSignal(false);
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = createSignal({ x: 0, y: 0, width: 0, height: 0 });

  // Convert negative positions (from right/bottom edge) to absolute pixels
  const getAbsolutePosition = () => {
    const panel = props.panel;
    let left = panel.x;
    let top = panel.y;

    if (panel.x < 0) {
      left = window.innerWidth - panel.width + panel.x;
    }
    if (panel.y < 0) {
      top = window.innerHeight - panel.height + panel.y;
    }

    return { left, top };
  };

  const [position, setPosition] = createSignal(getAbsolutePosition());

  onMount(() => {
    // Recalculate position on window resize
    const handleResize = () => {
      if (!isDragging() && !isResizing()) {
        setPosition(getAbsolutePosition());
      }
    };
    window.addEventListener('resize', handleResize);
    onCleanup(() => window.removeEventListener('resize', handleResize));
  });

  const onHeaderMouseDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;

    setIsDragging(true);
    const pos = position();
    setDragOffset({
      x: e.clientX - pos.left,
      y: e.clientY - pos.top,
    });
    e.preventDefault();
  };

  const onResizeMouseDown = (e: MouseEvent) => {
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: props.panel.width,
      height: props.panel.height,
    });
    e.preventDefault();
    e.stopPropagation();
  };

  onMount(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging()) {
        const offset = dragOffset();
        const newX = Math.max(0, Math.min(e.clientX - offset.x, window.innerWidth - props.panel.width));
        const newY = Math.max(0, Math.min(e.clientY - offset.y, window.innerHeight - props.panel.height));
        setPosition({ left: newX, top: newY });
      }

      if (isResizing()) {
        const start = resizeStart();
        const deltaX = e.clientX - start.x;
        const deltaY = e.clientY - start.y;
        const newWidth = Math.max(200, start.width + deltaX);
        const newHeight = Math.max(100, start.height + deltaY);
        vizStore.updateSize(props.panel.id, newWidth, newHeight);
      }
    };

    const handleMouseUp = () => {
      if (isDragging()) {
        const pos = position();
        vizStore.updatePosition(props.panel.id, pos.left, pos.top);
        setIsDragging(false);
      }
      if (isResizing()) {
        setIsResizing(false);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    onCleanup(() => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    });
  });

  return (
    <div
      ref={containerRef}
      class="viz-panel"
      style={{
        position: 'fixed',
        left: `${position().left}px`,
        top: `${position().top}px`,
        width: `${props.panel.width}px`,
        height: `${props.panel.height}px`,
        background: 'rgba(0, 0, 0, 0.9)',
        color: '#fff',
        'font-family': 'monospace',
        'font-size': '11px',
        'border-radius': '8px',
        overflow: 'hidden',
        'z-index': '10000',
        'box-shadow': '0 4px 20px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        'flex-direction': 'column',
        'min-width': '200px',
        'min-height': '100px',
      }}
    >
      {/* Header */}
      <div
        class="viz-header"
        onMouseDown={onHeaderMouseDown}
        style={{
          padding: '8px 12px',
          background: '#333',
          display: 'flex',
          'justify-content': 'space-between',
          'align-items': 'center',
          'border-bottom': '1px solid #444',
          cursor: 'move',
          'user-select': 'none',
          'flex-shrink': '0',
        }}
      >
        <span style={{ 'font-weight': 'bold', color: props.panel.titleColor || '#66ccff' }}>
          {props.panel.title}
        </span>
        <button
          onClick={() => vizStore.hidePanel(props.panel.id)}
          style={{
            background: '#555',
            border: 'none',
            color: 'white',
            padding: '2px 8px',
            'border-radius': '4px',
            cursor: 'pointer',
            'font-size': '14px',
            'line-height': '1',
          }}
        >
          x
        </button>
      </div>

      {/* Content */}
      <div
        class="viz-content"
        style={{
          padding: '10px 12px',
          flex: '1',
          'min-height': '0',
          display: 'flex',
          'flex-direction': 'column',
          'overflow-y': 'auto',
          'overflow-x': 'hidden',
        }}
      >
        {props.panel.content()}
      </div>

      {/* Resize handle */}
      <div
        class="viz-resize-handle"
        onMouseDown={onResizeMouseDown}
        style={{
          position: 'absolute',
          bottom: '0',
          right: '0',
          width: '16px',
          height: '16px',
          cursor: 'se-resize',
          background: 'linear-gradient(135deg, transparent 50%, #555 50%)',
          'border-radius': '0 0 8px 0',
        }}
      />
    </div>
  );
};
