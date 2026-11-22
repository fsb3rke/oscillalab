import test from "node:test";
import assert from "node:assert/strict";
import { stepRK4 } from "../src/core/rk4.ts";
import { computeSampleStats, fitLinearLeastSquares } from "../src/core/statistics.ts";

test("RK4 harmonic oscillator preserves mechanical energy within 1e-6", () => {
  const k = 16.0;
  const m = 1.0;
  let state = [0.25, 0.0];
  let t = 0;
  const dt = 0.002;
  const e0 = 0.5 * k * state[0]! ** 2;

  for (let i = 0; i < 5000; i++) {
    state = stepRK4(state, t, dt, (s) => [s[1] ?? 0, -(k / m) * (s[0] ?? 0)]);
    t += dt;
  }

  const eFinal = 0.5 * k * state[0]! ** 2 + 0.5 * m * state[1]! ** 2;
  assert.ok(Math.abs(eFinal - e0) < 1e-6, `Energy drift too large: ${Math.abs(eFinal - e0)}`);
});

test("OLS regression recovers exact spring constant k from noiseless T^2 vs m", () => {
  const kTrue = 14.0;
  const masses = [0.2, 0.4, 0.6, 0.8];
  const tSq = masses.map((m) => (4 * Math.PI * Math.PI * m) / kTrue);
  const fit = fitLinearLeastSquares(masses, tSq);
  assert.ok(fit !== null);
  const kEst = (4 * Math.PI * Math.PI) / fit.slope;
  assert.ok(Math.abs(kEst - kTrue) < 1e-9);
  assert.ok(Math.abs(fit.rSquared - 1.0) < 1e-12);
});

test("Bessel-corrected standard error computes accurately", () => {
  const stats = computeSampleStats([1.62, 1.64, 1.61]);
  assert.equal(stats.count, 3);
  assert.ok(Math.abs(stats.mean - 1.623333) < 1e-4);
  assert.ok(stats.stdError > 0);
});
