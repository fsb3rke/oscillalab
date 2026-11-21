export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options?: {
    className?: string;
    text?: string;
    attrs?: Record<string, string>;
  }
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options?.className) node.className = options.className;
  if (options?.text !== undefined) node.textContent = options.text;
  if (options?.attrs) {
    for (const [k, v] of Object.entries(options.attrs)) {
      if (!k.toLowerCase().startsWith('on')) {
        node.setAttribute(k, v);
      }
    }
  }
  return node;
}

export function sanitizeCsvCell(value: string | number): string {
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}
