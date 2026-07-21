import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

interface UseSheetDragToCloseOptions {
  /** Called once the handle is dragged down past `thresholdPx`. */
  onDismiss: () => void;
  /** Drag distance (px) required before the sheet closes. */
  thresholdPx?: number;
  /** While true, drag gestures are ignored (e.g. submitting, a confirm dialog is open). */
  disabled?: boolean;
}

/**
 * Drag-to-dismiss behaviour for a mobile bottom-sheet "handle" (the little
 * pill at the top of the sheet). Spread `handleProps` onto the handle
 * element and use `dragOffset` / `isDragging` to move the sheet itself:
 *
 *   const { dragOffset, isDragging, handleProps } = useSheetDragToClose({ onDismiss: requestClose });
 *   <div style={dragOffset ? { transform: `translateY(${dragOffset}px)` } : undefined} ...>
 *     <SheetDragHandle {...handleProps} />
 *     ...
 *   </div>
 */
export function useSheetDragToClose({
  onDismiss,
  thresholdPx = 120,
  disabled = false,
}: UseSheetDragToCloseOptions) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef<number | null>(null);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled) return;
      dragStartYRef.current = event.clientY;
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [disabled],
  );

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (dragStartYRef.current === null) return;
    const delta = event.clientY - dragStartYRef.current;
    setDragOffset(delta > 0 ? delta : 0);
  }, []);

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (dragStartYRef.current === null) return;
      dragStartYRef.current = null;
      setIsDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (dragOffset > thresholdPx) {
        onDismiss();
      }
      setDragOffset(0);
    },
    [dragOffset, onDismiss, thresholdPx],
  );

  return {
    /** Current downward drag distance in px (0 when not dragging). */
    dragOffset,
    isDragging,
    /** Spread onto the sheet's root element to make it follow the drag. */
    sheetDragStyle: dragOffset ? { transform: `translateY(${dragOffset}px)` } : undefined,
    /** Disable the CSS transition while actively dragging so the sheet tracks the pointer 1:1. */
    sheetTransitionClassName: isDragging ? '' : 'transition-transform duration-200 ease-out',
    /** Spread onto the drag handle element. */
    handleProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    },
  };
}
