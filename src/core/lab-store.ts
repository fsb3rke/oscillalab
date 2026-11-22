export interface CapturedMeasurement {
  expId: string;
  xVal: number;
  period: number;
  timestamp: number;
}

type Listener = (item: CapturedMeasurement) => void;

const queue: CapturedMeasurement[] = [];
const listeners = new Set<Listener>();

export function pushCapturedMeasurement(item: CapturedMeasurement): void {
  queue.push(item);
  for (const fn of listeners) fn(item);
}

export function drainCapturedMeasurements(expId: string): CapturedMeasurement[] {
  const matched: CapturedMeasurement[] = [];
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i]?.expId === expId) {
      matched.unshift(queue[i]!);
      queue.splice(i, 1);
    }
  }
  return matched;
}

export function onCapturedMeasurement(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
