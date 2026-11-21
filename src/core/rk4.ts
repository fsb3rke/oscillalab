export type DerivativeFn = (state: readonly number[], t: number) => number[];

export function stepRK4(
  state: readonly number[],
  t: number,
  dt: number,
  derivs: DerivativeFn
): number[] {
  const n = state.length;
  const k1 = derivs(state, t);

  const s2 = new Array<number>(n);
  for (let i = 0; i < n; i++) s2[i] = (state[i] ?? 0) + 0.5 * dt * (k1[i] ?? 0);
  const k2 = derivs(s2, t + 0.5 * dt);

  const s3 = new Array<number>(n);
  for (let i = 0; i < n; i++) s3[i] = (state[i] ?? 0) + 0.5 * dt * (k2[i] ?? 0);
  const k3 = derivs(s3, t + 0.5 * dt);

  const s4 = new Array<number>(n);
  for (let i = 0; i < n; i++) s4[i] = (state[i] ?? 0) + dt * (k3[i] ?? 0);
  const k4 = derivs(s4, t + dt);

  const next = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    next[i] =
      (state[i] ?? 0) +
      (dt / 6) * ((k1[i] ?? 0) + 2 * (k2[i] ?? 0) + 2 * (k3[i] ?? 0) + (k4[i] ?? 0));
  }
  return next;
}
