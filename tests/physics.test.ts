import test from "node:test";
import assert from "node:assert/strict";
import { stepRK4 } from "../src/core/rk4.ts";
import { computeSampleStats, fitLinearLeastSquares } from "../src/core/statistics.ts";
import { coupledOscillatorsExperiment } from "../src/experiments/coupled-oscillators/index.ts";

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
  assert.ok(Math.abs(eFinal - e0) < 1e-6, "Energy drift too large: " + Math.abs(eFinal - e0));
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

test("EXP-03 symmetric mode oscillates at omega_plus = sqrt(k / m)", () => {
  const params = { mass: 0.6, springK: 12.0, couplingK: 2.0, dampingB: 0.0, x1Init: 0.12, x2Init: 0.12 };
  let state = coupledOscillatorsExperiment.getInitialState(params);
  let t = 0;
  const dt = 0.002;
  const wPlus = Math.sqrt(params.springK / params.mass);
  const expectedX = params.x1Init * Math.cos(wPlus * 1.5);

  while (t + dt <= 1.5 + 1e-12) {
    state = stepRK4(state, t, dt, (s, tNow) => coupledOscillatorsExperiment.computeDerivatives(s, tNow, params));
    t += dt;
  }

  assert.ok(Math.abs((state[0] ?? 0) - expectedX) < 1e-5);
  assert.ok(Math.abs((state[2] ?? 0) - expectedX) < 1e-5);
});

test("EXP-03 antisymmetric mode oscillates at omega_minus = sqrt((k + 2*kc) / m)", () => {
  const params = { mass: 0.6, springK: 12.0, couplingK: 2.0, dampingB: 0.0, x1Init: 0.12, x2Init: -0.12 };
  let state = coupledOscillatorsExperiment.getInitialState(params);
  let t = 0;
  const dt = 0.002;
  const wMinus = Math.sqrt((params.springK + 2 * params.couplingK) / params.mass);
  const expectedX1 = params.x1Init * Math.cos(wMinus * 1.2);

  while (t + dt <= 1.2 + 1e-12) {
    state = stepRK4(state, t, dt, (s, tNow) => coupledOscillatorsExperiment.computeDerivatives(s, tNow, params));
    t += dt;
  }

  assert.ok(Math.abs((state[0] ?? 0) - expectedX1) < 1e-5);
  assert.ok(Math.abs((state[2] ?? 0) + expectedX1) < 1e-5);
});

test("EXP-03 beat mode transfers energy between x1 and x2 at beat envelope", () => {
  const params = { mass: 0.6, springK: 12.0, couplingK: 2.0, dampingB: 0.0, x1Init: 0.14, x2Init: 0.0 };
  let state = coupledOscillatorsExperiment.getInitialState(params);
  let t = 0;
  const dt = 0.002;
  const wPlus = Math.sqrt(params.springK / params.mass);
  const wMinus = Math.sqrt((params.springK + 2 * params.couplingK) / params.mass);
  const wBeat = Math.abs(wMinus - wPlus) / 2;
  const tHalfBeat = Math.PI / (2 * wBeat);

  let maxX2 = 0;
  while (t + dt <= tHalfBeat + 1e-12) {
    state = stepRK4(state, t, dt, (s, tNow) => coupledOscillatorsExperiment.computeDerivatives(s, tNow, params));
    t += dt;
    if (Math.abs(state[2] ?? 0) > maxX2) maxX2 = Math.abs(state[2] ?? 0);
  }

  assert.ok(maxX2 > 0.11, "Expected strong energy transfer to x2, got maxX2=" + maxX2);
});
