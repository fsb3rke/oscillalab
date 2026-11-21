export type DerivativeFn = (state: readonly number[], t: number) => readonly number[];

export function stepRK4(state: readonly number[], t: number, dt: number, deriv: DerivativeFn): number[] {
  const n = state.length;
  const k1 = deriv(state, t);
  const s2 = new Array<number>(n);
  for (let i = 0; i < n; i++) s2[i] = (state[i] ?? 0) + 0.5 * dt * (k1[i] ?? 0);

  const k2 = deriv(s2, t + 0.5 * dt);
  const s3 = new Array<number>(n);
  for (let i = 0; i < n; i++) s3[i] = (state[i] ?? 0) + 0.5 * dt * (k2[i] ?? 0);

  const k3 = deriv(s3, t + 0.5 * dt);
  const s4 = new Array<number>(n);
  for (let i = 0; i < n; i++) s4[i] = (state[i] ?? 0) + dt * (k3[i] ?? 0);

  const k4 = deriv(s4, t + dt);
  const next = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const val = (state[i] ?? 0) + (dt / 6) * ((k1[i] ?? 0) + 2 * (k2[i] ?? 0) + 2 * (k3[i] ?? 0) + (k4[i] ?? 0));
    if (!Number.isFinite(val)) return state.map(() => 0);
    next[i] = val;
  }
  return next;
}
