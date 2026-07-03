export function findTourTarget(targetId: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${targetId}"]`);

  for (const element of nodes) {
    if (!isElementVisible(element)) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return element;
  }

  return nodes[0] ?? null;
}

function isElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (element.getClientRects().length === 0) return false;
  return true;
}

export function waitForTourTarget(
  targetId: string,
  timeoutMs = 4000,
  intervalMs = 100,
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const started = Date.now();

    const tick = () => {
      const element = findTourTarget(targetId);
      if (element) {
        resolve(element);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(null);
        return;
      }
      window.setTimeout(tick, intervalMs);
    };

    tick();
  });
}

export function getSpotlightRect(element: HTMLElement, padding = 8): DOMRect {
  const rect = element.getBoundingClientRect();
  return new DOMRect(
    rect.left - padding,
    rect.top - padding,
    rect.width + padding * 2,
    rect.height + padding * 2,
  );
}
