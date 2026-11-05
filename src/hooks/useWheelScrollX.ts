import { useCallback, useRef } from 'react';

export function useWheelScrollX<T extends HTMLElement>() {
  const cleanup = useRef<(() => void) | null>(null);
  return useCallback((node: T | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const max = node.scrollWidth - node.clientWidth;
      if (max <= 0) return;
      const next = Math.min(max, Math.max(0, node.scrollLeft + event.deltaY));
      if (next === node.scrollLeft) return;
      event.preventDefault();
      node.scrollLeft = next;
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    cleanup.current = () => node.removeEventListener('wheel', onWheel);
  }, []);
}
