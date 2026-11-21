export interface SampleStats { count: number; mean: number; stdDev: number; stdError: number; }
export interface LinearFitResult { slope: number; intercept: number; slopeError: number; interceptError: number; rSquared: number; }

export function computeSampleStats(values: readonly number[]): SampleStats {
  const valid = values.filter((v) => Number.isFinite(v));
  const n = valid.length;
  if (n === 0) return { count: 0, mean: 0, stdDev: 0, stdError: 0 };
  const mean = valid.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return { count: 1, mean, stdDev: 0, stdError: 0 };
  const stdDev = Math.sqrt(valid.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1));
  return { count: n, mean, stdDev, stdError: stdDev / Math.sqrt(n) };
}

export function fitLinearLeastSquares(xs: readonly number[], ys: readonly number[]): LinearFitResult | null {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    const x = xs[i], y = ys[i];
    if (x !== undefined && y !== undefined && Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y });
  }
  const n = pts.length;
  if (n < 2) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const p of pts) { sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumXX += p.x * p.x; }
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-14) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const meanX = sumX / n, meanY = sumY / n;
  let ssTot = 0, ssRes = 0, sxx = 0;
  for (const p of pts) {
    ssTot += (p.y - meanY) ** 2;
    ssRes += (p.y - (slope * p.x + intercept)) ** 2;
    sxx += (p.x - meanX) ** 2;
  }
  const rSquared = ssTot > 1e-14 ? Math.max(0, 1 - ssRes / ssTot) : 1;
  const syxSq = n - 2 > 0 ? ssRes / (n - 2) : 0;
  const slopeError = sxx > 1e-14 ? Math.sqrt(syxSq / sxx) : 0;
  const interceptError = sxx > 1e-14 ? Math.sqrt(syxSq * (1 / n + (meanX * meanX) / sxx)) : 0;
  return { slope, intercept, slopeError, interceptError, rSquared };
}
