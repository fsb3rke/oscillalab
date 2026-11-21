export interface SampleStats {
  count: number;
  mean: number;
  stdDev: number;
  stdError: number;
}

export interface LinearFitResult {
  slope: number;
  intercept: number;
  rSquared: number;
}

export function computeSampleStats(values: readonly number[]): SampleStats {
  const valid = values.filter((v) => Number.isFinite(v));
  const n = valid.length;
  if (n === 0) {
    return { count: 0, mean: 0, stdDev: 0, stdError: 0 };
  }

  let sum = 0;
  for (const v of valid) sum += v;
  const mean = sum / n;

  if (n < 2) {
    return { count: 1, mean, stdDev: 0, stdError: 0 };
  }

  let sqDiffSum = 0;
  for (const v of valid) {
    const d = v - mean;
    sqDiffSum += d * d;
  }

  // Bessel düzeltmeli (n - 1) örneklem standart sapması
  const stdDev = Math.sqrt(sqDiffSum / (n - 1));
  const stdError = stdDev / Math.sqrt(n);

  return { count: n, mean, stdDev, stdError };
}

export function fitLinearLeastSquares(xs: readonly number[], ys: readonly number[]): LinearFitResult | null {
  const len = Math.min(xs.length, ys.length);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < len; i++) {
    const x = xs[i];
    const y = ys[i];
    if (x !== undefined && y !== undefined && Number.isFinite(x) && Number.isFinite(y)) {
      pts.push({ x, y });
    }
  }

  const n = pts.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (const p of pts) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }

  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-12) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  for (const p of pts) {
    const pred = slope * p.x + intercept;
    ssTot += (p.y - meanY) ** 2;
    ssRes += (p.y - pred) ** 2;
  }

  const rSquared = ssTot > 1e-12 ? Math.max(0, 1 - ssRes / ssTot) : 1;
  return { slope, intercept, rSquared };
}
