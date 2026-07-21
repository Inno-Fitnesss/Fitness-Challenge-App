import type { PointerEventHandler } from 'react';

interface SheetDragHandleProps {
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onPointerCancel: PointerEventHandler<HTMLDivElement>;
}

/**
 * The little pill at the top of a mobile bottom sheet. Purely presentational —
 * pair with `useSheetDragToClose` for the actual drag-to-dismiss behaviour.
 * The visible pill is tiny, so the hit target is padded well beyond it.
 */
export function SheetDragHandle(handlers: SheetDragHandleProps) {
  return (
    <div
      className="sm:hidden flex justify-center pt-1 pb-3 -mb-1 cursor-grab select-none active:cursor-grabbing"
      style={{ touchAction: 'none' }}
      role="button"
      tabIndex={-1}
      aria-label="Потянуть вниз, чтобы закрыть"
      {...handlers}
    >
      <span className="w-10 h-1 bg-neutral-border rounded-full" aria-hidden="true" />
    </div>
  );
}
